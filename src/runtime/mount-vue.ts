import { createApp, createSSRApp, type Component } from "vue";
import { initGlobalScripts } from "./global-scripts";

import "@/app/globals.css";

export function mountVue(Page: Component) {
  const root = document.getElementById("root")!;
  // SSG 产物里 #root 已有预渲染 HTML，用 createSSRApp 进行 hydrate；
  // dev 下没有预渲染，对空容器 hydrate 会报 mismatch，因此改用 createApp。
  const app = root.childElementCount > 0 ? createSSRApp(Page) : createApp(Page);
  app.mount(root);
  initGlobalScripts();
}
