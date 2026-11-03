import path from "node:path";
import { miniappManifest } from "@heybox/hb-sdk/vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => ({
  base: "./",
  // SDK 插件注入的 Runtime Gate 在 App 外会拦下页面；web 模式产出普通浏览器可用的版本。
  plugins: mode === "web" ? [react(), tailwindcss()] : [react(), tailwindcss(), miniappManifest()],
  resolve: {
    // 与主站保持同一个 `@` 语义，复用的 components/lib 内部也依赖 `@/...` 导入。
    alias: { "@": repoRoot },
    // 复用的仓库根代码从根 node_modules 解析 React，必须收敛为同一实例。
    dedupe: ["react", "react-dom"],
  },
  css: {
    // 内联配置阻止 Vite 向上找到主站的 postcss.config.mjs，避免 Tailwind 被重复处理。
    postcss: {},
  },
}));
