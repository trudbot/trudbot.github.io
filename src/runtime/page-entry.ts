import type { ComponentType } from "react";
import type { Component } from "vue";

// 与 scripts/discover-pages.mjs 的 PAGE_FRAMEWORKS 一一对应。
export type PageEntry =
  | { framework: "react"; component: ComponentType }
  | { framework: "vue" | "vue-vapor"; component: Component };
