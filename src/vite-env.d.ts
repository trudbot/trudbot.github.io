/// <reference types="vite-plus/client" />

// tsc 不解析 SFC，只能把 .vue 视为通用组件；模板与 <script setup> 内部的类型
// 不在 `pnpm typecheck` 的覆盖范围内。
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
