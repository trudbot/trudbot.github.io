import { StrictMode } from "react";
import { renderToString as renderReactToString } from "react-dom/server";
import { createSSRApp } from "vue";
import { renderToString as renderVueToString } from "vue/server-renderer";
import type { PageEntry, PageRenderResult, PageSSRContext } from "./runtime/page-entry";
import { pages, routesToPrerender } from "./generated/pages";

export { routesToPrerender };

// 仅在构建期由 scripts/ssg.mjs 在 Node 中执行，同时打包多个框架的服务端渲染器
// 不会影响浏览器产物。
async function renderPage(page: PageEntry): Promise<PageRenderResult> {
  switch (page.framework) {
    case "react":
      return {
        html: renderReactToString(
          <StrictMode>
            <page.component />
          </StrictMode>,
        ),
        head: [],
      };
    // Vapor SFC 在 SSR 编译下产出的是常规 ssrRender，与 VDOM 组件走同一个渲染器；
    // 两者只在客户端挂载方式上不同。
    case "vue":
    case "vue-vapor": {
      const context: PageSSRContext = { head: [] };
      const html = await renderVueToString(createSSRApp(page.component), context);
      return { html, head: context.head };
    }
  }
}

export async function render(url: string): Promise<PageRenderResult> {
  const page = pages[url];
  if (!page) throw new Error(`Unknown prerender route: ${url}`);

  return renderPage(page);
}
