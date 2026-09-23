import "./styles.css";
import { HelpCircle, House, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { trackDisplay } from "@/lib/analytics";
import type { TownGame } from "./game/engine";
import { formatTenths } from "./game/format";
import type { ActionKey, DialogState, HudState } from "./game/types";

const INITIAL_HUD: HudState = {
  location: "trudbot 小镇",
  indoor: false,
  prompt: null,
  stars: 0,
  totalStars: 20,
  night: false,
  muted: false,
  boost: 0,
  grow: 0,
  hop: false,
  hopHeight: 0,
  hopGoal: 48,
  hopTime: null,
  hopBest: null,
  hopCheckpoint: 0,
  hopCheckpoints: 0,
};

const CONTROLS: Array<[string, string]> = [
  ["WASD / 方向键", "移动"],
  ["Shift", "奔跑"],
  ["空格", "跳跃"],
  ["E", "进门 / 互动"],
  ["Q / R", "挥手 / 跳舞"],
  ["拖动鼠标 / 滚轮", "转动视角 / 缩放"],
  ["N / M", "昼夜 / 静音"],
];

type Status = "loading" | "ready" | "playing" | "error";

let toastSeq = 0;

export default function TownPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<TownGame | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [fade, setFade] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [help, setHelp] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    document.title = "trudbot 的卡通小镇 · Trudbot Town";
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    let disposed = false;
    let game: TownGame | null = null;

    import("./game/engine")
      .then(({ TownGame }) => {
        if (disposed || !canvasRef.current) return;
        game = new TownGame(canvasRef.current, minimapRef.current, {
          onHud: (patch) => setHud((h) => ({ ...h, ...patch })),
          onDialog: setDialog,
          onFade: setFade,
          onToast: (text) => {
            const id = ++toastSeq;
            setToasts((list) => [...list.slice(-2), { id, text }]);
            window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 2600);
          },
        });
        gameRef.current = game;
        setStatus("ready");
      })
      .catch((err) => {
        console.error(err);
        trackDisplay("town_load_error", { reason: err instanceof Error ? err.message : String(err) });
        if (!disposed) setStatus("error");
      });

    return () => {
      disposed = true;
      game?.dispose();
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "KeyH") setHelp((v) => !v);
      if (e.code === "Escape") setHelp(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const start = () => {
    gameRef.current?.start();
    setStatus("playing");
  };
  const press = (action: ActionKey) => gameRef.current?.press(action);
  const playing = status === "playing";

  return (
    <main className={`town-root${hud.night ? " is-night" : ""}`}>
      <canvas ref={canvasRef} className="town-canvas" aria-label="3D 卡通小镇" />

      <div className={`town-hud${playing ? " is-visible" : ""}`} aria-hidden={!playing}>
        <div className="town-status">
          <span className="town-chip town-chip-location">{hud.location}</span>
          <span className="town-chip">
            ⭐ {hud.stars} / {hud.totalStars}
          </span>
          {hud.boost > 0 && <span className="town-chip town-chip-effect">☕ 加速 {hud.boost}s</span>}
          {hud.grow > 0 && <span className="town-chip town-chip-effect">🍰 变大 {hud.grow}s</span>}
        </div>

        {hud.hop && !hud.indoor && (
          <div className="town-hop" aria-label="云端跳跳乐进度">
            <div className="town-hop-bar">
              <div className="town-hop-fill" style={{ height: `${Math.min(100, (hud.hopHeight / hud.hopGoal) * 100)}%` }} />
            </div>
            <div className="town-hop-info">
              <span className="town-hop-title">云端跳跳乐</span>
              <span className="town-hop-height">
                {hud.hopHeight}
                <small> / {hud.hopGoal} m</small>
              </span>
              <span>
                🚩 {hud.hopCheckpoint} / {hud.hopCheckpoints}
              </span>
              {hud.hopTime !== null && <span>⏱ {formatTenths(hud.hopTime)}</span>}
              {hud.hopBest !== null && <span>🏆 {formatTenths(hud.hopBest)}</span>}
            </div>
          </div>
        )}

        <div className="town-actions">
          <button type="button" className="town-icon-btn" onClick={() => gameRef.current?.toggleMute()} aria-label={hud.muted ? "打开声音" : "静音"}>
            {hud.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button type="button" className="town-icon-btn" onClick={() => gameRef.current?.toggleNight()} aria-label="切换昼夜">
            {hud.night ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button type="button" className="town-icon-btn" onClick={() => setHelp((v) => !v)} aria-label="操作说明">
            <HelpCircle size={18} />
          </button>
          <a className="town-icon-btn" href="/" aria-label="返回首页">
            <House size={18} />
          </a>
        </div>

        <canvas ref={minimapRef} className={`town-minimap${hud.indoor ? " is-hidden" : ""}`} aria-label="小地图" />

        {hud.prompt && !dialog && (
          <div className="town-prompt">
            <kbd>{touch ? "✋" : "E"}</kbd>
            {hud.prompt}
          </div>
        )}

        <div className="town-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="town-toast">
              {t.text}
            </div>
          ))}
        </div>

        {dialog && <DialogBox dialog={dialog} onAdvance={() => gameRef.current?.advanceDialog()} touch={touch} />}

        {help && (
          <div className="town-help" role="dialog" aria-label="操作说明">
            <h2>操作说明</h2>
            <ControlList />
            <p>
              走到门口就能进屋，屋子里的家具大多可以互动。星星藏在小镇和每间屋子里，有的需要跳上箱子或蘑菇才能拿到。东南角的「云端跳跳乐」沿着魔豆藤一路跳到 48 米高的云端，途中有检查点，掉下来可以在起点乘云回去。
            </p>
            <button type="button" className="town-btn" onClick={() => setHelp(false)}>
              知道啦
            </button>
          </div>
        )}

        {touch && playing && <TouchControls game={gameRef} canInteract={!!hud.prompt || !!dialog} onPress={press} />}
      </div>

      {!playing && (
        <div className="town-intro">
          <div className="town-intro-card">
            <p className="town-kicker">TRUDBOT TOWN · 3D</p>
            <h1>trudbot 的卡通小镇</h1>
            <p className="town-intro-text">
              操控蓝头发的 trudbot 在卡通小镇里散步、进屋探险、收集 20 颗星星。咖啡馆、图书馆、面包房、花店、游戏厅、音乐小屋、观星台，还有 trudbot 自己的家——每间屋子都有自己的小秘密。小镇东南角的魔豆藤旁还有一座「云端跳跳乐」，一路跳到天上去吧！
            </p>
            <ControlList />
            <button type="button" className="town-btn town-start" onClick={start} disabled={status !== "ready"}>
              {status === "loading" && "小镇搭建中…"}
              {status === "ready" && "进入小镇"}
              {status === "error" && "你的浏览器暂不支持 WebGL"}
            </button>
            <p className="town-hint">建议戴上耳机：音乐和音效都是实时合成的。</p>
          </div>
        </div>
      )}

      <div className={`town-fade${fade ? " is-active" : ""}`} />
    </main>
  );
}

function ControlList() {
  return (
    <ul className="town-controls">
      {CONTROLS.map(([key, label]) => (
        <li key={key}>
          <kbd>{key}</kbd>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}

function DialogBox({ dialog, onAdvance, touch }: { dialog: DialogState; onAdvance: () => void; touch: boolean }) {
  const [shown, setShown] = useState(0);
  const full = dialog.text.length;

  useEffect(() => {
    setShown(0);
    const id = window.setInterval(() => {
      setShown((n) => {
        if (n >= full) {
          window.clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, 28);
    return () => window.clearInterval(id);
  }, [dialog.text, dialog.page, full]);

  const click = () => {
    if (shown < full) setShown(full);
    else onAdvance();
  };

  return (
    <button type="button" className="town-dialog" onClick={click}>
      <span className="town-dialog-title">{dialog.title}</span>
      <span className="town-dialog-text">{dialog.text.slice(0, shown)}</span>
      <span className="town-dialog-more">
        {dialog.pages > 1 && `${dialog.page + 1}/${dialog.pages} · `}
        {touch ? "点击继续" : "E / 点击继续"} ▾
      </span>
    </button>
  );
}

function TouchControls({
  game,
  canInteract,
  onPress,
}: {
  game: RefObject<TownGame | null>;
  canInteract: boolean;
  onPress: (action: ActionKey) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const move = (e: ReactPointerEvent) => {
    const rect = baseRef.current!.getBoundingClientRect();
    const radius = rect.width / 2;
    let x = (e.clientX - rect.left - radius) / radius;
    let y = (e.clientY - rect.top - radius) / radius;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    setKnob({ x, y });
    game.current?.setJoystick(x, -y);
  };
  const release = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    game.current?.setJoystick(0, 0);
  };
  const tap = (action: ActionKey) => (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onPress(action);
  };

  return (
    <>
      <div
        ref={baseRef}
        className="town-joystick"
        onPointerDown={(e) => {
          pointer.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => {
          if (pointer.current === e.pointerId) move(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
      >
        <div className="town-joystick-knob" style={{ transform: `translate(${knob.x * 38}px, ${knob.y * 38}px)` }} />
      </div>
      <div className="town-touch-buttons">
        <button type="button" className="town-round-btn" onPointerDown={tap("wave")} aria-label="挥手">
          👋
        </button>
        <button type="button" className={`town-round-btn${canInteract ? " is-hot" : ""}`} onPointerDown={tap("interact")} aria-label="互动">
          ✋
        </button>
        <button
          type="button"
          className="town-round-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            game.current?.setRunButton(true);
          }}
          onPointerUp={() => game.current?.setRunButton(false)}
          onPointerLeave={() => game.current?.setRunButton(false)}
          aria-label="奔跑"
        >
          跑
        </button>
        <button type="button" className="town-round-btn town-round-btn-big" onPointerDown={tap("jump")} aria-label="跳跃">
          跳
        </button>
      </div>
    </>
  );
}
