import path from "node:path";
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
  "class-variance-authority": "ui-utils",
  clsx: "ui-utils",
  "tailwind-merge": "ui-utils",
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

// 本仓库源码 → chunk 名。用于：避免无谓的小 chunk（如 cn()）、以及给
// 与三方包重名的本地模块单独命名（如 sonner 外壳 → toaster，区分 sonner 库）。
const APP_CHUNK: Array<[suffix: string, chunk: string]> = [
  ["/lib/utils.ts", "ui-utils"], // cn()：只与 ui 组件同载，并入 ui-utils
  ["/components/ui/sonner.tsx", "toaster"], // 懒加载 Toaster 外壳，与 sonner 库(sonner chunk)区分
  ["/app/share/styles.css", "share-common"], // share 两页共享样式
];

function chunkName(id: string) {
  const normalized = id.split("?")[0].replaceAll("\\", "/");
  const packageName = modulePackageName(normalized);

  if (packageName) {
    if (packageName.startsWith("@radix-ui/")) return "ui-utils";
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

      return html.replace(
        "<!--page-assets-->",
        `<script type="module" src="/${entryFile}"></script>`,
      );
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
  plugins: [devPageEntries()],
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
    // Three.js is isolated in a chunk loaded only when the glass-shatter effect is triggered.
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
