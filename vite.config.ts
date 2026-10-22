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

// 三方包 → 稳定、可读的 chunk 名（便于产物分析）。key 为精确包名。
const VENDOR_CHUNK: Record<string, string> = {
  react: "react",
  "react-dom": "react",
  scheduler: "react",
  vue: "vue",
  sonner: "sonner",
  three: "three",
  recharts: "recharts",
  "@zumer/snapdom": "snapdom",
  "react-json-view": "react-json-view",
  json5: "json5",
  jsonrepair: "jsonrepair",
  "lz-string": "share-common",
  "qrcode-generator": "share-common",
};

// 本仓库源码 → chunk 名。用于：避免无谓的小 chunk、以及让多个页面共享的
// 本地模块拥有稳定可读的名字。
const APP_CHUNK: Array<[suffix: string, chunk: string]> = [
  ["/components/toaster.tsx", "toaster"], // 懒加载 Toaster 外壳，与 sonner 库(sonner chunk)区分
  ["/app/share/styles.css", "share-common"], // share 两页共享样式
  // 全站基础样式由各框架挂载器引入，独立成 chunk，避免随挂载器各产出一份。
  ["/app/globals.css", "globals"],
];

function chunkName(id: string) {
  const normalized = id.split("?")[0].replaceAll("\\", "/");
  // 所有动态 import 都依赖 Vite 的 preload helper；若不单独成 chunk，它会被并进
  // 某个先用到它的业务 chunk（如 toaster），使所有页面间接依赖该 chunk 及其框架运行时。
  if (normalized.endsWith("vite/preload-helper.js")) return "preload-helper";
  const packageName = modulePackageName(normalized);

  if (packageName) {
    // vue 的运行时拆在多个 @vue/* 包里，合成一个 chunk，与 react chunk 对称。
    if (packageName.startsWith("@vue/")) return "vue";
    return VENDOR_CHUNK[packageName];
  }

  return APP_CHUNK.find(([suffix]) => normalized.endsWith(suffix))?.[1];
}

const pages = discoverPages({ root: import.meta.dirname });
const input = Object.fromEntries(
  pages.map((page) => [page.entryName, path.resolve(import.meta.dirname, page.entryFile)]),
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
  plugins: [devPageEntries(), vue() as unknown as Plugin],
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
    emptyOutDir: true,
    manifest: true,
    // Three.js is isolated in its own chunk and only loaded by the 3D pages.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      onwarn(warning, defaultHandler) {
        if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
        defaultHandler(warning);
      },
      input,
      output: {
        manualChunks: chunkName,
      },
    },
  },
});
