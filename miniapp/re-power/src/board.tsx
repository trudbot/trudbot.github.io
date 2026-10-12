import { type CSSProperties, memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  type Analysis,
  D,
  DIRS,
  L,
  popcount,
  R,
  rotateCWBy,
  SHORT_CIRCUIT,
  U,
  UNPOWERED,
} from "@/app/net/engine";
import { sfx } from "./audio";
import type { Flow } from "./flow";
import { type Level, SHORT_COLOR, SOURCE_COLORS } from "./levels";
import { vibrate } from "./sdk";

// Wire geometry in a 100×100 tile; y points down.
const ARM_END: Record<number, [number, number]> = {
  [R]: [100, 50],
  [U]: [50, 0],
  [L]: [0, 50],
  [D]: [50, 100],
};
const EDGE: Record<number, [number, number, number, number]> = {
  [R]: [100, 0, 100, 100],
  [U]: [0, 0, 100, 0],
  [L]: [0, 0, 0, 100],
  [D]: [0, 100, 100, 100],
};
const STEP: Record<number, [number, number]> = { [R]: [1, 0], [U]: [0, -1], [L]: [-1, 0], [D]: [0, 1] };

/** Time current takes to cross half a tile while a newly connected run lights up. */
const ARM_MS = 70;
const LONG_PRESS_MS = 450;

function wireColor(owner: number): string | undefined {
  if (owner === SHORT_CIRCUIT) return SHORT_COLOR;
  if (owner === UNPOWERED) return undefined;
  return SOURCE_COLORS[owner];
}

interface TileProps {
  index: number;
  /** Tile value at the start of the level; the shape that gets rotated. */
  base: number;
  /** Clockwise quarter turns so far. Kept unwrapped so the animation always turns forward. */
  turns: number;
  owner: number;
  /** Screen-oriented arms that lie on a closed loop. */
  loopArms: number;
  barriers: number;
  /** Colour of the source on this tile, or -1. */
  source: number;
  locked: boolean;
  /** Screen direction current arrives from; decides which way the pulses run. */
  inlet: number;
  /** Changes whenever this tile freshly receives power, replaying the light-up. */
  surge: number;
  surgeDelay: number;
  /** Hops from the source once the level is won, driving the victory wave; -1 otherwise. */
  wave: number;
  label: string;
  onPress: (index: number, lock: boolean) => void;
}

const Tile = memo(function Tile(props: TileProps) {
  const { index, base, turns, owner, loopArms, barriers, source, locked, inlet } = props;
  const { surge, surgeDelay, wave, label, onPress } = props;
  const color = wireColor(owner);
  const isLamp = popcount(base) === 1 && source < 0;
  const arms = DIRS.filter((d) => base & d);
  const self = useRef<HTMLButtonElement>(null);

  // Long press (touch) and right click (mouse) lock; a plain tap rotates.
  // Refs, not locals: locking re-renders the tile before the trailing click,
  // and that click must still know it belongs to a long press.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pressing = useRef(false);
  const longPressed = useRef(false);
  const cancel = () => {
    clearTimeout(timer.current);
    pressing.current = false;
  };
  const press = (lock: boolean) => {
    if (!lock && locked) {
      self.current?.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(-2px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 240, easing: "ease-out" },
      );
    }
    onPress(index, lock);
  };

  return (
    <button
      ref={self}
      type="button"
      className="rp-tile"
      data-locked={locked || undefined}
      data-lit={color !== undefined || undefined}
      data-short={owner === SHORT_CIRCUIT || undefined}
      data-surge={surge > 0 || undefined}
      aria-label={label}
      style={
        {
          "--rp-delay": `${surgeDelay}ms`,
          "--rp-arm-ms": `${ARM_MS}ms`,
          "--rp-wave": wave,
          "--rp-c": color,
        } as CSSProperties
      }
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        longPressed.current = false;
        pressing.current = true;
        timer.current = setTimeout(() => {
          pressing.current = false;
          longPressed.current = true;
          press(true);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        // Some touch browsers raise contextmenu for a long press, before or
        // after our own timer; either way it must lock exactly once.
        if (longPressed.current) return;
        if (pressing.current) {
          cancel();
          longPressed.current = true;
        }
        press(true);
      }}
      onClick={() => {
        if (longPressed.current) longPressed.current = false;
        else press(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "l" || e.key === "L") press(true);
      }}
    >
      <svg
        className="rp-wires"
        viewBox="0 0 100 100"
        style={{ transform: `rotate(${turns * 90}deg)` }}
        aria-hidden="true"
      >
        {arms.map((d) => {
          const [x, y] = ARM_END[d];
          return <line key={d} className="rp-arm-dead" x1={50} y1={50} x2={x} y2={y} />;
        })}
        {(color !== undefined || loopArms > 0) && (
          // Keyed by surge so a fresh connection remounts and replays the light-up.
          <g key={surge} className="rp-lit">
            {arms.map((d) => {
              const screen = rotateCWBy(d, turns);
              // A loop is marked even when it carries no power.
              if (color === undefined && !(loopArms & screen)) return null;
              const inbound = screen === inlet;
              const [x, y] = ARM_END[d];
              // Lines run in the direction of the current so the pulses travel outwards.
              const [x1, y1, x2, y2] = inbound ? [x, y, 50, 50] : [50, 50, x, y];
              return (
                <g
                  key={d}
                  data-in={inbound || undefined}
                  data-loop={loopArms & screen ? true : undefined}
                >
                  <line className="rp-arm-glow" x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} />
                  <line className="rp-arm-lit" x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} />
                  <line className="rp-arm-flow" x1={x1} y1={y1} x2={x2} y2={y2} />
                </g>
              );
            })}
          </g>
        )}
      </svg>
      {source >= 0 && (
        <svg className="rp-fixture" viewBox="0 0 100 100" aria-hidden="true">
          <rect className="rp-gen-halo" x={22} y={22} width={56} height={56} rx={8} />
          <rect
            className="rp-gen"
            x={27}
            y={27}
            width={46}
            height={46}
            rx={6}
            style={{ stroke: SOURCE_COLORS[source] }}
          />
          <path
            className="rp-gen-bolt"
            d="M54 32 L39 53 H49 L45 68 L61 46 H51 Z"
            style={{ fill: SOURCE_COLORS[source] }}
          />
        </svg>
      )}
      {isLamp && (
        <svg className="rp-fixture" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="rp-lamp-ring" cx={50} cy={50} r={17} />
          <circle className="rp-lamp-glass" cx={50} cy={50} r={11} />
          {color !== undefined && (
            <circle key={surge} className="rp-lamp-on" cx={50} cy={50} r={11} />
          )}
        </svg>
      )}
      {barriers > 0 && (
        <svg className="rp-walls" viewBox="0 0 100 100" aria-hidden="true">
          {DIRS.filter((d) => barriers & d).map((d) => {
            const [x1, y1, x2, y2] = EDGE[d];
            return (
              <g key={d}>
                <line className="rp-wall" x1={x1} y1={y1} x2={x2} y2={y2} />
                <line className="rp-wall-stripe" x1={x1} y1={y1} x2={x2} y2={y2} />
              </g>
            );
          })}
        </svg>
      )}
      {locked && (
        <svg className="rp-clamp" viewBox="0 0 100 100" aria-hidden="true">
          <path d="M6 24 V6 H24 M76 6 H94 V24 M94 76 V94 H76 M24 94 H6 V76" />
        </svg>
      )}
    </button>
  );
});

interface Spark {
  id: number;
  /** Position in tile units from the board's top-left corner. */
  x: number;
  y: number;
  color: string;
  big: boolean;
  rays: Array<{ a: number; r: number }>;
}

function makeSpark(id: number, x: number, y: number, color: string, big: boolean): Spark {
  const n = big ? 11 : 7;
  const rays = Array.from({ length: n }, (_, k) => ({
    a: (360 / n) * k + Math.random() * 30,
    r: (big ? 0.55 : 0.35) + Math.random() * 0.35,
  }));
  return { id, x, y, color, big, rays };
}

interface Surge {
  id: number;
  delay: number;
}

export interface BoardProps {
  level: Level;
  turns: number[];
  locked: boolean[];
  analysis: Analysis;
  flow: Flow;
  won: boolean;
  /** Tile most recently rotated; short circuits spark there. */
  focus: number;
  onPress: (index: number, lock: boolean) => void;
}

export function GameBoard({ level, turns, locked, analysis, flow, won, focus, onPress }: BoardProps) {
  const size = level.w * level.h;
  const [surges, setSurges] = useState<Surge[]>(() =>
    Array.from({ length: size }, () => ({ id: 0, delay: 0 })),
  );
  const [sparks, setSparks] = useState<Spark[]>([]);
  // Everything starts dark, so the opening position lights up from the
  // sources as soon as the board is switched on.
  const prevOwner = useRef<Int8Array>(new Int8Array(size).fill(UNPOWERED));
  const generation = useRef(0);
  const sparkId = useRef(0);

  useLayoutEffect(() => {
    const prev = prevOwner.current;
    const { owner } = analysis;
    prevOwner.current = owner;
    const fresh: number[] = [];
    let shorted = false;
    for (let i = 0; i < size; i++) {
      if (owner[i] >= 0 && owner[i] !== prev[i]) fresh.push(i);
      if (owner[i] === SHORT_CIRCUIT && prev[i] !== SHORT_CIRCUIT) shorted = true;
    }
    const newSparks: Spark[] = [];

    if (fresh.length) {
      const gen = ++generation.current;
      let lo = Infinity;
      let hi = 0;
      for (const i of fresh) {
        lo = Math.min(lo, flow.depth[i]);
        hi = Math.max(hi, flow.depth[i]);
      }
      // Long runs light up faster so even a full board is lit within about a second.
      const hop = Math.max(25, Math.min(2 * ARM_MS, 1100 / (hi - lo + 1)));
      setSurges((s) => {
        const next = s.slice();
        for (const i of fresh) next[i] = { id: gen * size + i + 1, delay: (flow.depth[i] - lo) * hop };
        return next;
      });
      // Sparks where the current jumps a newly closed gap.
      for (const i of fresh) {
        if (flow.depth[i] !== lo || newSparks.length >= 2) continue;
        const [dx, dy] = STEP[flow.inlet[i]] ?? [0, 0];
        newSparks.push(
          makeSpark(
            ++sparkId.current,
            (i % level.w) + 0.5 + dx * 0.5,
            Math.floor(i / level.w) + 0.5 + dy * 0.5,
            SOURCE_COLORS[owner[i]],
            false,
          ),
        );
      }
      sfx.connect(fresh.length);
      vibrate("medium");
    }
    if (shorted && focus >= 0) {
      newSparks.push(
        makeSpark(
          ++sparkId.current,
          (focus % level.w) + 0.5,
          Math.floor(focus / level.w) + 0.5,
          SHORT_COLOR,
          true,
        ),
      );
      sfx.short();
      vibrate("heavy");
    }
    if (newSparks.length) setSparks((s) => [...s, ...newSparks]);
    // Only the analysis drives this; flow and focus are read for the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis]);

  useEffect(() => {
    if (!sparks.length) return;
    const newest = sparks[sparks.length - 1].id;
    const id = setTimeout(() => setSparks((s) => s.filter((p) => p.id > newest)), 650);
    return () => clearTimeout(id);
  }, [sparks]);

  const sourceAt = new Map<number, number>();
  level.sources.forEach((s, k) => sourceAt.set(s, k));

  return (
    <div
      className="rp-board"
      data-won={won || undefined}
      style={{ gridTemplateColumns: `repeat(${level.w}, var(--rp-tile))` }}
    >
      {level.base.map((v, i) => (
        <Tile
          key={i}
          index={i}
          base={v}
          turns={turns[i]}
          owner={analysis.owner[i]}
          loopArms={analysis.loopArms[i]}
          barriers={level.barriers[i]}
          source={sourceAt.get(i) ?? -1}
          locked={locked[i]}
          inlet={flow.inlet[i]}
          surge={surges[i].id}
          surgeDelay={surges[i].delay}
          wave={won ? Math.max(0, flow.depth[i]) : -1}
          label={`第 ${Math.floor(i / level.w) + 1} 行第 ${(i % level.w) + 1} 列${locked[i] ? "，已锁定" : ""}`}
          onPress={onPress}
        />
      ))}
      <div className="rp-sparks" aria-hidden="true">
        {sparks.map((s) => (
          <span
            key={s.id}
            className="rp-spark"
            data-big={s.big || undefined}
            style={
              {
                left: `calc(var(--rp-tile) * ${s.x})`,
                top: `calc(var(--rp-tile) * ${s.y})`,
                "--rp-c": s.color,
              } as CSSProperties
            }
          >
            {s.rays.map((r, k) => (
              <i
                key={k}
                style={{ "--a": `${r.a}deg`, "--r": r.r } as CSSProperties}
              />
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}
