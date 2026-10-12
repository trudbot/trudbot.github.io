import "./styles.css";
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from "react";
import { analyze, type Board, decodeHex, rotateCWBy } from "./engine";
import levelData from "./levels.json";
import { type Clear, formatTime, loadRecords, type Records, saveClear } from "./records";
import { SOURCE_COLORS, Tile } from "./tile";

interface Level extends Board {
  kind: "lesson" | "final";
  name: string;
  /** What this level adds; every earlier rule still applies. */
  lesson: string;
  /** Opening orientation; fixed so every player starts from the same position. */
  base: number[];
}

const LEVELS: Level[] = levelData.map((l) => ({
  ...l,
  kind: l.kind === "final" ? "final" : "lesson",
  barriers: decodeHex(l.barriers),
  base: decodeHex(l.tiles),
}));

type Phase = "ready" | "playing" | "won";

interface Run {
  turns: number[];
  locked: boolean[];
  steps: number;
  startAt: number;
}

const LESSON_COUNT = LEVELS.filter((l) => l.kind === "lesson").length;

const badge = (level: Level, idx: number) =>
  level.kind === "final" ? "实战关" : `教学关 ${idx + 1}/${LESSON_COUNT}`;

const freshRun = (level: Level): Run => ({
  turns: level.base.map(() => 0),
  locked: level.base.map(() => false),
  steps: 0,
  startAt: 0,
});

export default function NetPage() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("ready");
  const [run, setRun] = useState(() => freshRun(LEVELS[0]));
  const [now, setNow] = useState(0);
  const [result, setResult] = useState<Clear | null>(null);
  const [records, setRecords] = useState<Records>({});

  const level = LEVELS[levelIdx];
  const tiles = useMemo(
    () => level.base.map((v, i) => rotateCWBy(v, run.turns[i])),
    [level, run.turns],
  );
  const analysis = useMemo(() => analyze(level, tiles), [level, tiles]);
  const sourceAt = useMemo(() => {
    const at = new Map<number, number>();
    level.sources.forEach((s, k) => at.set(s, k));
    return at;
  }, [level]);

  useEffect(() => {
    document.title = "Net · 多色电网";
    setRecords(loadRecords());
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing" || !analysis.solved) return;
    const clear = { timeMs: Date.now() - run.startAt, steps: run.steps };
    setPhase("won");
    setResult(clear);
    setRecords((r) => saveClear(r, levelIdx, clear));
  }, [phase, analysis.solved, run, levelIdx]);

  const enter = (idx: number) => {
    setLevelIdx(idx);
    setRun(freshRun(LEVELS[idx]));
    setPhase("ready");
    setResult(null);
  };

  // The clock starts when the board is revealed, not on the first turn, so
  // nobody can study the grid for free and then rotate at full speed.
  const start = () => {
    const t = Date.now();
    setRun({ ...freshRun(level), startAt: t });
    setNow(t);
    setPhase("playing");
  };

  // Undo is not offered. Resetting restores the opening position but the
  // clock and step count keep running: it is a fresh look, not a fresh run.
  const reset = () =>
    setRun((r) => ({ ...r, turns: level.base.map(() => 0), locked: level.base.map(() => false) }));

  const press = useCallback(
    (i: number, lock: boolean) => {
      if (phase !== "playing") return;
      setRun((r) => {
        if (lock) {
          const locked = r.locked.slice();
          locked[i] = !locked[i];
          return { ...r, locked };
        }
        if (r.locked[i]) return r;
        const turns = r.turns.slice();
        turns[i]++;
        return { ...r, turns, steps: r.steps + 1 };
      });
    },
    [phase],
  );

  const elapsed = phase === "playing" ? now - run.startAt : (result?.timeMs ?? 0);
  const best = records[levelIdx];
  const allCleared = LEVELS.every((_, i) => records[i]);
  const totals = allCleared
    ? LEVELS.reduce(
        (acc, _, i) => ({
          timeMs: acc.timeMs + records[i].timeMs,
          steps: acc.steps + records[i].steps,
        }),
        { timeMs: 0, steps: 0 },
      )
    : null;
  const isLast = levelIdx === LEVELS.length - 1;
  const tileSize = `min(64px, calc((min(100vw, 560px) - 40px) / ${level.w}))`;

  return (
    <main className="net-page">
      <header className="net-header">
        <h1 className="net-title">Net · 多色电网</h1>
        <nav className="net-levels" aria-label="关卡">
          {LEVELS.map((l, i) => (
            <button
              key={l.name}
              type="button"
              className="net-level-chip"
              aria-current={i === levelIdx ? "true" : undefined}
              data-cleared={records[i] ? true : undefined}
              data-final={l.kind === "final" || undefined}
              onClick={() => enter(i)}
              title={`${badge(l, i)} · ${l.name}`}
            >
              {i + 1}
            </button>
          ))}
        </nav>
      </header>
      <section className="net-status" aria-live="polite">
        <div>
          <span className="net-level-name">
            {badge(level, levelIdx)} · {level.name}
          </span>
          <span className="net-level-meta">
            {level.w}×{level.h} · {level.sources.length} 个电源
          </span>
        </div>
        <div className="net-counters">
          <span>
            时间 <b>{formatTime(elapsed)}</b>
          </span>
          <span>
            步数 <b>{phase === "ready" ? 0 : run.steps}</b>
          </span>
        </div>
      </section>

      <div className="net-stage" style={{ "--tile": tileSize } as CSSProperties}>
        {phase === "ready" ? (
          <div
            className="net-card"
            style={{
              width: `calc(var(--tile) * ${level.w})`,
              minHeight: `calc(var(--tile) * ${level.h})`,
            }}
          >
            <p className="net-card-badge" data-final={level.kind === "final" || undefined}>
              {badge(level, levelIdx)}
            </p>
            <p className="net-card-title">{level.name}</p>
            <p className="net-card-text">{level.lesson}</p>
            {levelIdx > 0 && <p className="net-card-note">前面学过的规则在本关同样有效。</p>}
            <p className="net-card-sources">
              {level.sources.map((_, k) => (
                <span key={k} className="net-swatch" style={{ background: SOURCE_COLORS[k] }} />
              ))}
            </p>
            {best && (
              <p className="net-card-text">
                最佳 {formatTime(best.timeMs)} · {best.steps} 步
              </p>
            )}
            <button type="button" className="net-button net-button--primary" onClick={start}>
              开始计时
            </button>
          </div>
        ) : (
          <div
            className="net-board"
            data-won={phase === "won" || undefined}
            style={{ gridTemplateColumns: `repeat(${level.w}, var(--tile))` }}
          >
            {level.base.map((v, i) => (
              <Tile
                key={i}
                index={i}
                base={v}
                turns={run.turns[i]}
                owner={analysis.owner[i]}
                loopArms={analysis.loopArms[i]}
                barriers={level.barriers[i]}
                source={sourceAt.get(i) ?? -1}
                locked={run.locked[i]}
                label={`第 ${Math.floor(i / level.w) + 1} 行第 ${(i % level.w) + 1} 列${run.locked[i] ? "，已锁定" : ""}`}
                onPress={press}
              />
            ))}
          </div>
        )}
      </div>

      {phase === "playing" && (
        <div className="net-actions">
          <button type="button" className="net-button" onClick={reset}>
            复位
          </button>
          <span className="net-tip">点击顺时针转 · 长按或右键锁定 · 复位不清零时间和步数</span>
        </div>
      )}

      {phase === "won" && result && (
        <section className="net-result" aria-live="assertive">
          <p className="net-result-title">通电成功</p>
          <p>
            用时 <b>{formatTime(result.timeMs)}</b> · <b>{result.steps}</b> 步
          </p>
          {best && (
            <p className="net-result-best">
              个人最佳 {formatTime(best.timeMs)} · {best.steps} 步
            </p>
          )}
          <div className="net-actions">
            <button type="button" className="net-button" onClick={() => enter(levelIdx)}>
              再来一次
            </button>
            {!isLast && (
              <button
                type="button"
                className="net-button net-button--primary"
                onClick={() => enter(levelIdx + 1)}
              >
                下一关
              </button>
            )}
          </div>
        </section>
      )}

      <footer className="net-footer">
        {totals ? (
          <p>
            10 关总计：{formatTime(totals.timeMs)} · {totals.steps} 步（各关最佳之和）
          </p>
        ) : (
          <p>通关全部 10 关后显示总成绩。</p>
        )}
        <p className="net-credit">
          玩法基于 Simon Tatham&apos;s Portable Puzzle Collection 中的 Net（MIT 许可）。
        </p>
      </footer>
    </main>
  );
}
