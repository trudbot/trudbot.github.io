<script setup vapor lang="ts">
import { onBeforeUnmount, onMounted, useTemplateRef } from "vue";
import ssrSvg from "./trudbot-handwriting.svg?raw";

/*
 * 首页标题 `@trudbot` 的手写动画。SVG 由 scripts/handwriting-svg.mjs 生成，改样式请改脚本后重新生成。
 *   - 内联而非 <img>：这样 currentColor 能拿到标题的 text-foreground，跟随深浅主题。
 *   - SVG 有几十 KB，只在 SSR 构建里输出进 HTML；客户端构建中 svgMarkup 被常量折叠为空串，
 *     SVG 字符串随之被 tree-shake。不能用 v-html：hydration 时 Vapor 会照常写 innerHTML，
 *     把预渲染的 SVG 清空。因此用 vSsrHtml 指令：SSR 经 getSSRProps 把内容输出为子节点，
 *     客户端是空操作（Vapor 的自定义指令是函数，SSR 只认带 getSSRProps 的对象）。
 *   - 没有预渲染内容时（dev）才按需加载 SVG 填进去。
 *   - 动画是 SMIL（写一遍后 freeze），CSS 的 prefers-reduced-motion 关不掉，
 *     所以在客户端把时间轴直接拨到结尾。
 *   - SVG 本身 aria-hidden，文字由 sr-only 提供给读屏与搜索引擎。
 */
const svgMarkup = import.meta.env.SSR ? ssrSvg : "";
const vSsrHtml = import.meta.env.SSR
  ? { getSSRProps: ({ value }: { value: string }) => ({ innerHTML: value }) }
  : () => {};

const host = useTemplateRef<HTMLSpanElement>("host");
let cancelled = false;

function freezeIfReducedMotion(container: HTMLElement) {
  const el = container.querySelector("svg");
  if (!el || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  el.pauseAnimations();
  // 远超动画总时长即可：所有 animate/set 都是 fill="freeze"，停在写完的状态
  el.setCurrentTime(1e4);
}

onMounted(() => {
  const container = host.value;
  if (!container) return;

  if (container.firstElementChild) {
    freezeIfReducedMotion(container);
  } else {
    // 与顶部静态 import 用不同的 id，否则二者解析为同一模块，字符串又会被打进首屏 chunk。
    void import("./trudbot-handwriting.svg?raw&lazy").then(({ default: svg }) => {
      if (cancelled) return;
      container.innerHTML = svg;
      freezeIfReducedMotion(container);
    });
  }
});

onBeforeUnmount(() => {
  cancelled = true;
});
</script>

<template>
  <span class="sr-only">@trudbot</span>
  <span ref="host" class="inline-block align-middle [&>svg]:block" v-ssr-html="svgMarkup" />
</template>
