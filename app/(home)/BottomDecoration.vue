<script setup vapor lang="ts">
const CLIP_PATHS = {
  square: "none",
  circle: "circle(50%)",
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
};

const tiles: Array<{ delay: number; color: string; shape: keyof typeof CLIP_PATHS }> = [
  { delay: 1.6, color: "bg-primary/20", shape: "square" },
  { delay: 1.7, color: "bg-accent/20", shape: "circle" },
  { delay: 1.8, color: "bg-secondary/20", shape: "triangle" },
  { delay: 1.9, color: "bg-highlight/20", shape: "diamond" },
  { delay: 2.0, color: "bg-primary/10", shape: "square" },
  { delay: 2.1, color: "bg-accent/10", shape: "circle" },
];
</script>

<template>
  <div class="mt-auto pt-24 md:pt-32">
    <!-- 装饰性几何图案区域 -->
    <div class="relative mx-auto max-w-7xl">
      <!-- 大型装饰文字 -->
      <div class="mb-16 overflow-hidden bd-entry bd-fade-up" style="--bd-delay: 1.5s">
        <h2
          class="font-mono text-[8rem] font-bold leading-none tracking-tighter text-muted/5 md:text-[12rem] lg:text-[16rem]"
        >
          CREATIVE
        </h2>
      </div>

      <!-- 几何装饰网格 -->
      <div class="grid grid-cols-3 gap-4 md:grid-cols-6 md:gap-6">
        <div
          v-for="(tile, index) in tiles"
          :key="index"
          class="relative aspect-square bd-entry bd-pop"
          :style="{ '--bd-delay': `${tile.delay}s` }"
        >
          <div
            :class="`h-full w-full ${tile.color}`"
            :style="{ clipPath: CLIP_PATHS[tile.shape] }"
          />
        </div>
      </div>

      <!-- 底部信息栏 -->
      <div
        class="mt-16 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 md:flex-row bd-entry bd-fade-in"
        style="--bd-delay: 2.2s"
      >
        <div class="flex items-center gap-4">
          <div class="h-2 w-2 animate-pulse bg-primary" />
          <p class="font-mono text-sm text-muted-foreground">Available for creative projects</p>
        </div>

        <div class="flex items-center gap-6">
          <div
            class="h-8 w-8 border-2 border-accent bd-spin"
            style="clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
          />
          <p class="font-mono text-sm text-muted-foreground">© 2025 trudbot</p>
        </div>
      </div>
    </div>
  </div>
</template>
