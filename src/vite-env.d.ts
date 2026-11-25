/// <reference types="vite-plus/client" />

// 额外的 query 让同一文件的动态 import 成为独立模块（见 components/handwriting-title.tsx），
// 内置的 `*?raw` 声明匹配不到。
declare module "*?raw&lazy" {
  const content: string;
  export default content;
}

// tsc 不解析 SFC，只能把 .vue 视为通用组件；模板与 <script setup> 内部的类型
// 不在 `pnpm typecheck` 的覆盖范围内。
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent;
  export default component;
}
