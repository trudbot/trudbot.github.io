import { ensureUid, trackDisplay } from "@/lib/analytics";

let initialized = false;

// 每个页面挂载后都会调用，与页面使用的 UI 框架无关；必须保持零框架依赖，
// 否则会把某个框架的运行时带进所有页面的产物。
export function initGlobalScripts() {
  if (initialized) return;
  initialized = true;
  // Resolve the persistent visitor id early (cached in localStorage) so
  // events from here on carry `uid`. Non-blocking and failure-safe.
  void ensureUid();
  // One page-view per document load; this is the single place that covers
  // display tracking site-wide.
  trackDisplay("page_view", { referrer: document.referrer || undefined });

  // 仅在支持 WebMCP（存在 document.modelContext）的浏览器里按需加载工具注册。
  const modelContext = (document as Document & { modelContext?: unknown }).modelContext;
  if (modelContext) {
    import("@/web-mcp").then(({ registerWebMcp }) => registerWebMcp());
  }
}
