"use client";
import { useEffect } from "react";
import { trackDisplay } from "@/lib/analytics";

let initialized = false;

export default function GlobalScripts() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;
    // One page-view per document load. GlobalScripts mounts on every page, so
    // this is the single place that covers display tracking site-wide.
    trackDisplay("page_view", { referrer: document.referrer || undefined });

    // 仅在支持 WebMCP（存在 document.modelContext）的浏览器里按需加载工具注册。
    const modelContext = (document as Document & { modelContext?: unknown }).modelContext;
    if (modelContext) {
      import("@/web-mcp").then(({ registerWebMcp }) => registerWebMcp());
    }
  }, []);

  return null;
}
