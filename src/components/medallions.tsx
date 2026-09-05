"use client";

import { useCallback, useRef } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

export type Medallion = {
  value: string;
  label: string;
  tint: string;
  x: number;
  y: number;
  spin: number;
};

/**
 * The About proof points as objects you can pick up.
 *
 * They were five flat text pills, which is the weakest thing on a page whose
 * whole subject is a physical figure. These are seals: a lit face, a dashed
 * inner ring, a resting tilt, and real weight in the shadow.
 *
 * The drag deliberately writes straight to the element's custom properties
 * instead of going through state — a pointermove that re-rendered the list
 * sixty times a second would fight the WebGL figure behind it for frames. The
 * offset lives in a ref so it survives a re-render of the parent (the identity
 * flip re-renders this column).
 */
export default function Medallions({ items }: { items: Medallion[] }) {
  const offsets = useRef<Record<number, { x: number; y: number }>>({});
  const drag = useRef<{ id: number; el: HTMLElement; sx: number; sy: number } | null>(null);

  const onDown = useCallback((e: ReactPointerEvent<HTMLDivElement>, i: number) => {
    const el = e.currentTarget;
    const at = offsets.current[i] ?? { x: 0, y: 0 };
    drag.current = { id: i, el, sx: e.clientX - at.x, sy: e.clientY - at.y };
    el.setPointerCapture(e.pointerId);
    el.dataset.held = "true";
  }, []);

  const onMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const x = e.clientX - d.sx;
    const y = e.clientY - d.sy;
    offsets.current[d.id] = { x, y };
    d.el.style.setProperty("--dx", `${x}px`);
    d.el.style.setProperty("--dy", `${y}px`);
  }, []);

  const onUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.el.releasePointerCapture(e.pointerId);
    delete d.el.dataset.held;
    drag.current = null;
  }, []);

  return (
    <div className="badges" aria-hidden>
      {items.map((m, i) => (
        <div
          key={m.label}
          className="medallion"
          style={
            {
              "--i": i,
              "--x": `${m.x}%`,
              "--y": `${m.y}%`,
              "--spin": `${m.spin}deg`,
              "--tint": m.tint,
            } as CSSProperties
          }
          onPointerDown={(e) => onDown(e, i)}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span className="medallion-value">{m.value}</span>
          <span className="medallion-label">{m.label}</span>
        </div>
      ))}
    </div>
  );
}
