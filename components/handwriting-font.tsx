"use client";

import { useEffect } from "react";
import caveat400 from "@fontsource/caveat/files/caveat-latin-400-normal.woff2?url";
import caveat700 from "@fontsource/caveat/files/caveat-latin-700-normal.woff2?url";

/*
 * 手写体（Caveat）对首屏并非必需。这里在 hydration 后的空闲时段，用 FontFace API
 * 按需拉取字体文件（display: swap）。
 *   - 之所以走 FontFace 而不是 import 字体 CSS：本项目 SSG 会把「动态 import 的 CSS」
 *     提升进页面 <head>，那样字体又会变成首屏阻塞资源。用 `?url` 只拿到资源地址，
 *     字体字节仅在 FontFace.load() 时才下载。
 *   - 加载完成前，font-handwriting 走 --font-caveat 里的回退（默认字体）；
 *     加载完成后自动切换到 Caveat。
 * 加载首页用到的字重：常规 400 与标题的 700。
 */
const FONT_FACES: ReadonlyArray<readonly [src: string, weight: string]> = [
  [caveat400, "400"],
  [caveat700, "700"],
];

export function HandwritingFont() {
  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) return;
    let cancelled = false;

    const load = () => {
      if (cancelled) return;
      for (const [src, weight] of FONT_FACES) {
        const face = new FontFace("Caveat", `url(${src}) format("woff2")`, {
          weight,
          display: "swap",
        });
        face
          .load()
          .then((loaded) => {
            if (!cancelled) document.fonts.add(loaded);
          })
          .catch(() => {
            /* 字体加载失败时保持回退字体即可 */
          });
      }
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idle =
      typeof win.requestIdleCallback === "function"
        ? win.requestIdleCallback(load)
        : window.setTimeout(load, 200);

    return () => {
      cancelled = true;
      if (typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idle as number);
      } else {
        window.clearTimeout(idle as number);
      }
    };
  }, []);

  return null;
}
