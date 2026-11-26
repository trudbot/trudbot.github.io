/*
 * 头像交互动画用的最小补间引擎，语义对齐 framer-motion（motion-dom）的 tween：
 *   - 目标是数组时为显式关键帧；否则从当前值补间到目标，打断进行中的动画时从当前值接续；
 *   - 未指定 ease 时为 easeOut（motion 的 animateMotionValue 给所有值的默认值）；
 *   - 关键帧均匀分布，easing 作用于每一段（与 motion 的 keyframes generator 相同）；
 *   - delay 期间取第一帧；repeat 的 loop / mirror 与 JSAnimation.generate 相同；
 *   - 起止值相同的动画不播放，直接落到终值（motion 的 canAnimate 判断）；
 *   - x / y / scale / rotate 按 motion 的 transformPropOrder 合成 transform，默认值省略。
 * opacity 可选交给 WAAPI（waapiOpacity）：motion 对挂载在组件上的值这样做，单个 easing
 * 作用于整次迭代而非每一段，多关键帧时曲线不同；经 animationControls.set 创建的值没有
 * owner，motion 退回 JS，与这里的默认行为一致。
 * 只实现头像用到的部分，改动画前先确认 motion 的对应语义。
 */

type Easing = (progress: number) => number;
export type EaseName = "linear" | "easeOut" | "easeInOut";

// 取自 motion-utils 的 cubicBezier（源自 bezier-easing），保证与 framer-motion 逐点一致。
const calcBezier = (t: number, a1: number, a2: number) =>
  t * (3 * (1 - t) * ((1 - t) * a1 + t * a2) + t * t);

function cubicBezier(x1: number, y1: number, x2: number, y2: number): Easing {
  return (x) => {
    let lower = 0;
    let upper = 1;
    let t = x;
    for (let i = 0; ; i++) {
      if (!(t >= lower && t <= upper)) t = (lower + upper) / 2;
      const currentX = calcBezier(t, x1, x2) - x;
      if (currentX * currentX < 1e-28 || i === 40) break;
      if (currentX > 0) upper = t;
      else lower = t;
      t -= (currentX * 1e-7) / (calcBezier(t + 1e-7, x1, x2) - x - currentX);
    }
    return calcBezier(t, y1, y2);
  };
}

const EASINGS: Record<EaseName, Easing> = {
  linear: (p) => p,
  easeOut: cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
};

// 与 motion 的 supportedWaapiEasing 相同；CSS 关键字与上面的曲线是同一组控制点。
const WAAPI_EASINGS: Record<EaseName, string> = {
  linear: "linear",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
};

export interface Transition {
  /** 秒 */
  duration: number;
  /** 秒 */
  delay?: number;
  /** 默认 easeOut。 */
  ease?: EaseName;
  repeat?: number;
  repeatType?: "loop" | "mirror";
}

export type MotionKey = "x" | "y" | "scale" | "rotate" | "width" | "opacity";
export type Target = Partial<Record<MotionKey, number | number[]>>;

const TRANSFORM_ORDER = ["x", "y", "scale", "rotate"] as const;
// 未设置过的值从这里起补间；transform 分量取到默认值时不写进 transform。
const DEFAULTS: Record<MotionKey, number> = {
  x: 0,
  y: 0,
  scale: 1,
  rotate: 0,
  width: 0,
  opacity: 1,
};
const TRANSFORM_FUNCTIONS = {
  x: (v: number) => `translateX(${v}px)`,
  y: (v: number) => `translateY(${v}px)`,
  scale: (v: number) => `scale(${v})`,
  rotate: (v: number) => `rotate(${v}deg)`,
};

interface Tween {
  keyframes: number[];
  duration: number;
  delay: number;
  ease: Easing;
  repeat: number;
  repeatType: "loop" | "mirror";
  startTime: number;
  done: () => void;
}

const mix = (from: number, to: number, p: number) => from + (to - from) * p;

/** 与 motion 的 keyframes generator 相同：两帧直接补间，多帧按均分时间点逐段 easing。 */
function sampleKeyframes(keyframes: number[], ease: Easing, duration: number, elapsed: number) {
  const p = duration > 0 ? Math.min(Math.max(elapsed / duration, 0), 1) : 1;
  if (keyframes.length === 2) return mix(keyframes[0], keyframes[1], ease(p));
  const segments = keyframes.length - 1;
  const index = Math.min(Math.floor(p * segments), segments - 1);
  const segmentProgress = p * segments - index;
  return mix(keyframes[index], keyframes[index + 1], ease(segmentProgress));
}

/** JSAnimation.generate 的 repeat 处理（无 repeatDelay）。返回 [值, 是否结束]。 */
function sampleTween(tween: Tween, now: number): [number, boolean] {
  const { keyframes, duration, delay, ease, repeat, repeatType } = tween;
  const time = now - tween.startTime - delay;
  if (time < 0) return [keyframes[0], false];

  const totalDuration = repeat === Infinity ? Infinity : duration * (repeat + 1);
  if (time >= totalDuration) {
    const useFirst = repeat && repeatType !== "loop" && repeat % 2 === 1;
    return [useFirst ? keyframes[0] : keyframes[keyframes.length - 1], true];
  }

  let elapsed = time;
  let frames = keyframes;
  if (repeat && duration > 0) {
    const progress = time / duration;
    let iteration = Math.floor(progress);
    let iterationProgress = progress % 1;
    if (!iterationProgress && progress >= 1) iterationProgress = 1;
    if (iterationProgress === 1) iteration--;
    if (iteration % 2 === 1 && repeatType === "mirror") frames = [...keyframes].reverse();
    elapsed = iterationProgress * duration;
  }
  return [sampleKeyframes(frames, ease, duration, elapsed), false];
}

// 所有补间共用一个 rAF 循环；时间取 performance.now()，与 motion 的 frameloop 一致。
const active = new Set<MotionElement>();
let frameId: number | null = null;

function tick() {
  frameId = null;
  const now = performance.now();
  for (const element of active) element.update(now);
  if (active.size > 0) frameId = requestAnimationFrame(tick);
}

function schedule(element: MotionElement) {
  active.add(element);
  frameId ??= requestAnimationFrame(tick);
}

export class MotionElement {
  private values: Partial<Record<MotionKey, number>> = {};
  private tweens = new Map<MotionKey, Tween>();
  private opacityAnimation: Animation | null = null;
  private opacityDone: (() => void) | null = null;

  constructor(
    readonly el: HTMLElement,
    initial: Partial<Record<MotionKey, number>> = {},
    private readonly waapiOpacity = false,
  ) {
    this.set(initial);
  }

  /** 立即设值，不停止其他进行中的动画（与 animationControls.set 相同）。 */
  set(values: Partial<Record<MotionKey, number>>) {
    for (const [key, value] of Object.entries(values) as [MotionKey, number][]) {
      this.cancel(key);
      this.values[key] = value;
    }
    this.render();
  }

  /** 按 key 指定 transition 时传入对象，否则所有 key 共用一个。全部结束（或被打断）时 resolve。 */
  animate(target: Target, transition: Transition | Partial<Record<MotionKey, Transition>>) {
    const pending: Promise<void>[] = [];
    const startTime = performance.now();
    for (const [key, value] of Object.entries(target) as [MotionKey, number | number[]][]) {
      const options =
        "duration" in transition ? transition : (transition as Record<MotionKey, Transition>)[key];
      pending.push(this.animateValue(key, value, options, startTime));
    }
    return Promise.all(pending).then(() => {});
  }

  stop() {
    for (const key of this.tweens.keys()) this.cancel(key);
    if (this.opacityAnimation) this.cancel("opacity");
    active.delete(this);
  }

  /** 由 rAF 循环调用。 */
  update(now: number) {
    for (const [key, tween] of this.tweens) {
      const [value, finished] = sampleTween(tween, now);
      this.values[key] = value;
      if (finished) {
        this.tweens.delete(key);
        tween.done();
      }
    }
    if (this.tweens.size === 0) active.delete(this);
    this.render();
  }

  private animateValue(
    key: MotionKey,
    value: number | number[],
    { duration, delay = 0, ease = "easeOut", repeat = 0, repeatType = "loop" }: Transition,
    startTime: number,
  ) {
    this.cancel(key);
    const current = this.values[key] ?? DEFAULTS[key];
    const keyframes = Array.isArray(value) ? value : [current, value];

    if (keyframes.every((frame) => frame === keyframes[0])) {
      this.values[key] = keyframes[keyframes.length - 1];
      this.render();
      return Promise.resolve();
    }

    if (key === "opacity" && this.waapiOpacity) {
      return this.animateOpacityWithWaapi(keyframes, { duration, delay, ease, repeat });
    }

    return new Promise<void>((done) => {
      this.tweens.set(key, {
        keyframes,
        duration: duration * 1000,
        delay: delay * 1000,
        ease: EASINGS[ease],
        repeat,
        repeatType,
        startTime,
        done,
      });
      schedule(this);
    });
  }

  private animateOpacityWithWaapi(
    keyframes: number[],
    { duration, delay, ease, repeat }: Required<Omit<Transition, "repeatType">>,
  ) {
    // 参数与 motion 的 startWaapiAnimation 相同：单个 easing 作用于整次迭代。
    const animation = this.el.animate(
      { opacity: keyframes },
      {
        delay: delay * 1000,
        duration: duration * 1000,
        easing: WAAPI_EASINGS[ease],
        fill: "both",
        iterations: repeat + 1,
      },
    );
    this.opacityAnimation = animation;
    return new Promise<void>((done) => {
      this.opacityDone = done;
      animation.onfinish = () => {
        // 与 motion 一致：先把终值写进 style，再取消 fill，避免闪烁。
        this.values.opacity = keyframes[keyframes.length - 1];
        this.render();
        this.cancel("opacity");
      };
    });
  }

  /** 停止某个值的动画，并把它定格在当前显示的值上。 */
  private cancel(key: MotionKey) {
    const tween = this.tweens.get(key);
    if (tween) {
      this.tweens.delete(key);
      tween.done();
    }
    if (key === "opacity" && this.opacityAnimation) {
      this.values.opacity = parseFloat(getComputedStyle(this.el).opacity);
      this.render();
      this.opacityAnimation.cancel();
      this.opacityAnimation = null;
      this.opacityDone?.();
      this.opacityDone = null;
    }
  }

  private render() {
    const { el, values } = this;
    if (values.width !== undefined) el.style.width = `${values.width}rem`;
    if (values.opacity !== undefined) el.style.opacity = String(values.opacity);

    let transform = "";
    let hasTransform = false;
    for (const key of TRANSFORM_ORDER) {
      const value = values[key];
      if (value === undefined) continue;
      hasTransform = true;
      if (value !== DEFAULTS[key]) transform += `${TRANSFORM_FUNCTIONS[key](value)} `;
    }
    if (hasTransform) el.style.transform = transform.trim() || "none";
  }
}
