/*
 * 头像的交互动画增强，在首屏静态头像（AvatarPhoto.vue）hydration 后的空闲时段按需加载，
 * 直接在已有 DOM 上补齐动画元素并接管交互，不重建头像，避免图片重新插入时闪烁。
 *
 * 交互与动画逐项对齐原 framer-motion 实现，以下细节都是有意保留的，改动会让手感变化：
 *   - 悬停/点击的回调延后到下一帧执行（framer 在 frame.postRender 里派发手势回调）；
 *   - 悬停忽略触摸指针；按住时离开元素，悬停结束推迟到抬起（motion-dom 的 hover()）；
 *   - 点击只认主指针，抬起点仍在元素内才算一次点击；点击坐标取 pageX/pageY
 *     （framer 的 info.point），而元素中心取视口坐标；
 *   - 元素设 tabIndex=0，聚焦后 Enter 触发一次点击（motion-dom 的 press()）。
 */
import { MotionElement, type Target, type Transition } from "./motion";

const PARTICLE_COUNT = 8;
const PARTICLE_RADIUS = 150;
const PARTICLE_DURATION = 1.5;
const PARTICLE_STAGGER = 0.1;
const BURST_TIMEOUT_MS = 3000;
const MOUSE_SETTLE_MS = 150;
const MOUSE_SETTLE_THRESHOLD_SQ = 400; // 20px²
const ENTRY_ANIMATION_MS = 2100;

const EFFECT_COLORS = [
  "var(--effect-cyan)",
  "var(--effect-magenta)",
  "var(--effect-yellow)",
  "var(--effect-green)",
];

const GLOW_GRADIENT = `conic-gradient(from 0deg, ${EFFECT_COLORS.join(", ")}, ${EFFECT_COLORS[0]})`;
const BORDER_GRADIENT = `conic-gradient(from 0deg, transparent 0deg, ${EFFECT_COLORS[0]} 90deg, transparent 180deg, ${EFFECT_COLORS[1]} 270deg, transparent 360deg)`;

const PARTICLE_DIRECTIONS = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i * Math.PI * 2) / PARTICLE_COUNT;
  return { dx: Math.cos(angle) * PARTICLE_RADIUS, dy: Math.sin(angle) * PARTICLE_RADIUS };
});

const COLOR_BARS = [
  { active: 6, idle: 4, delay: 0.5, color: "bg-primary" },
  { active: 8, idle: 6, delay: 0.7, color: "bg-accent" },
  { active: 5, idle: 3, delay: 0.9, color: "bg-secondary" },
];

const SHAPE_TRANSITION_ACTIVE: Transition = { duration: 0.6, ease: "easeInOut" };
// 色条的 transition 没写 ease，取 framer 的默认 easeOut。
const DIAMOND = {
  active: { rotate: [0, 180], scale: 1.2, x: -20, y: -20 },
  idle: { rotate: 5, scale: 1.05, x: 0, y: 0 },
  idleTransition: { duration: 4, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" },
} satisfies { active: Target; idle: Target; idleTransition: Transition };
const TRIANGLE = {
  active: { rotate: [0, -180], scale: 1.3, x: 20, y: 20 },
  idle: { rotate: [0, -5, 5, 0], scale: 1, x: 0, y: 0 },
  idleTransition: { duration: 6, repeat: Infinity, ease: "easeInOut" },
} satisfies { active: Target; idle: Target; idleTransition: Transition };

function createDiv(className: string, style: Partial<CSSStyleDeclaration> = {}) {
  const el = document.createElement("div");
  el.className = className;
  Object.assign(el.style, style);
  return el;
}

const nextFrame = (callback: () => void) => requestAnimationFrame(() => callback());

const isPrimaryPointer = (event: PointerEvent) =>
  event.pointerType === "mouse"
    ? typeof event.button !== "number" || event.button <= 0
    : event.isPrimary !== false;

/**
 * root 结构需与 AvatarPhoto.vue 一致：[菱形, 三角形, 头像容器 > 圆形相框 > 图片]。
 * 返回清理函数。
 */
export function enhanceAvatar(root: HTMLElement): () => void {
  const [diamondEl, triangleEl, wrapperEl] = Array.from(root.children) as HTMLElement[];
  const frameEl = wrapperEl.firstElementChild as HTMLElement;

  const ringEl = createDiv("absolute -inset-2 rounded-full", { background: BORDER_GRADIENT });
  // 透明度为 0 的颜色写法照搬原实现（var() 后接 alpha 后缀在 CSS 中无效，阴影实际不显示）。
  const shadowEl = createDiv("pointer-events-none absolute inset-0 rounded-full", {
    boxShadow: `0 0 60px ${EFFECT_COLORS[0]}99, 0 0 100px ${EFFECT_COLORS[1]}66`,
  });
  const barsEl = createDiv("absolute -right-12 top-1/4 flex flex-col gap-2");
  wrapperEl.insertBefore(ringEl, frameEl);
  frameEl.insertBefore(shadowEl, frameEl.firstChild);
  root.appendChild(barsEl);
  wrapperEl.classList.add("cursor-pointer");
  if (!wrapperEl.hasAttribute("tabindex")) wrapperEl.tabIndex = 0;

  const diamond = new MotionElement(diamondEl);
  const triangle = new MotionElement(triangleEl);
  const wrapper = new MotionElement(wrapperEl);
  // 这几个元素在原实现里是带 animate 的 motion 组件，opacity 由 framer 交给 WAAPI；
  // 粒子的值经 animationControls.set 创建，framer 用 JS 驱动（见 ./motion 的说明）。
  const ring = new MotionElement(ringEl, { rotate: 0, opacity: 0 }, true);
  const shadow = new MotionElement(shadowEl, { opacity: 0 }, true);
  const bars = COLOR_BARS.map((bar) => {
    const el = createDiv(`h-1 ${bar.color}`);
    barsEl.appendChild(el);
    return new MotionElement(el, { width: 0 });
  });

  let glow: MotionElement | null = null;
  let particles: MotionElement[] = [];
  let particleRun = 0;

  let isAvatarHovered = false;
  let isBursting = false;
  let isMouseSettled = false;
  let hasEntered = false;
  let wasActive = false;
  let wasParticleActive = false;
  let burstTimeout: ReturnType<typeof setTimeout> | null = null;
  let mouseStopTimer: ReturnType<typeof setTimeout> | null = null;
  let mousePos = { x: 0, y: 0 };
  let settledPos = { x: 0, y: 0 };
  let cachedRect: DOMRect | null = null;

  function animateActive(isActive: boolean) {
    diamond.animate(
      isActive ? DIAMOND.active : DIAMOND.idle,
      isActive ? SHAPE_TRANSITION_ACTIVE : DIAMOND.idleTransition,
    );
    triangle.animate(
      isActive ? TRIANGLE.active : TRIANGLE.idle,
      isActive ? SHAPE_TRANSITION_ACTIVE : TRIANGLE.idleTransition,
    );
    wrapper.animate(
      { rotate: isActive ? [0, -5, 5, -5, 0] : 0, scale: isActive ? 1.1 : 1 },
      { duration: 0.5, ease: "easeOut" },
    );

    if (isActive) {
      const el = createDiv("absolute inset-0 rounded-full", {
        background: GLOW_GRADIENT,
        filter: "blur(20px)",
      });
      wrapperEl.insertBefore(el, wrapperEl.firstChild);
      glow = new MotionElement(el, { opacity: 0, scale: 0.8 }, true);
      glow.animate(
        { opacity: [0, 0.6, 0], scale: [0.8, 1.3, 1.5] },
        { duration: 2.5, repeat: Infinity, ease: "easeOut" },
      );
    } else if (glow) {
      glow.stop();
      glow.el.remove();
      glow = null;
    }

    ring.animate(
      { rotate: isActive ? [0, 360] : 0, opacity: isActive ? 0.8 : 0 },
      {
        rotate: { duration: 2, repeat: isActive ? Infinity : 0, ease: "linear" },
        opacity: { duration: 0.3, ease: "easeOut" },
      },
    );
    shadow.animate({ opacity: isActive ? 1 : 0 }, { duration: 0.3, ease: "easeOut" });
    bars.forEach((bar, i) =>
      bar.animate(
        { width: isActive ? COLOR_BARS[i].active : COLOR_BARS[i].idle },
        { delay: hasEntered ? 0 : COLOR_BARS[i].delay, duration: 0.6 },
      ),
    );
  }

  function waitUntilVisible() {
    return new Promise<void>((resolve) => {
      const onVisible = () => {
        document.removeEventListener("visibilitychange", onVisible);
        resolve();
      };
      document.addEventListener("visibilitychange", onVisible);
    });
  }

  async function runParticles(run: number) {
    while (run === particleRun) {
      if (document.hidden) {
        await waitUntilVisible();
        if (run !== particleRun) break;
      }
      const { x, y } = mousePos;
      for (const particle of particles) particle.set({ opacity: 0, scale: 0, x, y });
      await Promise.all(
        particles.map((particle, i) => {
          const { dx, dy } = PARTICLE_DIRECTIONS[i];
          return particle.animate(
            { opacity: [0, 1, 0], scale: [0, 1, 0], x: [x, x + dx], y: [y, y + dy] },
            { duration: PARTICLE_DURATION, delay: i * PARTICLE_STAGGER, ease: "easeOut" },
          );
        }),
      );
    }
  }

  function setParticlesActive(isParticleActive: boolean) {
    particleRun++;
    for (const particle of particles) {
      particle.stop();
      particle.el.remove();
    }
    particles = [];
    if (!isParticleActive) return;

    particles = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      const el = createDiv(
        "pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full",
        { background: EFFECT_COLORS[i % EFFECT_COLORS.length] },
      );
      wrapperEl.appendChild(el);
      return new MotionElement(el, { opacity: 0, scale: 0, x: 0, y: 0 });
    });
    void runParticles(particleRun);
  }

  // 状态变化后统一调用，只对派生状态的变化做出反应（对应 React 重渲染后的 animate diff）。
  function update() {
    const isActive = isAvatarHovered || isBursting;
    const isParticleActive = (isAvatarHovered && isMouseSettled) || isBursting;
    if (isActive !== wasActive) {
      wasActive = isActive;
      animateActive(isActive);
    }
    if (isParticleActive !== wasParticleActive) {
      wasParticleActive = isParticleActive;
      setParticlesActive(isParticleActive);
    }
  }

  function handleTap(event: PointerEvent) {
    const rect = wrapperEl.getBoundingClientRect();
    mousePos = {
      x: event.pageX - (rect.left + rect.width / 2),
      y: event.pageY - (rect.top + rect.height / 2),
    };
    isBursting = true;
    if (burstTimeout) clearTimeout(burstTimeout);
    burstTimeout = setTimeout(() => {
      isBursting = false;
      update();
    }, BURST_TIMEOUT_MS);
    update();
  }

  function handleHoverEnd() {
    isAvatarHovered = false;
    isMouseSettled = false;
    if (mouseStopTimer) {
      clearTimeout(mouseStopTimer);
      mouseStopTimer = null;
    }
    mousePos = { x: 0, y: 0 };
    cachedRect = null;
    update();
  }

  function handlePointerMove(event: PointerEvent) {
    if (event.pointerType === "touch") return;

    cachedRect ??= wrapperEl.getBoundingClientRect();
    mousePos = {
      x: event.clientX - (cachedRect.left + cachedRect.width / 2),
      y: event.clientY - (cachedRect.top + cachedRect.height / 2),
    };

    const dx = mousePos.x - settledPos.x;
    const dy = mousePos.y - settledPos.y;
    if (mouseStopTimer === null && dx * dx + dy * dy < MOUSE_SETTLE_THRESHOLD_SQ) return;

    isMouseSettled = false;
    if (mouseStopTimer) clearTimeout(mouseStopTimer);
    mouseStopTimer = setTimeout(() => {
      settledPos = { ...mousePos };
      mouseStopTimer = null;
      isMouseSettled = true;
      update();
    }, MOUSE_SETTLE_MS);
    update();
  }

  // ─── 手势：hover ───
  const abort = new AbortController();
  const listen = { passive: true, signal: abort.signal };
  let isPressed = false;
  let deferredHoverEnd = false;
  let hovering = false;

  const endHover = () => {
    if (!hovering) return;
    hovering = false;
    wrapperEl.removeEventListener("pointerleave", onPointerLeave);
    nextFrame(handleHoverEnd);
  };
  const onHoverPointerUp = () => {
    isPressed = false;
    window.removeEventListener("pointerup", onHoverPointerUp);
    window.removeEventListener("pointercancel", onHoverPointerUp);
    if (deferredHoverEnd) {
      deferredHoverEnd = false;
      endHover();
    }
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (isPressed) {
      deferredHoverEnd = true;
      return;
    }
    endHover();
  };
  wrapperEl.addEventListener(
    "pointerenter",
    (event) => {
      if (event.pointerType === "touch") return;
      deferredHoverEnd = false;
      nextFrame(() => {
        isAvatarHovered = true;
        update();
      });
      hovering = true;
      wrapperEl.addEventListener("pointerleave", onPointerLeave, listen);
    },
    listen,
  );
  wrapperEl.addEventListener(
    "pointerdown",
    () => {
      isPressed = true;
      window.addEventListener("pointerup", onHoverPointerUp, listen);
      window.addEventListener("pointercancel", onHoverPointerUp, listen);
    },
    listen,
  );

  // ─── 手势：press（tap） ───
  let isPressing = false;
  const endListen = { ...listen, capture: true };
  const onPressEnd = (event: PointerEvent, success: boolean) => {
    window.removeEventListener("pointerup", onPressUp, endListen);
    window.removeEventListener("pointercancel", onPressCancel, endListen);
    isPressing = false;
    if (!isPrimaryPointer(event)) return;
    if (success) nextFrame(() => handleTap(event));
  };
  const onPressUp = (event: PointerEvent) =>
    onPressEnd(event, event.target instanceof Node && wrapperEl.contains(event.target));
  const onPressCancel = (event: PointerEvent) => onPressEnd(event, false);
  wrapperEl.addEventListener(
    "pointerdown",
    (event) => {
      if (!isPrimaryPointer(event)) return;
      isPressing = true;
      window.addEventListener("pointerup", onPressUp, endListen);
      window.addEventListener("pointercancel", onPressCancel, endListen);
    },
    listen,
  );

  const firePointerEvent = (type: "down" | "up" | "cancel") =>
    wrapperEl.dispatchEvent(new PointerEvent(`pointer${type}`, { isPrimary: true, bubbles: true }));
  wrapperEl.addEventListener(
    "focus",
    () => {
      let isKeyPressing = false;
      const onKeydown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" || isPressing) return;
        isKeyPressing = true;
        firePointerEvent("down");
      };
      const onKeyup = (event: KeyboardEvent) => {
        if (event.key !== "Enter" || !isKeyPressing) return;
        isKeyPressing = false;
        firePointerEvent("up");
      };
      wrapperEl.addEventListener("keydown", onKeydown, listen);
      wrapperEl.addEventListener("keyup", onKeyup, listen);
      wrapperEl.addEventListener(
        "blur",
        () => {
          wrapperEl.removeEventListener("keydown", onKeydown);
          wrapperEl.removeEventListener("keyup", onKeyup);
          if (isKeyPressing) firePointerEvent("cancel");
        },
        { ...listen, once: true },
      );
    },
    listen,
  );

  wrapperEl.addEventListener("pointermove", handlePointerMove, listen);

  // ─── 挂载：装饰形状进入待机循环，wrapper 归位，色条带延迟入场 ───
  animateActive(false);
  const enteredTimer = setTimeout(() => {
    hasEntered = true;
  }, ENTRY_ANIMATION_MS);

  return () => {
    abort.abort();
    clearTimeout(enteredTimer);
    if (burstTimeout) clearTimeout(burstTimeout);
    if (mouseStopTimer) clearTimeout(mouseStopTimer);
    particleRun++;
    for (const motion of [diamond, triangle, wrapper, ring, shadow, ...bars, ...particles]) {
      motion.stop();
    }
    glow?.stop();
  };
}
