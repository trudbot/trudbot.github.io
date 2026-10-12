// Renders the store icon and cover from inline SVG. Run with `pnpm art`;
// the PNGs are committed because hb-sdk build stays offline and only copies them.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const out = path.resolve(import.meta.dirname, "../assets");
await mkdir(out, { recursive: true });

const GREEN = "#8BFF5A";
const AMBER = "#E8B52E";
const RED = "#FF3B3B";

const defs = `
  <defs>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="2" fill="#000" opacity="0.18"/>
    </pattern>
    <pattern id="hazard" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="12" height="24" fill="${AMBER}"/><rect x="12" width="12" height="24" fill="#1a1305"/>
    </pattern>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

// A 3×3 fuse grid with the current running from the centre generator.
function grid(x, y, cell) {
  const c = (i) => i * cell + cell / 2;
  const tiles = [];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      tiles.push(
        `<rect x="${x + i * cell + 2}" y="${y + j * cell + 2}" width="${cell - 4}" height="${cell - 4}" rx="3" fill="#1c2120" stroke="#2e3532"/>`,
      );
  const wires = [
    [1, 1, 0, 1],
    [1, 1, 2, 1],
    [1, 1, 1, 0],
    [1, 0, 0, 0],
    [1, 0, 2, 0],
    [2, 1, 2, 2],
    [0, 1, 0, 2],
    [0, 2, 1, 2],
  ]
    .map(
      ([a, b, p, q]) =>
        `<line x1="${x + c(a)}" y1="${y + c(b)}" x2="${x + c(p)}" y2="${y + c(q)}"/>`,
    )
    .join("");
  const lamps = [
    [0, 0],
    [2, 0],
    [1, 2],
    [2, 2],
  ]
    .map(
      ([a, b]) => `<circle cx="${x + c(a)}" cy="${y + c(b)}" r="${cell * 0.13}" fill="${GREEN}"/>`,
    )
    .join("");
  const g = cell * 0.24;
  return `
    ${tiles.join("")}
    <g stroke="${GREEN}" stroke-width="${cell * 0.12}" stroke-linecap="round" filter="url(#glow)">${wires}</g>
    <g filter="url(#glow)">${lamps}</g>
    <rect x="${x + c(1) - g}" y="${y + c(1) - g}" width="${g * 2}" height="${g * 2}" rx="3" fill="#0e1110" stroke="${GREEN}" stroke-width="3"/>
    <path transform="translate(${x + c(1) - 11} ${y + c(1) - 16}) scale(0.7)" d="M20 0 L0 26 H13 L8 46 L30 18 H17 Z" fill="${GREEN}" filter="url(#glow)"/>`;
}

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${defs}
  <rect width="200" height="200" fill="#0d0f0e"/>
  <rect x="10" y="10" width="180" height="180" rx="10" fill="#171b19" stroke="#36403b" stroke-width="2"/>
  <rect x="10" y="168" width="180" height="22" fill="url(#hazard)" clip-path="inset(0 round 0 0 10 10)"/>
  ${grid(28, 22, 48)}
  <rect width="200" height="200" fill="url(#scan)"/>
</svg>`;

const W = 510;
const H = 272;
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}
  <rect width="${W}" height="${H}" fill="#0d0f0e"/>
  <rect y="${H - 18}" width="${W}" height="18" fill="url(#hazard)"/>
  <rect x="22" y="26" width="214" height="214" rx="8" fill="#171b19" stroke="#36403b" stroke-width="2"/>
  ${grid(36, 40, 62)}
  <text x="262" y="92" fill="${GREEN}" font-family="Menlo, monospace" font-size="13" letter-spacing="3" opacity="0.85">SECTOR GRID · OFFLINE</text>
  <text x="264" y="180" fill="#8a4524" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="68" font-weight="900" letter-spacing="4">通通电</text>
  <text x="260" y="176" fill="#e9ede6" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="68" font-weight="900" letter-spacing="4">通通<tspan fill="${GREEN}">电</tspan></text>
  <text x="262" y="228" fill="#77817a" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="14" letter-spacing="2">旋转线路，恢复设施供电</text>
  <rect width="${W}" height="${H}" fill="url(#scan)"/>
</svg>`;

await sharp(Buffer.from(icon)).png().toFile(path.join(out, "icon.png"));
await sharp(Buffer.from(cover)).png().toFile(path.join(out, "cover.png"));
console.log("assets/icon.png, assets/cover.png written");
