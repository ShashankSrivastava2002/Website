import type { ClipName } from "./character";

/**
 * What the figure is doing, in the page's vocabulary rather than the rig's.
 *
 * The sections drive poses; poses map to clips. Keeping the two apart is what
 * lets the bake change which clip backs a gesture without any section knowing.
 */
export type Pose = "boot" | "idle" | "walk" | "wave" | "think" | "work" | "bow";

export const POSE_CLIPS: Record<Pose, { base: ClipName; add?: ClipName }> = {
  boot: { base: "idle" },
  idle: { base: "idle" },
  walk: { base: "walk" },
  wave: { base: "idle", add: "agree" },
  think: { base: "idle", add: "headshake" },
  // Nothing in either file reads as "working", and a wrong gesture is worse
  // than none: plain idle.
  work: { base: "idle" },
  bow: { base: "idle", add: "agree" },
};

/** Home cycles through these on a timer so the figure is never static. */
export const HOME_CYCLE: { pose: Pose; hold: number }[] = [
  { pose: "idle", hold: 6 },
  { pose: "wave", hold: 3.5 },
  { pose: "idle", hold: 7 },
  { pose: "think", hold: 4 },
];

export const MORPH_DURATION = 1.5;
