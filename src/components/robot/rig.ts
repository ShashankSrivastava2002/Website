import * as THREE from "three";
import type { Joint } from "./poses";
import type { JointSpring } from "./spring";

/* ------------------------------------------------------------------ */
/* Shared joint driver.                                                */
/*                                                                     */
/* Lives here rather than in model.tsx because the human rig needs the */
/* identical blend. It used to have none of this — no pose targets, no */
/* springs, three lines of THREE.MathUtils.damp — so the About morph   */
/* swapped a posed, breathing figure for a mannequin standing to       */
/* attention, and the swap read as a pose change as much as an         */
/* identity change.                                                    */
/* ------------------------------------------------------------------ */

/**
 * Springs a joint toward its pose target, then adds the live offset on top.
 *
 * The pose and the offset need opposite response times. A pose change is a
 * deliberate half-second movement; an offset (cursor tracking, walk swing, the
 * wave) is already smooth and only needs passing straight through. This used to
 * damp their SUM with a single lambda, so whichever job won, the other broke —
 * the head and torso ran at lambda 30+ for the offset's sake, which collapsed
 * every pose change into 83ms. At 12fps that is one frame: the "pop".
 *
 * Keeping them separate also means an offset can no longer be attenuated by the
 * pose filter (the walk swing was losing 15% of its amplitude that way).
 */
export function driveJoint(
  obj: THREE.Object3D | null,
  target: Joint | undefined,
  pose: JointSpring,
  dt: number,
  extra?: { x?: number; y?: number; z?: number },
  /**
   * Dance override. The timeline is authored at specific times — a kick that
   * launches in 120ms — so it is written STRAIGHT to the rotation rather than
   * through the pose spring, which has a t90 of ~0.45s and would flatten every
   * accent into mush. `w` crossfades between the two so entering and leaving a
   * move is still smooth. The springs keep running underneath the whole time,
   * so whatever pose was active is already settled when the dance hands back.
   */
  dance?: { j: { x: number; y: number; z: number }; w: number },
  /**
   * A genuinely ADDITIVE layer, in the sense of
   * `webgl_animation_skinning_additive_blending`: a delta applied on top of
   * whatever base action is playing, at its own weight, rather than something
   * the base can switch off.
   *
   * `extra` above is a base-layer channel — it is the walk swing, and the
   * dance is entitled to replace it, so it is scaled by `k`. Cursor tracking,
   * breathing and the idle micro-motion are not: they belong to the figure,
   * not to the pose. Multiplying them by `k` was what made the robot go
   * completely dead-eyed the instant a like landed — it stopped looking at
   * you and stopped breathing for the length of the move.
   */
  add?: { x?: number; y?: number; z?: number }
) {
  if (!obj || !target) return;
  const px = pose.x.step(target.x ?? 0, dt);
  const py = pose.y.step(target.y ?? 0, dt);
  const pz = pose.z.step(target.z ?? 0, dt);
  const w = dance?.w ?? 0;
  const k = 1 - w;
  obj.rotation.x = px * k + (dance ? dance.j.x * w : 0) + (extra?.x ?? 0) * k + (add?.x ?? 0);
  obj.rotation.y = py * k + (dance ? dance.j.y * w : 0) + (extra?.y ?? 0) * k + (add?.y ?? 0);
  obj.rotation.z = pz * k + (dance ? dance.j.z * w : 0) + (extra?.z ?? 0) * k + (add?.z ?? 0);
}

/**
 * Rectifier with a rounded corner. `Math.max(0, v)` has a velocity
 * discontinuity at zero, which the old pose filter used to hide; passed
 * straight through it shows up as a hitch in the knee at each stride.
 *
 * The walk no longer needs it — `locomotion.ts` builds the knee schedule so
 * that it reaches zero at both seams instead of being clipped there — but the
 * shape is still useful anywhere a one-sided offset is wanted.
 */
export function softRect(v: number) {
  const k = 0.18;
  return 0.5 * (v + Math.sqrt(v * v + k * k)) - k / 2;
}
