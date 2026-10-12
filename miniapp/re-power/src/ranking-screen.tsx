import { useEffect, useRef, useState } from "react";
import { sfx } from "./audio";
import { submitNote } from "./copy";
import { LEVELS, levelNo } from "./levels";
import {
  callSign,
  fetchMine,
  type Metric,
  rankRows,
  readSnapshot,
  type Snapshot,
  syncFirstClears,
  useRanking,
} from "./ranking";
import { formatTime, isUnlocked, useSave } from "./save";
import { errorCode, isRateLimited, sdkReady } from "./sdk";

type View =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "error"; code?: string; limited: boolean }
  | { status: "ready"; snapshot: Snapshot };

const METRIC_LABEL: Record<Metric, string> = { time: "用时榜", steps: "步数榜" };
/** Rows rendered at first; the rest come in on demand. */
const SHOWN = 50;

const formatScore = (metric: Metric, c: { timeMs: number; steps: number }) =>
  metric === "time" ? formatTime(c.timeMs) : `${c.steps} 步`;
const formatSecondary = (metric: Metric, c: { timeMs: number; steps: number }) =>
  metric === "time" ? `${c.steps} 步` : formatTime(c.timeMs);

export function RankingScreen({ level, onLevel }: { level: number; onLevel: (i: number) => void }) {
  const save = useSave();
  const { sync, mine } = useRanking();
  const [metric, setMetric] = useState<Metric>("time");
  const [view, setView] = useState<View>({ status: "loading" });
  const [refresh, setRefresh] = useState(0);
  const [shown, setShown] = useState(SHOWN);
  const chips = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chips.current
      ?.querySelector<HTMLElement>(`[data-level="${level}"]`)
      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    setShown(SHOWN);
  }, [level]);

  // A submission replaces the account's entry, so the split board is re-read
  // whenever the entry the platform holds for this account changes.
  const mineStamp = mine?.updatedAt;
  useEffect(() => {
    let alive = true;
    setView((v) => (v.status === "ready" && refresh === 0 ? v : { status: "loading" }));
    void (async () => {
      if (!(await sdkReady)) {
        if (alive) setView({ status: "offline" });
        return;
      }
      await syncFirstClears();
      if (mine === undefined) await fetchMine();
      try {
        const snapshot = await readSnapshot(refresh > 0);
        if (alive) setView({ status: "ready", snapshot });
      } catch (error) {
        if (alive) setView({ status: "error", code: errorCode(error), limited: isRateLimited(error) });
      }
    })();
    return () => {
      alive = false;
    };
    // mine is read only to skip a redundant fetch; mineStamp tracks its changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, mineStamp]);

  if (!save) return null;
  const rec = save.levels[level];
  const rows = view.status === "ready" ? rankRows(view.snapshot.levels[level], metric) : [];
  const myIndex = mine ? rows.findIndex((r) => r.appUserId === mine.appUserId) : -1;

  let mineLine: string;
  let mineScore = "";
  if (myIndex >= 0) {
    mineLine = `第 ${myIndex + 1} 名`;
    mineScore = formatScore(metric, rows[myIndex]);
  } else if (rec) {
    mineLine = submitNote(rec, sync);
    mineScore = formatScore(metric, rec.first);
  } else {
    mineLine = isUnlocked(save, level) ? "尚未恢复本区供电" : "本区尚未解锁";
  }

  return (
    <div className="rp-screen">
      <header className="rp-hero">
        <div>
          <p className="rp-kicker">幸存者记录 · SURVIVOR LOG</p>
          <h1 className="rp-hero-title">排行榜</h1>
        </div>
        <button
          type="button"
          className="rp-icon-btn"
          aria-label="刷新"
          onClick={() => {
            sfx.tap();
            setRefresh((n) => n + 1);
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M19 12 A7 7 0 1 1 16.5 6.6 M17 3 V7 H13" />
          </svg>
        </button>
      </header>

      <div className="rp-chips" ref={chips} role="tablist" aria-label="关卡">
        {LEVELS.map((l, i) => (
          <button
            key={l.name}
            type="button"
            role="tab"
            className="rp-chip"
            data-level={i}
            data-cleared={Boolean(save.levels[i]) || undefined}
            data-final={l.kind === "final" || undefined}
            aria-selected={i === level}
            onClick={() => {
              sfx.tap();
              onLevel(i);
            }}
          >
            {levelNo(i)}
          </button>
        ))}
      </div>

      <div className="rp-segment" role="tablist" aria-label="排行类型">
        {(["time", "steps"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={metric === m}
            onClick={() => {
              sfx.tap();
              setMetric(m);
            }}
          >
            {METRIC_LABEL[m]}
          </button>
        ))}
      </div>

      <p className="rp-rule">
        {levelNo(level)} {LEVELS[level].name} · 只统计每位幸存者的首次通关，重复游玩不计入
      </p>

      <section className="rp-mine" aria-label="我的成绩">
        <span className="rp-mine-tag">我</span>
        <span className="rp-mine-line">{mineLine}</span>
        {mineScore && <b className="rp-mine-score">{mineScore}</b>}
      </section>

      {view.status === "loading" && (
        <ol className="rp-rows" aria-busy="true">
          {Array.from({ length: 6 }, (_, k) => (
            <li key={k} className="rp-row" data-skeleton />
          ))}
        </ol>
      )}
      {view.status === "offline" && (
        <p className="rp-empty">排行榜需要在小黑盒 App 内查看。本机成绩已保存，进入 App 后自动提交首通成绩。</p>
      )}
      {view.status === "error" && (
        <div className="rp-empty">
          <p>
            {view.limited
              ? "请求过于频繁，稍等片刻再刷新。"
              : `排行榜暂时无法读取${view.code ? `（${view.code}）` : ""}。`}
          </p>
          <button type="button" className="rp-btn" onClick={() => setRefresh((n) => n + 1)}>
            重试
          </button>
        </div>
      )}
      {view.status === "ready" &&
        (rows.length === 0 ? (
          <p className="rp-empty">还没有人恢复这一区的供电。抢下第一名。</p>
        ) : (
          <>
            <ol className="rp-rows">
              {rows.slice(0, shown).map((row, k) => {
                const isMe = k === myIndex;
                return (
                  <li
                    key={row.appUserId}
                    className="rp-row"
                    data-me={isMe || undefined}
                    data-podium={k < 3 ? k + 1 : undefined}
                    style={{ animationDelay: `${Math.min(k, 12) * 30}ms` }}
                  >
                    <span className="rp-row-rank">{k + 1}</span>
                    <span className="rp-row-name">
                      {callSign(row.appUserId)}
                      {isMe && <span className="rp-row-me">我</span>}
                    </span>
                    <span className="rp-row-score">
                      <b>{formatScore(metric, row)}</b>
                      <small>{formatSecondary(metric, row)}</small>
                    </span>
                  </li>
                );
              })}
            </ol>
            {rows.length > shown && (
              <button type="button" className="rp-btn rp-more" onClick={() => setShown((n) => n + SHOWN)}>
                显示更多
              </button>
            )}
            {!view.snapshot.complete && <p className="rp-rule">仅统计进度靠前的幸存者</p>}
          </>
        ))}
    </div>
  );
}
