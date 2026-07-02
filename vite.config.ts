import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
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

function chunkName(id: string) {
  const packageName = modulePackageName(id);

  if (packageName === "react-json-view") return "react-json-view";
  if (packageName === "json5") return "json5";
  if (packageName === "jsonrepair") return "jsonrepair";
  if (packageName === "react" || packageName === "react-dom" || packageName === "scheduler")
    return "react";
  if (packageName === "sonner") return "sonner";
  if (
    packageName?.startsWith("@radix-ui/") ||
    packageName === "class-variance-authority" ||
    packageName === "clsx" ||
    packageName === "tailwind-merge"
  )
    return "ui-utils";
  if (packageName === "@zumer/snapdom") return "snapdom";
  if (packageName === "three") return "three";
  if (
    packageName === "lz-string" ||
    packageName === "qrcode-generator" ||
    id.includes("/app/share/styles.css")
  )
    return "share-common";
}

const pages = discoverPages({ root: __dirname });
const input = Object.fromEntries(
  pages.map((page) => [page.entryName, path.resolve(__dirname, page.entryFile)]),
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
  plugins: [react(), devPageEntries()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    outDir: "out",
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      input,
      output: {
        manualChunks: chunkName,
      },
    },
  },
});
