// Renders the store icon and cover from inline SVG. Run with `pnpm art`;
// the PNGs are committed because hb-sdk build stays offline and only copies them.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const out = path.resolve(import.meta.dirname, "../assets");
await mkdir(out, { recursive: true });

const INK = "#1a1a2e";
const GOLD = "#ffd166";
const PINK = "#ff6b9d";
const TEAL = "#5ce0d8";
const VIOLET = "#a78bfa";
const PAPER = "#fffffe";

const defs = `
  <defs>
    <radialGradient id="space" cx="70%" cy="40%" r="80%">
      <stop offset="0" stop-color="#3d2a7a"/><stop offset="0.6" stop-color="#16123a"/><stop offset="1" stop-color="#0b0820"/>
    </radialGradient>
    <radialGradient id="orb" cx="40%" cy="35%" r="70%">
      <stop offset="0" stop-color="${PAPER}"/><stop offset="0.35" stop-color="#c4b5fd"/><stop offset="1" stop-color="#5b3fc4"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;

// Hammer seen side-on mid-strike, head at the origin, handle up-left.
const hammer = (x, y, s, rot) => `
  <g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
    <rect x="-6" y="-120" width="12" height="104" rx="5" fill="#b06f3c"/>
    <rect x="-6" y="-120" width="12" height="22" rx="4" fill="${PINK}"/>
    <rect x="-36" y="-22" width="72" height="44" rx="10" fill="#8ea3c7"/>
    <rect x="-36" y="-22" width="16" height="44" rx="6" fill="${GOLD}"/>
  </g>`;

// Crack rays and fragments radiating from the point of impact.
function burst(cx, cy, r, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const rays = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
    const l = r * (0.7 + rnd() * 0.6);
    const m = a + (rnd() - 0.5) * 0.5;
    rays.push(`<path d="M${cx} ${cy} L${cx + Math.cos(m) * l * 0.5} ${cy + Math.sin(m) * l * 0.5} L${cx + Math.cos(a) * l} ${cy + Math.sin(a) * l}"/>`);
  }
  const bits = [];
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r * (1 + rnd() * 0.7);
    const z = 4 + rnd() * 8;
    const px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d;
    bits.push(`<path d="M${px} ${py - z} L${px + z} ${py + z * 0.6} L${px - z * 0.8} ${py + z * 0.4} Z" fill="${[GOLD, TEAL, PINK, PAPER][i % 4]}" stroke="${INK}" stroke-width="2"/>`);
  }
  return `<g stroke="${GOLD}" stroke-width="4" fill="none" stroke-linecap="round" filter="url(#glow)">${rays.join("")}</g>${bits.join("")}`;
}

const stars = (w, h, n, seed) => {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => `<circle cx="${rnd() * w}" cy="${rnd() * h}" r="${0.6 + rnd() * 1.4}" fill="${PAPER}" opacity="${0.3 + rnd() * 0.6}"/>`).join("");
};

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">${defs}
  <rect width="200" height="200" fill="url(#space)"/>
  ${stars(200, 200, 40, 7)}
  <circle cx="122" cy="118" r="52" fill="url(#orb)" stroke="${INK}" stroke-width="5"/>
  ${burst(92, 96, 34, 11)}
  ${hammer(88, 92, 0.85, -38)}
</svg>`;

const W = 510;
const H = 272;
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${defs}
  <rect width="${W}" height="${H}" fill="url(#space)"/>
  ${stars(W, H, 90, 3)}
  <ellipse cx="380" cy="136" rx="150" ry="22" fill="none" stroke="${VIOLET}" stroke-width="2" opacity="0.6" transform="rotate(-14 380 136)"/>
  <circle cx="380" cy="136" r="84" fill="url(#orb)" stroke="${INK}" stroke-width="6"/>
  ${burst(330, 110, 54, 5)}
  ${hammer(326, 106, 1.25, -40)}
  <text x="34" y="96" fill="${GOLD}" font-family="Hiragino Sans GB, STHeiti, sans-serif" font-size="20" font-weight="900" letter-spacing="10">一锤超限</text>
  <text x="34" y="166" fill="${INK}" stroke="${INK}" stroke-width="10" stroke-linejoin="round" font-family="Avenir Next Condensed, Arial Narrow, sans-serif" font-size="64" font-weight="900">ONE MORE</text>
  <text x="34" y="166" fill="${PAPER}" font-family="Avenir Next Condensed, Arial Narrow, sans-serif" font-size="64" font-weight="900">ONE MORE</text>
  <text x="34" y="222" fill="${INK}" stroke="${INK}" stroke-width="10" stroke-linejoin="round" font-family="Avenir Next Condensed, Arial Narrow, sans-serif" font-size="64" font-weight="900">HIT!</text>
  <text x="34" y="222" fill="${PINK}" font-family="Avenir Next Condensed, Arial Narrow, sans-serif" font-size="64" font-weight="900">HIT!</text>
</svg>`;

await sharp(Buffer.from(icon)).png().toFile(path.join(out, "icon.png"));
await sharp(Buffer.from(cover)).png().toFile(path.join(out, "cover.png"));
console.log("assets/icon.png, assets/cover.png written");
