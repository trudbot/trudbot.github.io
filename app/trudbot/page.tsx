import "./styles.css";
import { useEffect, useRef, useState } from "react";
import type { TrudbotViewer } from "./viewer";

const MODEL_URL = `${import.meta.env.BASE_URL}models/trudbot-full.glb`;

// Chinese labels for the clip names baked into the GLB.
const CLIP_LABELS: Record<string, string> = {
  idle: "待机",
  run: "跑步",
  jump: "跳跃",
  dance_02: "跳舞",
  bow: "鞠躬",
};

type Status = "loading" | "ready" | "error";

export default function TrudbotPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<TrudbotViewer | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [clips, setClips] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    document.title = "Trudbot 3D 模型";
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    import("./viewer")
      .then(async ({ TrudbotViewer }) => {
        if (disposed) return;
        const viewer = new TrudbotViewer(canvas);
        viewerRef.current = viewer;
        const names = await viewer.load(MODEL_URL);
        if (disposed) return;
        setClips(names);
        setActive(names.includes("idle") ? "idle" : (names[0] ?? null));
        setStatus("ready");
      })
      .catch((err) => {
        console.error("failed to load trudbot model", err);
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      viewerRef.current?.dispose();
      viewerRef.current = null;
    };
  }, []);

  const selectClip = (name: string) => {
    viewerRef.current?.play(name);
    setActive(name);
  };

  const toggleAutoRotate = () => {
    setAutoRotate((on) => {
      const next = !on;
      viewerRef.current?.setAutoRotate(next);
      return next;
    });
  };

  return (
    <main className="trudbot-page">
      <canvas ref={canvasRef} className="trudbot-canvas" aria-label="Trudbot 3D 模型" />

      <header className="trudbot-header">
        <h1 className="trudbot-title">Trudbot 3D 模型</h1>
        <p className="trudbot-subtitle">拖动旋转 · 滚轮缩放 · 点击下方播放动作</p>
      </header>

      <p className="trudbot-hint">
        拖动：旋转视角
        <br />
        滚轮 / 双指：缩放
        <br />
        右键拖动：平移
      </p>

      {status === "ready" && (
        <div className="trudbot-dock">
          {clips.map((name) => (
            <button
              key={name}
              type="button"
              className={`trudbot-chip${active === name ? " is-active" : ""}`}
              onClick={() => selectClip(name)}
            >
              {CLIP_LABELS[name] ?? name}
            </button>
          ))}
          <button
            type="button"
            className={`trudbot-chip is-toggle${autoRotate ? " is-active" : ""}`}
            onClick={toggleAutoRotate}
          >
            {autoRotate ? "停止自转" : "自动旋转"}
          </button>
        </div>
      )}

      {status !== "ready" && (
        <div className="trudbot-overlay">
          {status === "loading" ? (
            <>
              <span className="trudbot-spinner" />
              <span className="trudbot-overlay-text">模型加载中…</span>
            </>
          ) : (
            <span className="trudbot-overlay-text">模型加载失败，请刷新重试</span>
          )}
        </div>
      )}
    </main>
  );
}
