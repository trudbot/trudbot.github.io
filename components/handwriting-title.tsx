"use client";

import { useEffect, useRef } from "react";
import ssrSvg from "./trudbot-handwriting.svg?raw";

// SVG 有几十 KB，只在 SSR 构建里内联进 HTML。客户端构建中这个分支被常量折叠，
// 字符串随之被 tree-shake，不会再随页面 JS 下载一遍。
const svgMarkup = import.meta.env.SSR ? ssrSvg : "";

/*
 * 首页标题 `@trudbot` 的手写动画。SVG 由 scripts/handwriting-svg.mjs 生成，改样式请改脚本后重新生成。
 *   - 内联而非 <img>：这样 currentColor 能拿到标题的 text-foreground，跟随深浅主题。
 *   - hydration 不会改写 dangerouslySetInnerHTML 的内容，客户端传空串即可沿用 SSG 输出的
 *     SVG 节点；没有预渲染内容时（dev 或客户端首次挂载）才按需加载 SVG 填进去。
 *   - 动画是 SMIL（写一遍后 freeze），CSS 的 prefers-reduced-motion 关不掉，
 *     所以在客户端把时间轴直接拨到结尾。
 *   - SVG 本身 aria-hidden，文字由 sr-only 提供给读屏与搜索引擎。
 */
export function HandwritingTitle() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let cancelled = false;

    const freezeIfReducedMotion = () => {
      const el = container.querySelector("svg");
      if (!el || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      el.pauseAnimations();
      // 远超动画总时长即可：所有 animate/set 都是 fill="freeze"，停在写完的状态
      el.setCurrentTime(1e4);
    };

    if (container.firstElementChild) {
      freezeIfReducedMotion();
    } else {
      // 与顶部静态 import 用不同的 id，否则二者解析为同一模块，字符串又会被打进首屏 chunk。
      void import("./trudbot-handwriting.svg?raw&lazy").then(({ default: svg }) => {
        if (cancelled) return;
        container.innerHTML = svg;
        freezeIfReducedMotion();
      });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <span className="sr-only">@trudbot</span>
      <span
        ref={ref}
        className="inline-block align-middle [&>svg]:block"
        dangerouslySetInnerHTML={{ __html: svgMarkup }}
        suppressHydrationWarning
      />
    </>
  );
}
