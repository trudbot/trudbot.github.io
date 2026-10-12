import { sfx } from "./audio";
import { submitNote } from "./copy";
import { badge, LEVELS, levelNo, SOURCE_COLORS } from "./levels";
import { useRanking } from "./ranking";
import { formatTime, isUnlocked, updateSave, useSave } from "./save";
import { toast, vibrate } from "./sdk";

function Settings() {
  const save = useSave();
  if (!save) return null;
  const { sound, haptics } = save.settings;
  const toggle = (key: "sound" | "haptics") => {
    updateSave((s) => ({ ...s, settings: { ...s.settings, [key]: !s.settings[key] } }));
    sfx.tap();
    if (key === "haptics" && !haptics) vibrate("medium");
  };
  return (
    <div className="rp-settings">
      <button
        type="button"
        className="rp-icon-btn"
        aria-pressed={sound}
        aria-label="音效"
        onClick={() => toggle("sound")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9 H8 L13 5 V19 L8 15 H4 Z" />
          {sound ? <path d="M16 9 Q18.5 12 16 15 M18.5 6.5 Q23 12 18.5 17.5" /> : <path d="M16 9 L22 15 M22 9 L16 15" />}
        </svg>
      </button>
      <button
        type="button"
        className="rp-icon-btn"
        aria-pressed={haptics}
        aria-label="振动"
        onClick={() => toggle("haptics")}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x={8} y={4} width={8} height={16} rx={1.5} />
          {haptics ? <path d="M4 8 V16 M20 8 V16 M1.5 10 V14 M22.5 10 V14" /> : <path d="M3 3 L21 21" />}
        </svg>
      </button>
    </div>
  );
}

export function LevelList({ onPlay }: { onPlay: (index: number) => void }) {
  const save = useSave();
  const { sync } = useRanking();
  if (!save) return null;
  const cleared = LEVELS.filter((_, i) => save.levels[i]).length;

  return (
    <div className="rp-screen">
      <header className="rp-hero">
        <div>
          <p className="rp-kicker">设施配电图 · SECTOR GRID</p>
          <h1 className="rp-hero-title">
            通通电
          </h1>
        </div>
        <Settings />
      </header>

      <div className="rp-progress" aria-label={`已恢复 ${cleared}/${LEVELS.length} 个区域`}>
        <span>
          供电恢复 <b>{cleared}</b>/{LEVELS.length}
        </span>
        <div className="rp-progress-cells">
          {LEVELS.map((l, i) => (
            <i key={l.name} data-on={Boolean(save.levels[i]) || undefined} />
          ))}
        </div>
      </div>

      <ol className="rp-level-list">
        {LEVELS.map((level, i) => {
          const rec = save.levels[i];
          const unlocked = isUnlocked(save, i);
          const state = rec ? "cleared" : unlocked ? "open" : "locked";
          const active = !rec && save.run?.level === i ? save.run : null;
          const pending = rec?.submit === "pending";
          return (
            <li key={level.name}>
              <button
                type="button"
                className="rp-level"
                data-state={state}
                data-final={level.kind === "final" || undefined}
                aria-disabled={!unlocked || undefined}
                style={{ animationDelay: `${i * 40}ms` }}
                onClick={() => {
                  if (!unlocked) {
                    sfx.deny();
                    vibrate("light");
                    toast(`先恢复 ${levelNo(i - 1)} 区的供电`);
                    return;
                  }
                  sfx.tap();
                  onPlay(i);
                }}
              >
                <span className="rp-level-no">{levelNo(i)}</span>
                <span className="rp-level-body">
                  <span className="rp-level-badge">{badge(level)}</span>
                  <span className="rp-level-name">{level.name}</span>
                  <span className="rp-level-meta">
                    {level.w}×{level.h}
                    {level.sources.map((_, k) => (
                      <span
                        key={k}
                        className="rp-swatch"
                        style={{ background: unlocked ? SOURCE_COLORS[k] : undefined }}
                      />
                    ))}
                  </span>
                </span>
                <span className="rp-level-status">
                  {rec ? (
                    <>
                      <span className="rp-status-head">
                        <span className="rp-lamp" data-on />
                        已通电
                      </span>
                      <span>
                        首通 {formatTime(rec.first.timeMs)} · {rec.first.steps}步
                      </span>
                      <span className="rp-status-dim">
                        {pending
                          ? submitNote(rec, sync)
                          : `最佳 ${formatTime(rec.best.timeMs)} · ${rec.best.steps}步`}
                      </span>
                    </>
                  ) : unlocked ? (
                    <>
                      <span className="rp-status-head" data-tone="warn">
                        <span className="rp-lamp" data-blink />
                        {active ? "抢修中" : "待抢修"}
                      </span>
                      {active && (
                        <span>
                          {formatTime(active.elapsedMs)} · {active.steps}步
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="rp-status-head" data-tone="off">
                      <svg className="rp-padlock" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x={5} y={11} width={14} height={10} rx={1.5} />
                        <path d="M8 11 V8 A4 4 0 0 1 16 8 V11" />
                      </svg>
                      断电
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="rp-credit">
        玩法基于 Simon Tatham&apos;s Portable Puzzle Collection 中的 Net（MIT 许可）。
      </p>
    </div>
  );
}
