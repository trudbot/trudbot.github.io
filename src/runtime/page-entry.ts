import type { ComponentType } from "react";
import type { Component } from "vue";

// 与 scripts/discover-pages.mjs 的 PAGE_FRAMEWORKS 一一对应。
export type PageEntry =
  | { framework: "react"; component: ComponentType }
  | { framework: "vue" | "vue-vapor"; component: Component };

// Vue 页面 SSR 时的上下文，组件经 useSSRContext 取得。head 中的标签由 scripts/ssg.mjs
// 写入页面 <head>：Vue 不像 React 19 那样自动提升 <link rel="preload"> 等资源提示。
export interface PageSSRContext {
  head: string[];
}

// 每个页面的 SSR 结果；head 为需要插入 <head> 的额外标签。
export interface PageRenderResult {
  html: string;
  head: string[];
}
