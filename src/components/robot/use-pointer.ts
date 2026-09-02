"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export type Pointer = {
  /** eased value the head and neck read */
  x: number;
  y: number;
  /** the same cursor, eased slower, for the spine to trail on */
  bx: number;
  by: number;
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
 * TWO channels, not one, and the second is the point. `x`/`y` chase the cursor
 * and drive the neck and head; `bx`/`by` chase it more slowly and drive the
 * spine, so the head arrives first and the torso settles in behind it.
 *
 * BOTH chase the raw cursor. Chaining the body onto the already-eased head
 * value instead gives a second-order lag, and at these rates that is not
 * "weighty", it is mush: the torso keeps drifting for the better part of a
 * second after the cursor has stopped, and the whole figure feels like it is
 * responding to something that happened a moment ago. One time constant each,
 * a factor of two apart, gives the offset without the sludge.
 *
 * `head` was 26, fast enough to reproduce the raw event staircase rather than
 * smooth it — the figure twitched on every mouse sample instead of flowing
 * between them. 14 still tracks a fast flick without reproducing the steps.
 */
export function easePointer(p: Pointer, dt: number, head = 14, body = 8) {
  p.x = THREE.MathUtils.damp(p.x, p.tx, head, dt);
  p.y = THREE.MathUtils.damp(p.y, p.ty, head, dt);
  p.bx = THREE.MathUtils.damp(p.bx, p.tx, body, dt);
  p.by = THREE.MathUtils.damp(p.by, p.ty, body, dt);
}
