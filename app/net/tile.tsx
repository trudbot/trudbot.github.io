import { memo, useRef } from "react";
import { D, DIRS, L, popcount, R, rotateCWBy, SHORT_CIRCUIT, U, UNPOWERED } from "./engine";

/** Source colours, indexed by source. Drawn from the site palette (app/colors). */
export const SOURCE_COLORS = ["#5CE0D8", "#FF8FAB", "#FFD166"];
const SHORT_COLOR = "#FF5A5F";

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

export interface TileProps {
  index: number;
  /** Tile value at the start of the level; the shape that gets rotated. */
  base: number;
  /** Clockwise quarter turns applied so far. Kept unwrapped so the animation always turns forward. */
  turns: number;
  /** Source colour, UNPOWERED or SHORT_CIRCUIT. */
  owner: number;
  /** Edges of the current orientation that lie on a loop. */
  loopArms: number;
  barriers: number;
  /** Colour of the source on this tile, or -1. */
  source: number;
  locked: boolean;
  label: string;
  onPress: (index: number, lock: boolean) => void;
}

function wireColor(owner: number): string | undefined {
  if (owner === SHORT_CIRCUIT) return SHORT_COLOR;
  if (owner === UNPOWERED) return undefined;
  return SOURCE_COLORS[owner];
}

const LONG_PRESS_MS = 450;

export const Tile = memo(function Tile(props: TileProps) {
  const { index, base, turns, owner, loopArms, barriers, source, locked, label, onPress } = props;
  const color = wireColor(owner);
  const isEnd = popcount(base) === 1 && source < 0;

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

  return (
    <button
      type="button"
      className="net-tile"
      data-locked={locked || undefined}
      data-short={owner === SHORT_CIRCUIT || undefined}
      aria-label={label}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        longPressed.current = false;
        pressing.current = true;
        timer.current = setTimeout(() => {
          pressing.current = false;
          longPressed.current = true;
          onPress(index, true);
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
        onPress(index, true);
      }}
      onClick={() => {
        if (longPressed.current) longPressed.current = false;
        else onPress(index, false);
      }}
      onKeyDown={(e) => {
        if (e.key === "l" || e.key === "L") onPress(index, true);
      }}
    >
      <svg
        className="net-wires"
        viewBox="0 0 100 100"
        style={{ transform: `rotate(${turns * 90}deg)`, color }}
        aria-hidden="true"
      >
        {DIRS.filter((d) => base & d).map((d) => {
          const loop = loopArms & rotateCWBy(d, turns);
          const [x, y] = ARM_END[d];
          return (
            <line
              key={d}
              x1={50}
              y1={50}
              x2={x}
              y2={y}
              className="net-arm"
              data-loop={loop ? true : undefined}
            />
          );
        })}
        {source >= 0 && (
          <rect
            x={27}
            y={27}
            width={46}
            height={46}
            rx={10}
            className="net-source"
            style={{ fill: SOURCE_COLORS[source] }}
          />
        )}
        {isEnd && <circle cx={50} cy={50} r={15} className="net-end" />}
      </svg>
      {barriers > 0 && (
        <svg className="net-barriers" viewBox="0 0 100 100" aria-hidden="true">
          {DIRS.filter((d) => barriers & d).map((d) => {
            const [x1, y1, x2, y2] = EDGE[d];
            return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </svg>
      )}
    </button>
  );
});
