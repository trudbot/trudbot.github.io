import path from "node:path";
import { miniappManifest } from "@heybox/hb-sdk/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig(({ mode }) => ({
  base: "./",
  // SDK 插件注入的 Runtime Gate 在 App 外会拦下页面；web 模式产出普通浏览器可用的版本。
  plugins: mode === "web" ? [react()] : [react(), miniappManifest()],
  resolve: {
    // 关卡引擎与关卡数据和主站 /net 原型共用，经 `@` 从仓库根导入。
    alias: { "@": repoRoot },
    dedupe: ["react", "react-dom"],
  },
  css: {
    // 内联配置阻止 Vite 向上找到主站的 postcss.config.mjs，避免主站 Tailwind 处理本包样式。
    postcss: {},
  },
}));
