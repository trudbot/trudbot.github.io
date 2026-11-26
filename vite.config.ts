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
  "framer-motion": "framer-motion",
  "motion-dom": "framer-motion",
  "motion-utils": "framer-motion",
  // 图标按需 tree-shake 后每个只有几百字节，按页面组合自动拆分会产生大量碎 chunk；
  // 合进 React 页面共用的胶水 chunk，代价是个别页面多下载几个用不到的图标。
  "lucide-react": "react-shared",
  "@zumer/snapdom": "snapdom",
  "@microlink/react-json-view": "react-json-view",
  json5: "json5",
  jsonrepair: "jsonrepair",
  "lz-string": "share-common",
  "@chromium-style-qrcode/generator": "qrcode",
};

// 本仓库源码 → chunk 名。用于：避免无谓的小 chunk、以及让多个页面共享的
// 本地模块拥有稳定可读的名字。
//
// 不指定时打包器按「被哪些页面共用」自动拆分，页面组合一多就会出现大量 1KB
// 左右的碎 chunk，各自占一次请求。因此几 KB 量级的共享胶水代码按框架合并：
// - runtime：零框架依赖、所有页面都会加载的代码，Vue 页面也可安全引用；
// - react-shared：只被 React 页面引用，可依赖 react chunk。
// 合并的代价是部分页面会多下载少量用不到的代码，只适合放体积很小的模块；
// 较大的库仍应单独成 chunk。
const APP_CHUNK: Array<[suffix: string, chunk: string]> = [
  ["/src/runtime/global-scripts.ts", "runtime"],
  // Vue 挂载器很小，跟着 vue chunk 走，Vue 页面本来就要加载它。
  ["/src/runtime/mount-vue-vapor.ts", "vue"],
  ["/src/runtime/mount-react.tsx", "react-shared"],
  ["/components/client-only.tsx", "react-shared"],
  // 懒加载 sonner 的 Toaster 外壳本身很小；sonner 库仍在独立的 sonner chunk。
  ["/components/toaster.tsx", "react-shared"],
  ["/components/motion-features.ts", "react-shared"],
  // 只是转出 domMax 的一行模块，并入 features chunk，免得单独产出一个空壳文件。
  ["/components/motion-features-max.ts", "framer-motion"],
  ["/app/share/styles.css", "share-common"], // share 两页共享样式
  // 全站基础样式由各框架挂载器引入，独立成 chunk，避免随挂载器各产出一份。
  ["/app/globals.css", "globals"],
];

function chunkName(id: string) {
  const normalized = id.split("?")[0].replaceAll("\\", "/");
  // 所有动态 import 都依赖 Vite 的 preload helper；若不指定，它会被并进某个先用到
  // 它的业务 chunk，使所有页面间接依赖该 chunk 及其框架运行时。
  // 打包器自身的模块互操作 runtime 不经过分组，固定输出为独立的 rolldown-runtime chunk。
  if (normalized.endsWith("vite/preload-helper.js")) return "runtime";
  const packageName = modulePackageName(normalized);

  if (packageName) {
    // vue 的运行时拆在多个 @vue/* 包里，合成一个 chunk，与 react chunk 对称。
    if (packageName.startsWith("@vue/")) return "vue";
    return VENDOR_CHUNK[packageName];
  }

  return APP_CHUNK.find(([suffix]) => normalized.endsWith(suffix))?.[1];
}

// 分组会连同依赖一起收入模块（includeDependenciesRecursively 默认开启），先处理
// 的组先认领。被各处依赖的底层 chunk 必须优先，否则会被上层 chunk 吞掉，例如
// react 的 jsx-runtime 被并进 framer-motion，使所有 React 页面都依赖 framer-motion；
// globals.css 被并进 vue（Vue 挂载器引入了它），使 React 页面依赖 vue chunk。
const BASE_CHUNKS = ["runtime", "globals", "react", "vue"];
const isMotionModule = (id: string) => chunkName(id) === "framer-motion";
const chunkGroups = [
  ...BASE_CHUNKS.map((name, index) => ({
    name,
    test: (id: string) => chunkName(id) === name,
    priority: BASE_CHUNKS.length - index + 1,
  })),
  // 页面首屏只静态引用 `m` + LazyMotion，动画 features 经动态 import 加载
  // （components/motion-features.ts）。按是否首屏可达拆成两个 chunk，否则合成一个
  // 会把 features 又带回首屏。
  { name: "framer-motion", test: isMotionModule, tags: ["$initial" as const], priority: 1 },
  { name: "framer-motion-features", test: isMotionModule, priority: 1 },
  { name: (id: string) => chunkName(id) ?? null, priority: 0 },
];

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
        codeSplitting: { groups: chunkGroups },
      },
    },
  },
});
