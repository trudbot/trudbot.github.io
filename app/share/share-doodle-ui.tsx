import { useEffect, useRef, useState } from "react";
import rough from "roughjs";

const INK = "#1C1917";

function observeElementSize(
  element: HTMLElement,
  onResize: (size: { width: number; height: number }) => void,
) {
  const updateSize = () => {
    const rect = element.getBoundingClientRect();
    onResize({ width: Math.round(rect.width), height: Math.round(rect.height) });
  };

  updateSize();

  if (typeof ResizeObserver === "undefined") return undefined;

  const resizeObserver = new ResizeObserver(([entry]) => {
    onResize({
      width: Math.round(entry.contentRect.width),
      height: Math.round(entry.contentRect.height),
    });
  });
  resizeObserver.observe(element);
  return () => resizeObserver.disconnect();
}

function WigglyUnderline({ color = "#FF7043" }: { color?: string }) {
  return (
    <svg
      className="text-share-wiggly-underline"
      height="6"
      viewBox="0 0 80 6"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 4.5 Q5 1 10 3.5 Q15 6 20 3.5 Q25 1 30 3.5 Q35 6 40 3.5 Q45 1 50 3.5 Q55 6 60 3.5 Q65 1 70 3.5 Q75 6 80 3.5"
        stroke={color}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ShareTopBar({ activePage }: { activePage: "share" | "receive" }) {
  return (
    <header className="text-share-topbar">
      <div className="text-share-topbar-inner">
        <a href="/share" className="text-share-brand" aria-label="文本分享首页">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <path
              d="M1.5 3 Q2 1.5 3.5 1.5 L26.5 1.5 Q28.5 1.5 28.5 3.5 L28.5 26.5 Q28.5 28.5 26 28.5 L3.5 28.5 Q1.5 28.5 1.5 26.5 Z"
              fill="#FFDE59"
              stroke={INK}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <rect x="4" y="4" width="8" height="8" rx="1" fill={INK} />
            <rect x="5.5" y="5.5" width="5" height="5" rx="0.5" fill="#FFDE59" />
            <rect x="18" y="4" width="8" height="8" rx="1" fill={INK} />
            <rect x="19.5" y="5.5" width="5" height="5" rx="0.5" fill="#FFDE59" />
            <rect x="4" y="18" width="8" height="8" rx="1" fill={INK} />
            <rect x="5.5" y="19.5" width="5" height="5" rx="0.5" fill="#FFDE59" />
            <rect x="18" y="18" width="3" height="3" rx="0.5" fill={INK} />
            <rect x="22" y="18" width="3" height="3" rx="0.5" fill={INK} />
            <rect x="25" y="21" width="3" height="3" rx="0.5" fill={INK} />
            <rect x="18" y="22" width="3" height="3" rx="0.5" fill={INK} />
            <rect x="22" y="25" width="3" height="3" rx="0.5" fill={INK} />
          </svg>
          <span>TextDoodle</span>
        </a>

        <nav className="text-share-nav" aria-label="分享页面导航">
          <a
            href="/share"
            className="text-share-nav-link"
            style={{ opacity: activePage === "share" ? 1 : 0.45 }}
          >
            生成
            {activePage === "share" && <WigglyUnderline color="#FF7043" />}
          </a>
          <span className="text-share-nav-separator">/</span>
          <a
            href="/share/r"
            className="text-share-nav-link"
            style={{ opacity: activePage === "receive" ? 1 : 0.45 }}
          >
            展示
            {activePage === "receive" && <WigglyUnderline color="#4CAF50" />}
          </a>
        </nav>

        <div className="text-share-step-indicator" aria-hidden="true">
          <span style={{ color: activePage === "share" ? "#FF7043" : "#4CAF50" }}>
            {activePage === "share" ? "01" : "02"}
          </span>
          <span className="text-share-step-divider"> / </span>
          <span>02</span>
        </div>
      </div>
    </header>
  );
}

export function RoughCard({
  children,
  fill = "#FFFDF5",
  seed = 1,
  className = "",
  style,
}: {
  children: React.ReactNode;
  fill?: string;
  seed?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    return observeElementSize(element, setSize);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.width === 0 || size.height === 0) return;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const roughSvg = rough.svg(svg);
    const padding = 5;
    svg.appendChild(
      roughSvg.rectangle(padding, padding, size.width - padding * 2, size.height - padding * 2, {
        fill,
        fillStyle: "solid",
        stroke: INK,
        strokeWidth: 2.5,
        roughness: 2.4,
        seed,
      }),
    );
  }, [size, fill, seed]);

  return (
    <div ref={containerRef} className={`text-share-rough-card ${className}`} style={style}>
      <svg
        ref={svgRef}
        width={size.width || "100%"}
        height={size.height || "100%"}
        className="text-share-rough-svg"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      />
      <div className="text-share-rough-content">{children}</div>
    </div>
  );
}

export function RoughActionButton({
  children,
  fill = "#FFDE59",
  seed = 1,
  onClick,
  disabled = false,
  className = "",
}: {
  children: React.ReactNode;
  fill?: string;
  seed?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = buttonRef.current;
    if (!element) return;
    return observeElementSize(element, setSize);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || size.width === 0 || size.height === 0) return;

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const roughSvg = rough.svg(svg);
    const padding = 4;
    svg.appendChild(
      roughSvg.rectangle(padding, padding, size.width - padding * 2, size.height - padding * 2, {
        fill: disabled ? "#E8E0CC" : fill,
        fillStyle: "solid",
        stroke: disabled ? "#BDB59E" : INK,
        strokeWidth: 2.2,
        roughness: 2,
        seed,
      }),
    );
  }, [size, fill, seed, disabled]);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-share-rough-button ${className}`}
    >
      <svg
        ref={svgRef}
        width={size.width || "100%"}
        height={size.height || "100%"}
        className="text-share-rough-svg"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      />
      <div className="text-share-rough-button-content">{children}</div>
    </button>
  );
}

export function CopiedBubble() {
  return (
    <div className="text-share-copied-bubble text-share-pop-in" aria-live="polite">
      <svg width="80" height="34" viewBox="0 0 80 34" aria-hidden="true">
        <path
          d="M4 2 Q3 1 5 1 L75 1 Q79 1 79 5 L79 24 Q79 28 75 28 L44 28 L40 33 L36 28 L5 28 Q1 28 1 24 L1 5 Q1 1 4 2 Z"
          fill="#4CAF50"
          stroke={INK}
          strokeWidth="1.8"
        />
        <text
          x="40"
          y="18"
          textAnchor="middle"
          fill="#FFFDF5"
          fontSize="13"
          fontFamily="Caveat, cursive"
          fontWeight="700"
        >
          已复制!
        </text>
      </svg>
    </div>
  );
}

export function ScribbleDivider() {
  return (
    <svg
      className="text-share-scribble-divider"
      width="100%"
      height="12"
      viewBox="0 0 400 12"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 8 Q25 2 50 7 Q75 12 100 7 Q125 2 150 7 Q175 12 200 7 Q225 2 250 7 Q275 12 300 7 Q325 2 350 7 Q375 12 400 7"
        stroke="#E8DFC8"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Sparkle({
  x = 0,
  y = 0,
  color = "#FF7043",
  size = 20,
}: {
  x?: number;
  y?: number;
  color?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      className="text-share-sparkle"
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <path
        d="M10 1 L11.2 8.5 L18 7 L12.5 11 L17 17 L10 13.5 L3 17 L7.5 11 L2 7 L8.8 8.5 Z"
        stroke={color}
        strokeWidth="1.2"
        fill={color}
        fillOpacity="0.3"
      />
    </svg>
  );
}
