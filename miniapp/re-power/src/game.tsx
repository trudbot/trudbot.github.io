import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, rotateCWBy, SHORT_CIRCUIT } from "@/app/net/engine";
import { sfx } from "./audio";
import { GameBoard } from "./board";
import { submitNote } from "./copy";
import { traceFlow } from "./flow";
import { badge, type Level, LEVELS, levelNo, SOURCE_COLORS } from "./levels";
import { syncFirstClears, useRanking } from "./ranking";
import { type Clear, formatTime, getSave, recordClear, updateSave, useSave } from "./save";
import { toast, vibrate } from "./sdk";
import { useVisible } from "./visibility";

type Phase = "brief" | "playing" | "won";

interface RunState {
  turns: number[];
  locked: boolean[];
  steps: number;
}

interface Result extends Clear {
  first: boolean;
  prevBest?: Clear;
}

const freshRun = (level: Level): RunState => ({
  turns: level.base.map(() => 0),
  locked: level.base.map(() => false),
  steps: 0,
});

/** Ranked time lost if the app is killed outright is bounded by this checkpoint interval. */
const CHECKPOINT_MS = 3000;
const LEVER_MS = 420;

export interface GameProps {
  level: Level;
  onExit: () => void;
  onPlay: (index: number) => void;
  onRanking: (index: number) => void;
}

export function Game({ level, onExit, onPlay, onRanking }: GameProps) {
  // Fixed on entry: the run that produces the first clear is the ranked one,
  // and every later visit is practice.
  const [ranked] = useState(() => !getSave().levels[level.index]);
  const [resume] = useState(() => {
    const r = getSave().run;
    return ranked && r?.level === level.index && r.turns.length === level.base.length ? r : null;
  });
  const [phase, setPhase] = useState<Phase>("brief");
  const [run, setRun] = useState<RunState>(() =>
    resume ? { turns: resume.turns, locked: resume.locked, steps: resume.steps } : freshRun(level),
  );
  const [focus, setFocus] = useState(-1);
  const [result, setResult] = useState<Result | null>(null);
  const [pulling, setPulling] = useState(false);
  const [, setTick] = useState(0);
  const visible = useVisible();
  const save = useSave();
  const { sync } = useRanking();

  // Clock: time banked so far plus the currently running stretch, which only
  // exists while the board is on screen and the app is in the foreground.
  const bank = useRef(resume?.elapsedMs ?? 0);
  const since = useRef<number | null>(null);
  const finished = useRef(false);
  const runRef = useRef(run);
  runRef.current = run;
  const elapsed = () =>
    bank.current + (since.current === null ? 0 : performance.now() - since.current);

  const tiles = useMemo(
    () => level.base.map((v, i) => rotateCWBy(v, run.turns[i])),
    [level, run.turns],
  );
  const analysis = useMemo(() => analyze(level, tiles), [level, tiles]);
  const flow = useMemo(() => traceFlow(level, tiles, analysis), [level, tiles, analysis]);

  const persist = useCallback(() => {
    if (!ranked || finished.current) return;
    const r = runRef.current;
    const elapsedMs = Math.round(
      bank.current + (since.current === null ? 0 : performance.now() - since.current),
    );
    updateSave((s) => ({
      ...s,
      run: { level: level.index, turns: r.turns, locked: r.locked, steps: r.steps, elapsedMs },
    }));
  }, [ranked, level.index]);

  const running = phase === "playing" && visible;
  useEffect(() => {
    if (!running) return;
    since.current = performance.now();
    const tick = setInterval(() => setTick((t) => t + 1), 100);
    const checkpoint = setInterval(persist, CHECKPOINT_MS);
    return () => {
      clearInterval(tick);
      clearInterval(checkpoint);
      if (since.current !== null) bank.current += performance.now() - since.current;
      since.current = null;
      persist();
    };
  }, [running, persist]);

  useEffect(() => {
    if (phase === "playing") persist();
  }, [run, phase, persist]);

  useEffect(() => {
    if (phase !== "playing" || !analysis.solved) return;
    const timeMs = Math.round(elapsed());
    finished.current = true;
    const steps = runRef.current.steps;
    const prevBest = getSave().levels[level.index]?.best;
    const first = recordClear(level.index, { timeMs, steps });
    setResult({ timeMs, steps, first, prevBest });
    setPhase("won");
    sfx.win();
    vibrate("heavy");
    vibrate("heavy", 850);
    if (first) void syncFirstClears();
    // elapsed reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, analysis.solved, level.index]);

  const lever = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(lever.current), []);
  const start = () => {
    if (pulling) return;
    setPulling(true);
    sfx.lever();
    vibrate("medium");
    lever.current = setTimeout(() => setPhase("playing"), LEVER_MS);
  };

  const press = useCallback(
    (i: number, lock: boolean) => {
      if (phase !== "playing") return;
      const r = runRef.current;
      if (lock) {
        const locked = r.locked.slice();
        locked[i] = !locked[i];
        sfx.lock();
        vibrate("light");
        setRun({ ...r, locked });
        return;
      }
      if (r.locked[i]) {
        sfx.deny();
        vibrate("light");
        return;
      }
      const turns = r.turns.slice();
      turns[i]++;
      sfx.rotate();
      vibrate("light");
      setFocus(i);
      setRun({ ...r, turns, steps: r.steps + 1 });
    },
    [phase],
  );

  // Undo is not offered. Resetting restores the opening position for free,
  // but the clock and step count keep running: a fresh look, not a fresh run.
  // Turning forward to the next full turn keeps every tile spinning clockwise.
  const reset = () => {
    const r = runRef.current;
    setRun({
      ...r,
      turns: r.turns.map((t) => t + ((4 - (t & 3)) & 3)),
      locked: r.locked.map(() => false),
    });
    setFocus(-1);
    sfx.lever();
    vibrate("medium");
  };

  const exit = () => {
    sfx.tap();
    if (ranked && phase === "playing") toast("抢修进度已保存，计时暂停");
    onExit();
  };

  let powered = 0;
  for (const o of analysis.owner) if (o >= 0) powered++;
  const total = level.base.length;
  const shorted = analysis.owner.includes(SHORT_CIRCUIT);
  const looped = analysis.loopArms.some((v) => v > 0);
  const showBoard = phase !== "brief";
  const time = phase === "won" && result ? result.timeMs : elapsed();
  const rec = save?.levels[level.index];
  const next = level.index + 1 < LEVELS.length ? level.index + 1 : -1;

  const tileSize =
    `min(64px, calc((100vw - 52px - var(--rp-safe-l) - var(--rp-safe-r)) / ${level.w}),` +
    ` calc((100dvh - 318px - var(--rp-safe-t) - var(--rp-safe-b)) / ${level.h}))`;

  let alarm = `供电 ${powered}/${total}`;
  if (phase === "won") alarm = "供电恢复";
  else if (shorted) alarm = "警告：短路，两路电源被接到了一起";
  else if (looped) alarm = "警告：线路成环";

  return (
    <div className="rp-game" data-phase={phase}>
      <header className="rp-game-bar">
        <button type="button" className="rp-back" onClick={exit} aria-label="返回关卡列表">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5 L8 12 L15 19" />
          </svg>
          撤离
        </button>
        <div className="rp-game-title">
          <span className="rp-game-no">{levelNo(level.index)}</span>
          <span className="rp-game-name">{level.name}</span>
        </div>
        <span className="rp-tag" data-ranked={ranked || undefined}>
          {ranked ? "排位" : "练习"}
        </span>
      </header>

      <div className="rp-hud" aria-live="off">
        <div className="rp-readout">
          <span>用时</span>
          <b>{formatTime(showBoard ? time : (resume?.elapsedMs ?? 0))}</b>
        </div>
        <div className="rp-readout">
          <span>步数</span>
          <b>{run.steps}</b>
        </div>
        <div className="rp-meter" aria-label={`供电 ${powered}/${total}`}>
          <span>供电</span>
          <div className="rp-meter-bar">
            {Array.from({ length: 10 }, (_, k) => (
              <i
                key={k}
                data-on={(showBoard && powered / total > k / 10) || undefined}
                data-hot={k >= 8 || undefined}
              />
            ))}
          </div>
        </div>
      </div>

      <p
        className="rp-alarm"
        data-level={phase === "won" ? "ok" : shorted || looped ? "bad" : undefined}
        aria-live="polite"
      >
        {showBoard ? alarm : "待命：拉下电闸后开始供电"}
      </p>

      <section className="rp-panel" style={{ "--rp-tile": tileSize } as CSSProperties}>
        <span className="rp-rivet" data-pos="tl" />
        <span className="rp-rivet" data-pos="tr" />
        <span className="rp-rivet" data-pos="bl" />
        <span className="rp-rivet" data-pos="br" />
        {showBoard ? (
          <GameBoard
            level={level}
            turns={run.turns}
            locked={run.locked}
            analysis={analysis}
            flow={flow}
            won={phase === "won"}
            focus={focus}
            onPress={press}
          />
        ) : (
          <div
            className="rp-brief"
            style={{
              width: `max(calc(var(--rp-tile) * ${level.w}), 260px)`,
              minHeight: `calc(var(--rp-tile) * ${level.h})`,
            }}
          >
            <p className="rp-brief-badge" data-final={level.kind === "final" || undefined}>
              {badge(level)}
            </p>
            <h2 className="rp-brief-title">
              {levelNo(level.index)} · {level.name}
            </h2>
            <p className="rp-brief-lesson">{level.lesson}</p>
            {level.index > 0 && <p className="rp-brief-note">前面学过的规则在本关同样有效。</p>}
            <p className="rp-brief-meta">
              {level.w}×{level.h} · 电源
              {level.sources.map((_, k) => (
                <span key={k} className="rp-swatch" style={{ background: SOURCE_COLORS[k] }} />
              ))}
            </p>
            <p className="rp-brief-rule">
              {!ranked
                ? "已通关：重复游玩不计入排行，只刷新个人最佳。"
                : resume
                  ? `抢修进行中：已用 ${formatTime(resume.elapsedMs)} · ${resume.steps} 步，合闸后继续计时。`
                  : "首次通关的用时与步数计入排行。合闸即开始计时，中途离开会暂停并保留进度。"}
            </p>
            {rec && (
              <p className="rp-brief-best">
                首通 {formatTime(rec.first.timeMs)} · {rec.first.steps} 步　最佳{" "}
                {formatTime(rec.best.timeMs)} · {rec.best.steps} 步
              </p>
            )}
            <button
              type="button"
              className="rp-breaker"
              data-pulled={pulling || undefined}
              onClick={start}
            >
              <span className="rp-breaker-slot" aria-hidden="true">
                <span className="rp-breaker-handle" />
              </span>
              <span className="rp-breaker-label">{resume ? "合闸 · 继续" : "合闸 · 开始"}</span>
            </button>
          </div>
        )}
      </section>

      <footer className="rp-game-actions">
        {phase === "playing" && (
          <>
            <button type="button" className="rp-btn" onClick={reset}>
              复位
            </button>
            <p className="rp-tip">点击顺时针转 · 长按锁定 · 复位不清零时间和步数</p>
          </>
        )}
      </footer>

      {phase === "won" && result && (
        <div className="rp-win" role="dialog" aria-modal="true" aria-labelledby="rp-win-title">
          <div className="rp-win-card">
            <p id="rp-win-title" className="rp-win-stamp">
              电力恢复
            </p>
            <p className="rp-win-sub">
              {levelNo(level.index)} {level.name} · {badge(level)}
            </p>
            <dl className="rp-win-stats">
              <div>
                <dt>用时</dt>
                <dd>{formatTime(result.timeMs)}</dd>
              </div>
              <div>
                <dt>步数</dt>
                <dd>{result.steps}</dd>
              </div>
            </dl>
            {result.first ? (
              <p className="rp-win-note" data-tone="rank">
                首次通关 · {submitNote(rec, sync)}
              </p>
            ) : (
              <p className="rp-win-note">
                {result.prevBest &&
                (result.timeMs < result.prevBest.timeMs || result.steps < result.prevBest.steps)
                  ? "刷新个人最佳！"
                  : "练习局"}
                　重复游玩不计入排行
              </p>
            )}
            {result.first && next < 0 && (
              <p className="rp-win-note" data-tone="ok">
                全部区域已恢复供电。辛苦了，幸存者。
              </p>
            )}
            <div className="rp-win-actions">
              {next >= 0 && (
                <button
                  type="button"
                  className="rp-btn"
                  data-primary
                  onClick={() => onPlay(next)}
                >
                  下一关
                </button>
              )}
              <button type="button" className="rp-btn" onClick={() => onRanking(level.index)}>
                查看排行
              </button>
              <button type="button" className="rp-btn" onClick={() => onPlay(level.index)}>
                再玩一次
              </button>
              <button type="button" className="rp-btn" data-ghost onClick={onExit}>
                返回关卡
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
