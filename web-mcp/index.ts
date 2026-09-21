import { tools } from "./tools";

// WebMCP 命令式 API 的工具注册入口挂在 document.modelContext 上（实验性、非标准）。
// 规范：https://developer.chrome.com/docs/ai/webmcp/imperative-api
interface ModelContext {
  registerTool(tool: unknown, options?: { signal?: AbortSignal }): void;
}

export function registerWebMcp() {
  const modelContext = (document as Document & { modelContext?: ModelContext }).modelContext;
  if (!modelContext) return;
  tools.forEach((tool) => modelContext.registerTool(tool));
}
