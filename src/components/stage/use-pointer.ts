"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type Pointer = {
  /** eased cursor, for the neck and head */
  x: number;
  y: number;
  /** the same cursor eased slower, for the spine to trail on */
  bx: number;
  by: number;
  /** raw latest position */
  tx: number;
  ty: number;
};

/**
 * Normalised (-1..1) cursor position, tracked on `window`.
 *
 * R3F's own `state.pointer` only updates from events that reach the canvas, and
 * the stage sits under a `pointer-events: none` layer so it never receives any.
 * Listening globally is what actually makes the figure track the cursor across
 * the whole page.
 */
export function usePointer() {
  const p = useRef<Pointer>({ x: 0, y: 0, bx: 0, by: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      p.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      p.current.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return p;
}

/**
 * Advance the eased pointer by `dt` seconds.
 *
 * Two channels, both chasing the RAW cursor at different rates. Chaining the
 * body onto the already-eased head value instead gives a second-order lag, and
 * at these rates that is not weight, it is mush — the torso keeps drifting for
 * most of a second after the cursor has stopped and the figure feels like it is
 * responding to something that already happened. One time constant each, a
 * factor of two apart, buys the offset without the sludge.
 *
 * Mouse events arrive in coarse bursts, so the raw position is a staircase; the
 * easing is what turns it back into motion. Too fast (26 was tried) and the
 * figure reproduces the staircase instead of smoothing it.
 */
export function easePointer(p: Pointer, dt: number, head = 14, body = 8) {
  p.x = THREE.MathUtils.damp(p.x, p.tx, head, dt);
  p.y = THREE.MathUtils.damp(p.y, p.ty, head, dt);
  p.bx = THREE.MathUtils.damp(p.bx, p.tx, body, dt);
  p.by = THREE.MathUtils.damp(p.by, p.ty, body, dt);
}
