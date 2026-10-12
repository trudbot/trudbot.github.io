import { StrictMode } from "react";
import { renderToString as renderReactToString } from "react-dom/server";
import { createSSRApp } from "vue";
import { renderToString as renderVueToString } from "vue/server-renderer";
import type { PageEntry } from "./runtime/page-entry";
import { pages, routesToPrerender } from "./generated/pages";

export { routesToPrerender };

// 仅在构建期由 scripts/ssg.mjs 在 Node 中执行，同时打包多个框架的服务端渲染器
// 不会影响浏览器产物。
function renderPage(page: PageEntry): Promise<string> | string {
  switch (page.framework) {
    case "react":
      return renderReactToString(
        <StrictMode>
          <page.component />
        </StrictMode>,
      );
    // Vapor SFC 在 SSR 编译下产出的是常规 ssrRender，与 VDOM 组件走同一个渲染器；
    // 两者只在客户端挂载方式上不同。
    case "vue":
    case "vue-vapor":
      return renderVueToString(createSSRApp(page.component));
  }
}

export async function render(url: string): Promise<string> {
  const page = pages[url];
  if (!page) throw new Error(`Unknown prerender route: ${url}`);

  return renderPage(page);
}
