<script setup vapor lang="ts">
import HandwritingTitle from "./HandwritingTitle.vue";
import ProfileAvatar from "./ProfileAvatar.vue";
import SocialLinks from "./SocialLinks.vue";

const CRAYON_COLORS = ["#5CE0D8", "#FF8FAB", "#FFD166", "#A78BFA"];
// 名字下方的蜡笔色条，与 CRAYON_COLORS 一一对应。
const CRAYON_BAR_WIDTHS = ["w-16", "w-10", "w-6", "w-2"];
</script>

<template>
  <div class="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12 md:gap-16">
    <!-- 左侧：头像区域 -->
    <div
      class="md:col-span-5 md:col-start-1 md:row-start-1 pc-entry"
      style="animation: pc-slide-left 0.8s ease-out both"
    >
      <ProfileAvatar />
    </div>

    <div
      class="md:col-span-7 md:col-start-6 md:row-start-1 md:pt-12 pc-entry"
      style="animation: pc-fade-up 0.8s ease-out 0.3s both"
    >
      <div class="relative mb-8">
        <!-- 字号决定手写 SVG 的尺寸（SVG 宽高以 em 表示） -->
        <h1 class="text-6xl leading-tight text-foreground md:text-7xl lg:text-8xl">
          <HandwritingTitle />
        </h1>

        <!-- 名字下方的蜡笔色条 — 童趣梦境感 -->
        <div
          class="mt-3 flex items-center gap-1.5 pc-entry"
          style="animation: pc-scale-x 0.6s ease-out 0.8s both; transform-origin: left"
        >
          <div
            v-for="(color, i) in CRAYON_COLORS"
            :key="color"
            :class="`h-2 ${CRAYON_BAR_WIDTHS[i]} rounded-full`"
            :style="{ background: color }"
          />
        </div>

        <div
          class="absolute -right-8 top-1/3 h-16 w-16 rounded-full pc-entry"
          style="animation: pc-pop 0.5s ease-out 1s both; background: #ffd16620"
        />
      </div>

      <div
        class="relative mb-12 pl-6 pc-entry"
        style="animation: pc-tilt-in 0.6s ease-out 0.9s both; border-left: 4px solid #5ce0d860"
      >
        <p class="text-pretty text-xl leading-relaxed text-muted-foreground md:text-2xl">
          Frontend Developer
        </p>
        <div class="mt-4 flex gap-2">
          <div
            v-for="color in CRAYON_COLORS"
            :key="color"
            class="h-3 w-3 rounded-full"
            :style="{ background: color }"
          />
        </div>
      </div>

      <div class="pc-entry" style="animation: pc-fade-up-sm 0.6s ease-out 1.1s both">
        <SocialLinks />
      </div>
    </div>

    <!-- 底部装饰性文字 -->
    <div
      class="md:col-span-12 md:row-start-2 pc-entry"
      style="animation: pc-fade-in 0.8s ease-out 1.3s both"
    >
      <div class="flex items-center justify-center gap-8 pt-12 md:justify-end md:pt-0">
        <div class="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
        <p class="font-mono text-sm text-muted-foreground">CREATIVE MIND</p>
        <div class="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>
    </div>
  </div>
</template>
