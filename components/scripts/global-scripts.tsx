"use client";
import { useEffect } from "react";

let initialized = false;

export default function GlobalScripts() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    // 仅在支持 WebMCP（存在 document.modelContext）的浏览器里按需加载工具注册。
    const modelContext = (document as Document & { modelContext?: unknown }).modelContext;
    if (modelContext) {
      import("@/web-mcp").then(({ registerWebMcp }) => registerWebMcp());
    }
  }, []);

  return null;
}
