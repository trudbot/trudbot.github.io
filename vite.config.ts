import path from "node:path";
import vue from "@vitejs/plugin-vue";
import { defineConfig, type Plugin } from "vite-plus";
import { discoverPages } from "./scripts/discover-pages.mjs";

function modulePackageName(id: string) {
  const normalized = id.split("?")[0].replaceAll("\\", "/");
  const marker = "/node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index === -1) return undefined;

  const [first, second] = normalized.slice(index + marker.length).split("/");
  if (!first) return undefined;
  return first.startsWith("@") && second ? `${first}/${second}` : first;
}

type Page = ReturnType<typeof discoverPages>[number];
type ChunkingContext = { getModuleInfo(id: string): { importedIds: string[] } | null };

function moduleFramework(id: string) {
  const packageName = modulePackageName(id);
  if (packageName === "react" || packageName === "react-dom" || packageName === "scheduler") {
    return "react";
  }
  if (packageName === "vue" || packageName?.startsWith("@vue/")) return "vue";
  return undefined;
}

// 从页面 entry 出发沿静态 import 能到达的模块，即首屏必须加载的模块。
function staticGraph(entryId: string, ctx: ChunkingContext) {
  const seen = new Set<string>();
  const stack = [entryId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(ctx.getModuleInfo(id)?.importedIds ?? []));
  }
  return seen;
}

/*
 * 每个页面单独构建，产物固定为两个 JS：entry（首屏静态依赖全部内联）与
 * `<page>-async`（页面所有动态导入的模块合成一个）。页面之间不共享 chunk，
 * 代价是公共代码（如 react）在每个页面的产物里各有一份。
 */
function pageCodeSplitting(page: Page) {
  const entryId = path.resolve(import.meta.dirname, page.entryFile);
  const initialModules = new WeakMap<ChunkingContext, Set<string>>();

  return {
    groups: [
      {
        name(id: string, ctx: ChunkingContext) {
          let initial = initialModules.get(ctx);
          if (!initial) initialModules.set(ctx, (initial = staticGraph(entryId, ctx)));
          return initial.has(id) ? null : `${page.entryName}-async`;
        },
        // 必须关闭：否则 async 模块依赖的首屏模块（如 react）会被一并收进 async chunk，
        // 与 entry 里那份重复，运行时出现两个 React 实例。
        includeDependenciesRecursively: false,
      },
    ],
  };
}

// 构建期守住两条约定：页面只打进自己框架的运行时（共享代码误引框架专属模块时，
// 人工很难从产物里察觉）；每个页面最多 entry + async 两个 JS。
function pageBundleCheck(page: Page): Plugin {
  const framework = page.framework === "react" ? "react" : "vue";
  return {
    name: "page-bundle-check",
    apply: "build",
    generateBundle(_, bundle) {
      const chunks = Object.values(bundle).filter((file) => file.type === "chunk");
      if (chunks.length > 2) {
        this.error(
          `Page '${page.route}' emits ${chunks.length} JS chunks (expected entry + async): ` +
            chunks.map((chunk) => chunk.fileName).join(", "),
        );
      }
      for (const chunk of chunks) {
        for (const [id, info] of Object.entries(chunk.modules)) {
          const other = moduleFramework(id);
          if (other && other !== framework && info.renderedLength > 0) {
            this.error(
              `Page '${page.route}' (${page.framework}) bundles ${other} runtime module ${id}. ` +
                `Check shared modules it imports for ${other}-only code.`,
            );
          }
        }
      }
    },
  };
}

const pages = discoverPages({ root: import.meta.dirname });
// scripts/ssg.mjs 逐页设置后调用构建；未设置时（dev、SSR 构建）包含全部页面。
const ssgPageName = process.env.SSG_PAGE;
const ssgPage = ssgPageName ? pages.find((page) => page.entryName === ssgPageName) : undefined;
if (ssgPageName && !ssgPage) throw new Error(`Unknown SSG_PAGE '${ssgPageName}'`);

const input = Object.fromEntries(
  (ssgPage ? [ssgPage] : pages).map((page) => [
    page.entryName,
    path.resolve(import.meta.dirname, page.entryFile),
  ]),
);
const routeEntries = Object.fromEntries(pages.map((page) => [page.route, page.entryFile]));

function devPageEntries(): Plugin {
  return {
    name: "dev-page-entries",
    apply: "serve",
    transformIndexHtml(html, context) {
      const requestPath = context.originalUrl ?? context.path;
      const pathname = requestPath.split("?")[0].replace(/\/$/, "") || "/";
      const entryFile = routeEntries[pathname];
      if (!entryFile) return html;

      // dev 不做预渲染；去掉 #root 里的占位注释，挂载器才会按空容器做客户端渲染，
      // 否则 Vue Vapor 会对非空容器告警。
      return html
        .replace("<!--app-html-->", "")
        .replace("<!--page-assets-->", `<script type="module" src="/${entryFile}"></script>`);
    },
  };
}

export default defineConfig({
  fmt: {
    ignorePatterns: ["out/**", ".vite-ssg/**", "miniapp/*/dist/**"],
  },
  lint: {
    ignorePatterns: ["out/**", ".vite-ssg/**", "miniapp/*/dist/**"],
  },
  // plugin-vue 的类型来自独立的 vite 包，与 vite-plus 的 Plugin 类型结构相同但
  // tsc 比较二者时栈溢出（TS2321）；运行时由同一套插件机制执行，直接断言即可。
  plugins: [
    devPageEntries(),
    vue() as unknown as Plugin,
    ...(ssgPage ? [pageBundleCheck(ssgPage)] : []),
  ],
  // JSX 统一交给 React：.tsx 只用于 React 页面，Vue 页面使用 SFC 模板。
  oxc: {
    jsx: {
      runtime: "automatic",
      importSource: "react",
      refresh: false,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
  build: {
    outDir: "out",
    // 逐页构建共用 out/，由 scripts/ssg.mjs 在开始前统一清空；每页的 manifest 分开写。
    emptyOutDir: !ssgPage,
    manifest: ssgPage ? `.vite/manifest/${ssgPage.entryName}.json` : true,
    // Three.js is isolated in its own chunk and only loaded by the 3D pages.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        defaultHandler(warning);
      },
      input,
      output: ssgPage ? { codeSplitting: pageCodeSplitting(ssgPage) } : {},
    },
  },
});
