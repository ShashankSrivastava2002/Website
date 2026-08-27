"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type Pointer = {
  /** eased value the rig should read */
  x: number;
  y: number;
  /** raw latest cursor position */
  tx: number;
  ty: number;
};

/**
 * Normalised (-1..1) cursor position, tracked on `window`.
 *
 * R3F's own `state.pointer` only updates from events that reach the canvas —
 * and the robot canvas sits under a `pointer-events: none` layer, so it never
 * receives any. Listening globally is what actually makes the robot track the
 * cursor across the whole page.
 *
 * Mouse events arrive in coarse bursts, so the raw position is a staircase.
 * `easePointer` smooths it toward the latest sample; it's called from the
 * render loop rather than its own rAF so there is a single clock and the
 * easing stays frame-rate independent.
 */
export function usePointer() {
  const p = useRef<Pointer>({ x: 0, y: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      p.current.tx = (e.clientX / window.innerWidth) * 2 - 1;
      p.current.ty = -((e.clientY / window.innerHeight) * 2 - 1);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return p;
}

/** Advance the eased pointer by `dt` seconds. */
export function easePointer(p: Pointer, dt: number, lambda = 26) {
  p.x = THREE.MathUtils.damp(p.x, p.tx, lambda, dt);
  p.y = THREE.MathUtils.damp(p.y, p.ty, lambda, dt);
}
