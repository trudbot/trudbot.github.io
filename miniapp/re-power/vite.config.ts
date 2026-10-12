import path from "node:path";
import { miniappManifest } from "@heybox/hb-sdk/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const repoRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  base: "./",
  plugins: [react(), miniappManifest()],
  resolve: {
    // 关卡引擎与关卡数据和主站 /net 原型共用，经 `@` 从仓库根导入。
    alias: { "@": repoRoot },
    dedupe: ["react", "react-dom"],
  },
  css: {
    // 内联配置阻止 Vite 向上找到主站的 postcss.config.mjs，避免主站 Tailwind 处理本包样式。
    postcss: {},
  },
});
