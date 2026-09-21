"use client";

import { useEffect, useState, type ComponentType } from "react";
import { AvatarStatic } from "@/components/avatar-shared";

/*
 * 首屏只渲染静态头像（AvatarStatic，不含 framer-motion），保证 LCP 头像图片立即可见、
 * 且不把 framer-motion 计入首屏关键 JS。hydration 后的空闲时段再按需动态加载
 * framer-motion 版交互增强（avatar-animated），并替换渲染。
 * 尊重 prefers-reduced-motion：开启时不加载动画增强。
 */
export function AvatarInteractive() {
  const [Animated, setAnimated] = useState<ComponentType | null>(null);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    const load = () => {
      import("@/components/avatar-animated").then((mod) => {
        if (!cancelled) setAnimated(() => mod.default);
      });
    };

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idle =
      typeof win.requestIdleCallback === "function"
        ? win.requestIdleCallback(load)
        : window.setTimeout(load, 300);

    return () => {
      cancelled = true;
      if (typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idle as number);
      } else {
        window.clearTimeout(idle as number);
      }
    };
  }, []);

  if (Animated) return <Animated />;
  return <AvatarStatic />;
}
