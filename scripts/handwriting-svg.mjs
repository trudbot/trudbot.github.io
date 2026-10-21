#!/usr/bin/env node
/*
 * 用 tegaki CLI（https://github.com/gkurt/tegaki）生成首页标题 `@trudbot` 的手写动画 SVG，
 * 由 components/handwriting-title.tsx 以 `?raw` 内联进页面。通过 npx 临时运行，不作为项目依赖。
 *
 * 用法：
 *   node scripts/handwriting-svg.mjs [输出路径] [其余参数原样透传给 tegaki]
 *
 * 样式对齐 components/profile-card.tsx 里的标题：
 *   font-handwriting(Caveat) / tracking-tight(-0.025em) / font-bold / text-foreground。
 *   - 颜色用 currentColor，跟随标题的 text-foreground，深浅主题都适用。
 *   - 宽高以 em 输出，尺寸跟随标题的响应式字号；FONT_SIZE 只是生成时的坐标基准。
 *   - 默认 --mode once：写一遍后停在写完的状态（SMIL 的 fill="freeze"）。
 *
 * tegaki 内置的 Caveat 只有 400 字重，而首页标题是 700。--clip 会把笔画裁到 400 字形
 * 轮廓内，加粗不了，所以这里用 --no-clip 画裸笔画，再把笔画（连同遮罩里的「笔刷」和
 * 端点圆点）整体加粗到接近 700 的观感；笔画变粗后会溢出 tegaki 算好的包围盒，
 * 因此同步外扩 viewBox 和遮罩区域。
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const TEXT = "@trudbot";
const FONT_SIZE = 96;
// 目测与 Caveat 700 粗细最接近的倍数
const WEIGHT_SCALE = 1.5;
// 推迟开笔，等标题所在区块的入场淡入（profile-card 里 0.3s 起的 pc-fade-up）基本可见；
// SMIL 时间轴从页面加载开始计时，不受 CSS 动画影响
const START_DELAY = 0.6;

const [output = "components/trudbot-handwriting.svg", ...extraArgs] = process.argv.slice(2);

const raw = execFileSync(
  "npx",
  [
    "-y",
    "tegaki@1.1.0",
    TEXT,
    "--font", "caveat",
    "--size", String(FONT_SIZE),
    "--color", "currentColor",
    "--letter-spacing", String(FONT_SIZE * -0.025),
    "--no-clip",
    "--mode", "once",
    ...extraArgs,
    "-o", "-",
  ],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], maxBuffer: 64 * 1024 * 1024 },
);

const round = (n) => Number(n.toFixed(2));
let maxWidth = 0;

let svg = raw
  .replace(/stroke-width="([\d.]+)"/g, (_, w) => {
    maxWidth = Math.max(maxWidth, Number(w));
    return `stroke-width="${round(w * WEIGHT_SCALE)}"`;
  })
  .replace(/<ellipse\b[^>]*>/g, (tag) =>
    tag.replace(/\b(rx|ry)="([\d.]+)"/g, (_, k, v) => `${k}="${round(v * WEIGHT_SCALE)}"`),
  )
  .replace(/begin="([\d.]+)s"/g, (_, t) => `begin="${round(Number(t) + START_DELAY)}s"`);

// 加粗后笔画每侧多出 (scale - 1) * width / 2，再留 1px 余量
const pad = Math.ceil(((WEIGHT_SCALE - 1) * maxWidth) / 2) + 1;
const expand = (x, y, w, h) => [round(x - pad), round(y - pad), round(w + pad * 2), round(h + pad * 2)];
const em = (px) => `${Number((px / FONT_SIZE).toFixed(4))}em`;

svg = svg
  .replace(/<svg\b[^>]*>/, (tag) => {
    const m = tag.match(/viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/);
    if (!m) throw new Error("tegaki 输出缺少 viewBox");
    const [x, y, w, h] = expand(...m.slice(1).map(Number));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${em(w)}" height="${em(h)}" aria-hidden="true" focusable="false">`;
  })
  .replace(
    /(<mask\b[^>]*?)x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g,
    (_, head, ...box) => {
      const [x, y, w, h] = expand(...box.slice(0, 4).map(Number));
      return `${head}x="${x}" y="${y}" width="${w}" height="${h}"`;
    },
  );

writeFileSync(output, svg);
console.log(`wrote ${output} (${(svg.length / 1024).toFixed(1)} KB)`);
