import { createVaporApp, createVaporSSRApp, type Component, type VaporComponent } from "vue";
import { initGlobalScripts } from "./global-scripts";

import "@/app/globals.css";

// 只引用 Vapor 运行时的挂载 API，产物里不会带上 VDOM 渲染器。
// 参数取 Component：src/vite-env.d.ts 的 `*.vue` 声明无法区分 Vapor 与 VDOM SFC。
// 生成的 entry 只会把 `<script vapor>` 页面交给这里（见 scripts/discover-pages.mjs），
// 因此断言成立。
export function mountVueVapor(Page: Component) {
  const Vapor = Page as VaporComponent;
  const root = document.getElementById("root")!;
  // SSG 产物里 #root 已有预渲染 HTML，用 createVaporSSRApp 进行 hydrate；
  // dev 下没有预渲染，对空容器 hydrate 会报 mismatch，因此改用 createVaporApp。
  const app = root.childElementCount > 0 ? createVaporSSRApp(Vapor) : createVaporApp(Vapor);
  app.mount(root);
  initGlobalScripts();
}
