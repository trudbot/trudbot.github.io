"use client";

import { useEffect, useRef } from "react";
import svg from "./trudbot-handwriting.svg?raw";

/*
 * 首页标题 `@trudbot` 的手写动画。SVG 由 scripts/handwriting-svg.mjs 生成，改样式请改脚本后重新生成。
 *   - 内联而非 <img>：这样 currentColor 能拿到标题的 text-foreground，跟随深浅主题。
 *   - 动画是 SMIL（写一遍后 freeze），CSS 的 prefers-reduced-motion 关不掉，
 *     所以在客户端把时间轴直接拨到结尾。
 *   - SVG 本身 aria-hidden，文字由 sr-only 提供给读屏与搜索引擎。
 */
export function HandwritingTitle() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current?.querySelector("svg");
    if (!el || !window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.pauseAnimations();
    // 远超动画总时长即可：所有 animate/set 都是 fill="freeze"，停在写完的状态
    el.setCurrentTime(1e4);
  }, []);

  return (
    <>
      <span className="sr-only">@trudbot</span>
      <span
        ref={ref}
        className="inline-block align-middle [&>svg]:block"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </>
  );
}
