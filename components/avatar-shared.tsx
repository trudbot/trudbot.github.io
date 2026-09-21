// 头像的静态部分（不依赖 framer-motion）：SSR 首屏与「加载动画增强前」都用它，
// 保证 LCP 头像图片始终存在于首屏 HTML。交互动画在 avatar-animated.tsx 中按需加载。
export const AVATAR_IMAGE_URL =
  "https://trudbot-md-img.oss-cn-shanghai.aliyuncs.com/2026/07/02/1782996318044_202407082112768.jpg";

// ─── AvatarFallbackSvg ───────────────────────────────────────────────────────
export function AvatarFallbackSvg() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="h-full w-full p-8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g className="animate-[pulse_4s_ease-in-out_infinite]">
        <path d="M20 30 Q35 25 48 30 L48 45 Q35 50 20 45 Z" className="fill-primary" />
        <rect
          x="52"
          y="26"
          width="28"
          height="18"
          rx="9"
          className="fill-secondary"
          transform="rotate(-4 66 35)"
        />
        <rect
          x="42"
          y="52"
          width="16"
          height="32"
          rx="6"
          className="fill-accent"
          transform="rotate(2 50 68)"
        />
      </g>
      <circle cx="28" cy="72" r="3" className="fill-primary/60 animate-[bounce_3s_infinite]" />
      <circle cx="78" cy="62" r="4" className="fill-secondary/50 animate-[pulse_2s_infinite]" />
      <circle cx="22" cy="22" r="2.5" className="fill-accent/60 animate-[ping_4s_infinite]" />
    </svg>
  );
}

// ─── AvatarPhoto (SSR 渲染的原生 <img>，保证首屏 HTML 中即存在头像) ──────────────
export function AvatarPhoto() {
  return (
    <div className="relative flex h-48 w-48 shrink-0 items-center justify-center overflow-hidden rounded-full border-8 border-background shadow-2xl md:h-64 md:w-64">
      {/* 加载中 / 加载失败时的占位，位于图片下方 */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/5 backdrop-blur-xl">
        <AvatarFallbackSvg />
      </div>
      <img
        src={AVATAR_IMAGE_URL}
        alt="trudbot"
        fetchPriority="high"
        decoding="async"
        className="relative z-10 h-full w-full object-cover"
      />
    </div>
  );
}

// ─── AvatarStatic (静态头像，无交互动画) ──────────────────────────────────────
export function AvatarStatic() {
  return (
    <div className="relative inline-block">
      <div className="absolute -left-8 -top-8 h-32 w-32 border-4 border-primary/30 clip-diamond" />
      <div className="absolute -bottom-6 -right-6 h-24 w-24 bg-accent/20 clip-triangle" />
      <div className="relative rounded-full">
        <AvatarPhoto />
      </div>
    </div>
  );
}
