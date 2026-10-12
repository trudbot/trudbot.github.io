<script setup vapor lang="ts">
import "./styles.css";
import { onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from "vue";
import type { TrudbotViewer } from "./viewer";

// Served from OSS CDN to keep the ~3MB binary out of the repo. The bucket must
// allow cross-origin GET (Access-Control-Allow-Origin) for the site + localhost,
// or the browser blocks this fetch.
const MODEL_URL =
  "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/2026/09/24/1790243533119_trudbot-full.glb";

// Chinese labels for the clip names baked into the GLB.
const CLIP_LABELS: Record<string, string> = {
  idle: "待机",
  run: "跑步",
  jump: "跳跃",
  dance_02: "跳舞",
  bow: "鞠躬",
};

type Status = "loading" | "ready" | "error";

const canvas = useTemplateRef<HTMLCanvasElement>("canvas");
// viewer 持有 three.js 场景，不需要也不应被深度代理。
const viewer = shallowRef<TrudbotViewer | null>(null);
const status = ref<Status>("loading");
const clips = ref<string[]>([]);
const active = ref<string | null>(null);
const autoRotate = ref(true);
let disposed = false;

onMounted(() => {
  document.title = "Trudbot 3D 模型";
  const el = canvas.value;
  if (!el) return;

  // three.js 体积大，只在客户端挂载后加载，不进入页面首屏 chunk。
  import("./viewer")
    .then(async ({ TrudbotViewer }) => {
      if (disposed) return;
      const instance = new TrudbotViewer(el);
      viewer.value = instance;
      const names = await instance.load(MODEL_URL);
      if (disposed) return;
      clips.value = names;
      active.value = names.includes("idle") ? "idle" : (names[0] ?? null);
      status.value = "ready";
    })
    .catch((err) => {
      console.error("failed to load trudbot model", err);
      if (!disposed) status.value = "error";
    });
});

onBeforeUnmount(() => {
  disposed = true;
  viewer.value?.dispose();
  viewer.value = null;
});

function selectClip(name: string) {
  viewer.value?.play(name);
  active.value = name;
}

function toggleAutoRotate() {
  autoRotate.value = !autoRotate.value;
  viewer.value?.setAutoRotate(autoRotate.value);
}
</script>

<template>
  <main class="trudbot-page">
    <canvas ref="canvas" class="trudbot-canvas" aria-label="Trudbot 3D 模型" />

    <header class="trudbot-header">
      <h1 class="trudbot-title">Trudbot 3D 模型</h1>
      <p class="trudbot-subtitle">拖动旋转 · 滚轮缩放 · 点击下方播放动作</p>
    </header>

    <p class="trudbot-hint">
      拖动：旋转视角
      <br />
      滚轮 / 双指：缩放
      <br />
      右键拖动：平移
    </p>

    <div v-if="status === 'ready'" class="trudbot-dock">
      <button
        v-for="name in clips"
        :key="name"
        type="button"
        class="trudbot-chip"
        :class="{ 'is-active': active === name }"
        @click="selectClip(name)"
      >
        {{ CLIP_LABELS[name] ?? name }}
      </button>
      <button
        type="button"
        class="trudbot-chip is-toggle"
        :class="{ 'is-active': autoRotate }"
        @click="toggleAutoRotate"
      >
        {{ autoRotate ? "停止自转" : "自动旋转" }}
      </button>
    </div>

    <div v-else class="trudbot-overlay">
      <template v-if="status === 'loading'">
        <span class="trudbot-spinner" />
        <span class="trudbot-overlay-text">模型加载中…</span>
      </template>
      <span v-else class="trudbot-overlay-text">模型加载失败，请刷新重试</span>
    </div>
  </main>
</template>
