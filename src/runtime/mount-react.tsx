import { StrictMode, type ComponentType } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { initGlobalScripts } from "./global-scripts";

import "@/app/globals.css";

export function mountReact(Page: ComponentType) {
  const root = document.getElementById("root")!;
  const app = (
    <StrictMode>
      <Page />
    </StrictMode>
  );

  // SSG 产物里 #root 已有预渲染 HTML，走 hydrate；dev 下没有预渲染，直接渲染。
  if (root.childElementCount > 0) {
    hydrateRoot(root, app);
  } else {
    createRoot(root).render(app);
  }
  initGlobalScripts();
}
