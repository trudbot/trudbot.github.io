<script setup vapor lang="ts">
import "./home.css";
import { onBeforeUnmount, onMounted } from "vue";
import { installShatterTrigger } from "@/lib/glass-shatter/trigger";
import BottomDecoration from "./BottomDecoration.vue";
import FloatingShapes from "./FloatingShapes.vue";
import GamesSection from "./GamesSection.vue";
import ProfileCard from "./ProfileCard.vue";
import { loadHandwritingFont } from "./handwriting-font";

const cleanups: Array<() => void> = [];

onMounted(() => {
  cleanups.push(loadHandwritingFont());
  // 隐藏彩蛋：在页面上连续快速点击会让页面像玻璃一样碎裂，规则见 lib/glass-shatter/trigger.ts。
  cleanups.push(installShatterTrigger());
});

onBeforeUnmount(() => {
  for (const cleanup of cleanups) cleanup();
});
</script>

<template>
  <!-- touch-manipulation：连点是破碎彩蛋的触发方式，不能被 iOS 双击缩放吃掉。 -->
  <main class="relative min-h-screen touch-manipulation overflow-hidden bg-background">
    <FloatingShapes />
    <div class="relative z-10 flex min-h-screen flex-col p-8 md:p-16 pb-32">
      <ProfileCard />
      <GamesSection />
      <BottomDecoration />
    </div>
  </main>
</template>
