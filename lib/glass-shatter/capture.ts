// 把「当前可见视口」画成一张位图，供碎片取材。
//
// 只做显示、从不回读像素：跨域图片（头像所在 OSS 不返回 CORS 头）和 foreignObject SVG
// 会让 canvas 变成 tainted，但 tainted canvas 依旧可以显示、也能再 drawImage 到别的
// canvas 上，所以碎片全部用 2D canvas + CSS transform 实现，不上传 WebGL 纹理。
//
// 特效层挂在 <html> 而非 <body> 下，所以截 body 时天然不含特效层。
//
// 对齐：snapdom 总是按整个 body 生成 SVG。不在位图上按比例裁剪，而是直接改写根 <svg> 的
// viewBox，只渲染视口那一块；坐标由 body 的 getBoundingClientRect 与 foreignObject 偏移
// 精确换算，与 dpr、滚动位置、Safari 额外的 1px 内边距都无关。

import type { snapdom as SnapdomFn, SnapdomPlugin } from "@zumer/snapdom";

export const OVERLAY_ATTR = "data-glass-shatter";
const FIXED_ATTR = "data-glass-shatter-fixed";

export interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function createPageCanvas(vp: Viewport, dpr: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width * dpr);
  canvas.height = Math.round(vp.height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#fff";
  ctx.fillRect(0, 0, vp.width, vp.height);
  return canvas;
}

/** Starts fetching the capture library so it is ready by the time the page is painted. */
export function preloadCapture() {
  return import("@zumer/snapdom").catch(() => undefined);
}

/**
 * Paints the DOM (without <img>) via snapdom, then the visible images on top. If snapdom fails
 * the canvas still holds the background and images, which is a usable fallback for the shards.
 */
export async function paintViewport(canvas: HTMLCanvasElement, vp: Viewport, dpr: number) {
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  try {
    const { snapdom } = await import("@zumer/snapdom");
    const svg = await captureSvg(snapdom, vp);
    if (svg) {
      // Safari sometimes draws a foreignObject image blank on its first use; a second draw after
      // a frame is the cheap, widely used workaround.
      ctx.drawImage(svg, 0, 0, vp.width, vp.height);
      await nextFrame();
      ctx.drawImage(svg, 0, 0, vp.width, vp.height);
    }
  } catch (error) {
    console.warn("[glass-shatter] DOM capture failed", error);
  }
  paintImages(ctx, vp);
}

async function captureSvg(snapdom: typeof SnapdomFn, vp: Viewport) {
  const body = document.body;
  const bodyRect = body.getBoundingClientRect();
  const untagFixed = tagFixedElements(bodyRect);

  let url: string;
  try {
    const result = await snapdom(body, {
      fast: true,
      embedFonts: false,
      placeholders: false,
      cache: "soft",
      // Images are painted separately: snapdom would have to re-fetch them with CORS, which the
      // avatar host rejects. "hide" keeps their layout box so nothing around them shifts.
      filter: (el) => el.tagName !== "IMG",
      filterMode: "hide",
      plugins: [freezeClonePlugin()],
    });
    url = result.url;
  } finally {
    untagFixed();
  }

  const source = decodeURIComponent(url.slice(url.indexOf(",") + 1));
  const fo = /<foreignObject\b[^>]*>/.exec(source)?.[0] ?? "";
  const fx = Number(/\sx="([-\d.e]+)"/.exec(fo)?.[1] ?? 0);
  const fy = Number(/\sy="([-\d.e]+)"/.exec(fo)?.[1] ?? 0);
  const viewBox = [fx + vp.left - bodyRect.left, fy + vp.top - bodyRect.top, vp.width, vp.height];
  const svg = source.replace(/^<svg\b[^>]*>/, (tag) =>
    tag
      .replace(/\swidth="[^"]*"/, ` width="${vp.width}"`)
      .replace(/\sheight="[^"]*"/, ` height="${vp.height}"`)
      .replace(/\sviewBox="[^"]*"/, ` viewBox="${viewBox.join(" ")}"`),
  );

  const img = new Image();
  img.decoding = "sync";
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

/**
 * Inside the foreignObject, `position: fixed` resolves against the top of the whole capture
 * instead of the scrolled viewport. Tag fixed elements so the clone can pin them to where they
 * are actually painted.
 */
function tagFixedElements(bodyRect: DOMRect) {
  const tagged: HTMLElement[] = [];
  for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
    if (el.hasAttribute(OVERLAY_ATTR) || getComputedStyle(el).position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    const [cx, cy] = containingBlockOrigin(el, bodyRect);
    el.setAttribute(FIXED_ATTR, [r.left - cx, r.top - cy, r.width, r.height].join(","));
    tagged.push(el);
  }
  return () => {
    for (const el of tagged) el.removeAttribute(FIXED_ATTR);
  };
}

/**
 * Client-space origin of the box an `absolute` element would be positioned against: the padding
 * box of the nearest positioned (or transformed) ancestor, else the body.
 */
function containingBlockOrigin(el: HTMLElement, bodyRect: DOMRect): [number, number] {
  for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
    const s = getComputedStyle(a);
    if (s.position === "static" && s.transform === "none" && s.filter === "none") continue;
    const r = a.getBoundingClientRect();
    return [r.left + a.clientLeft - a.scrollLeft, r.top + a.clientTop - a.scrollTop];
  }
  return [bodyRect.left, bodyRect.top];
}

function freezeClonePlugin(): SnapdomPlugin {
  return {
    name: "glass-shatter-freeze",
    afterClone(context) {
      const clone = context.clone;
      if (!clone) return;

      for (const el of clone.querySelectorAll<HTMLElement>(`[${FIXED_ATTR}]`)) {
        const [left, top, width, height] = el.getAttribute(FIXED_ATTR)!.split(",");
        el.removeAttribute(FIXED_ATTR);
        Object.assign(el.style, {
          position: "absolute",
          left: `${left}px`,
          top: `${top}px`,
          width: `${width}px`,
          height: `${height}px`,
          right: "auto",
          bottom: "auto",
        });
      }

      // An SVG rendered as an image restarts its SMIL timeline at 0, so stroke-by-stroke drawings
      // (the handwritten title) would appear unfinished. Bake in each animation's final value.
      for (const anim of clone.querySelectorAll("animate, set, animateTransform, animateMotion")) {
        const target = anim.parentElement;
        const name = anim.getAttribute("attributeName");
        const values = anim.getAttribute("values")?.split(";");
        const final = anim.getAttribute("to") ?? values?.[values.length - 1]?.trim();
        if (target && name && final && anim.tagName.toLowerCase() !== "animatemotion") {
          if (anim.getAttribute("fill") === "freeze") target.setAttribute(name, final);
        }
        anim.remove();
      }
    },
  };
}

function paintImages(ctx: CanvasRenderingContext2D, vp: Viewport) {
  for (const img of document.images) {
    if (img.closest(`[${OVERLAY_ATTR}]`) || !img.complete || img.naturalWidth === 0) continue;
    const r = img.getBoundingClientRect();
    if (r.width < 1 || r.right < vp.left || r.bottom < vp.top) continue;
    if (r.left > vp.left + vp.width || r.top > vp.top + vp.height) continue;
    const style = getComputedStyle(img);
    if (style.visibility !== "visible" || Number(style.opacity) === 0) continue;

    ctx.save();
    ctx.translate(-vp.left, -vp.top);
    clipToOverflowAncestor(ctx, img);
    drawFitted(ctx, img, r, style.objectFit);
    ctx.restore();
  }
}

/** Approximates the nearest clipping ancestor (e.g. the rounded avatar frame) with a rounded rect. */
function clipToOverflowAncestor(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
    const s = getComputedStyle(el);
    if (s.overflow === "visible" && s.overflowX === "visible") continue;
    const r = el.getBoundingClientRect();
    // Overflow clips at the padding box, i.e. inside the border.
    const scale = el.offsetWidth > 0 ? r.width / el.offsetWidth : 1;
    const bl = parseFloat(s.borderLeftWidth) * scale;
    const bt = parseFloat(s.borderTopWidth) * scale;
    const x = r.left + bl;
    const y = r.top + bt;
    const w = r.width - bl - parseFloat(s.borderRightWidth) * scale;
    const h = r.height - bt - parseFloat(s.borderBottomWidth) * scale;
    const radius = resolveRadius(s.borderTopLeftRadius, r.width) * scale - Math.max(bl, bt);
    ctx.beginPath();
    if (radius > 0 && typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.clip();
    return;
  }
}

function resolveRadius(value: string, width: number) {
  const first = value.split(" ")[0];
  const n = parseFloat(first);
  if (!Number.isFinite(n)) return 0;
  return first.endsWith("%") ? (n / 100) * width : n;
}

function drawFitted(ctx: CanvasRenderingContext2D, img: HTMLImageElement, r: DOMRect, fit: string) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (fit !== "cover" && fit !== "contain") {
    ctx.drawImage(img, r.left, r.top, r.width, r.height);
    return;
  }
  const scale =
    fit === "cover" ? Math.max(r.width / iw, r.height / ih) : Math.min(r.width / iw, r.height / ih);
  const w = iw * scale;
  const h = ih * scale;
  ctx.drawImage(img, r.left + (r.width - w) / 2, r.top + (r.height - h) / 2, w, h);
}

export function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}
