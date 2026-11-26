<script setup vapor lang="ts">
import { onBeforeUnmount, onMounted, useSSRContext, useTemplateRef } from "vue";
import type { PageSSRContext } from "@/src/runtime/page-entry";

/*
 * 首屏只渲染静态头像，保证 LCP 图片立即可见、且交互动画不计入首屏 JS。
 * hydration 后的空闲时段再加载 ./avatar-animated，在这份 DOM 上补齐动画元素。
 * 尊重 prefers-reduced-motion：开启时不加载动画增强。
 * 结构（菱形、三角形、头像容器 > 圆形相框 > 图片）是 avatar-animated.ts 的约定，改动需同步。
 */

// 头像显示为 192px（md 以上 256px），按 2x 屏准备了两档；1x 屏会直接选 384。
const AVATAR_BASE = "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/2026/11/25";
const AVATAR_384 = `${AVATAR_BASE}/1795598471447_1782996318044_202407082112768_%281%29.jpg`;
const AVATAR_512 = `${AVATAR_BASE}/1795598471449_1782996318044_202407082112768_%282%29.jpg`;
const AVATAR_SRCSET = `${AVATAR_384} 384w, ${AVATAR_512} 512w`;
const AVATAR_SIZES = "(min-width: 768px) 256px, 192px";

if (import.meta.env.SSR) {
  // LCP 图片在 <head> 预加载，让它与首屏 CSS/JS 同时开始下载。
  const context = useSSRContext<PageSSRContext>();
  context?.head.push(
    `<link rel="preload" as="image" imagesrcset="${AVATAR_SRCSET}" imagesizes="${AVATAR_SIZES}" fetchpriority="high">`,
  );
}

const root = useTemplateRef<HTMLDivElement>("root");
let cleanup: (() => void) | undefined;
let cancelLoad: (() => void) | undefined;

onMounted(() => {
  const el = root.value;
  if (!el || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  let cancelled = false;
  const load = () => {
    void import("./avatar-animated").then(({ enhanceAvatar }) => {
      if (!cancelled) cleanup = enhanceAvatar(el);
    });
  };
  const idle =
    typeof window.requestIdleCallback === "function"
      ? window.requestIdleCallback(load)
      : window.setTimeout(load, 300);
  cancelLoad = () => {
    cancelled = true;
    if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
  };
});

onBeforeUnmount(() => {
  cancelLoad?.();
  cleanup?.();
});
</script>

<template>
  <div ref="root" class="relative inline-block">
    <div class="absolute -left-8 -top-8 h-32 w-32 border-4 border-primary/30 clip-diamond" />
    <div class="absolute -bottom-6 -right-6 h-24 w-24 bg-accent/20 clip-triangle" />
    <div class="relative">
      <div class="relative rounded-full">
        <!-- 头像本身就招人点，点它给破碎彩蛋（lib/glass-shatter/trigger.ts）攒更多压力。 -->
        <div
          data-shatter-weight="2"
          class="relative flex h-48 w-48 shrink-0 items-center justify-center overflow-hidden rounded-full border-8 border-background shadow-2xl md:h-64 md:w-64"
        >
          <!-- 加载中 / 加载失败时的占位，位于图片下方 -->
          <div
            class="absolute inset-0 flex items-center justify-center bg-background/5 backdrop-blur-xl"
          >
            <svg
              viewBox="0 0 100 100"
              class="h-full w-full p-8"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <g class="animate-[pulse_4s_ease-in-out_infinite]">
                <path d="M20 30 Q35 25 48 30 L48 45 Q35 50 20 45 Z" class="fill-primary" />
                <rect
                  x="52"
                  y="26"
                  width="28"
                  height="18"
                  rx="9"
                  class="fill-secondary"
                  transform="rotate(-4 66 35)"
                />
                <rect
                  x="42"
                  y="52"
                  width="16"
                  height="32"
                  rx="6"
                  class="fill-accent"
                  transform="rotate(2 50 68)"
                />
              </g>
              <circle cx="28" cy="72" r="3" class="fill-primary/60 animate-[bounce_3s_infinite]" />
              <circle cx="78" cy="62" r="4" class="fill-secondary/50 animate-[pulse_2s_infinite]" />
              <circle cx="22" cy="22" r="2.5" class="fill-accent/60 animate-[ping_4s_infinite]" />
            </svg>
          </div>
          <img
            :src="AVATAR_512"
            :srcset="AVATAR_SRCSET"
            :sizes="AVATAR_SIZES"
            width="512"
            height="512"
            alt="trudbot"
            fetchpriority="high"
            decoding="async"
            class="relative z-10 h-full w-full object-cover"
          />
        </div>
      </div>
    </div>
  </div>
</template>
