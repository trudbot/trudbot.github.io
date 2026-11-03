import { miniappManifest } from "@heybox/hb-sdk/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  // SDK 插件注入的 Runtime Gate 在 App 外会拦下页面；`pnpm web` 用 web 模式在普通浏览器里试玩。
  plugins: mode === "web" ? [] : [miniappManifest()],
  css: {
    // 内联配置阻止 Vite 向上找到主站的 postcss.config.mjs，避免主站 Tailwind 处理本包样式。
    postcss: {},
  },
  build: {
    // three 本体就超过默认告警阈值，整包离线运行，不需要为此拆分。
    chunkSizeWarningLimit: 1200,
  },
}));
