/**
 * The robot's animation rig.
 *
 * Every pose is a set of target euler rotations per joint. `useFrame` damps the
 * live rotations toward whichever pose is active, so switching poses reads as a
 * movement rather than a cut — the same trick the mood system uses for the face.
 *
 * Axes, in the robot's local space:
 *   shoulder.z  — swings the arm away from the body (negative = raised on left)
 *   shoulder.x  — swings the arm forward/back
 *   elbow.x     — bends the forearm up
 *   head.x/.y/.z — nod / turn / tilt
 */

export type Pose = "boot" | "walk" | "idle" | "wave" | "think" | "work" | "bow";

/**
 * How long the About identity swap takes, in seconds, in either direction.
 *
 * Lives here rather than in the 3D bundle because the DOM side needs it too:
 * the stat scramble and the 3D dissolve both derive their timing from this
 * one number, so they cannot drift apart. This module is plain data with no
 * three.js import, so reading it from a DOM component costs nothing.
 */
export const MORPH_DURATION = 1.15;

export type Joint = {
  x?: number;
  y?: number;
  z?: number;
};

export type PoseSpec = {
  torso: Joint;
  head: Joint;
  shoulderL: Joint;
  shoulderR: Joint;
  elbowL: Joint;
  elbowR: Joint;
  hipL: Joint;
  hipR: Joint;
  kneeL: Joint;
  kneeR: Joint;
  /** vertical offset for the whole body */
  lift: number;
  /** how strongly the idle bob applies (0 = perfectly still) */
  bob: number;
  /** true while the arm should be waving; the wave itself is driven per-frame */
  waving?: boolean;
  /** true while the legs should run the walk cycle */
  walking?: boolean;
  /** shows the expanding scan rings above the head */
  scanning?: boolean;
};

const REST: PoseSpec = {
  torso: { x: 0, y: 0, z: 0 },
  head: { x: 0, y: 0, z: 0 },
  shoulderL: { x: 0.04, y: 0, z: -0.52 },
  shoulderR: { x: 0.04, y: 0, z: 0.52 },
  elbowL: { x: 0.3 },
  elbowR: { x: 0.3 },
  hipL: { x: 0, z: -0.14 },
  hipR: { x: 0, z: 0.14 },
  kneeL: { x: 0.06 },
  kneeR: { x: 0.06 },
  lift: 0,
  bob: 1,
};

export const POSES: Record<Pose, PoseSpec> = {
  /** Boot: arms hanging dead, head dipped — not yet awake. */
  boot: {
    ...REST,
    head: { x: 0.16 },
    shoulderL: { z: -0.07 },
    shoulderR: { z: 0.07 },
    elbowL: { x: 0.05 },
    elbowR: { x: 0.05 },
    lift: -0.04,
    bob: 0.35,
  },

  /**
   * Walking. The limb swing is generated per-frame from a sine phase rather
   * than stored here — this just sets the stance it swings around.
   */
  walk: {
    ...REST,
    torso: { x: 0.07 },
    head: { x: -0.04 },
    shoulderL: { z: -0.44 },
    shoulderR: { z: 0.44 },
    elbowL: { x: 0.46 },
    elbowR: { x: 0.46 },
    lift: 0,
    bob: 0,
    walking: true,
  },

  /** Neutral standing. */
  idle: REST,

  /** Right arm raised high, palm out — the wave loop swings it. */
  wave: {
    ...REST,
    torso: { y: -0.1 },
    head: { z: -0.08, x: -0.05 },
    shoulderR: { z: 2.6, x: 0.2 },
    elbowR: { x: 0.75 },
    shoulderL: { z: -0.2 },
    lift: 0.02,
    bob: 0.8,
    waving: true,
  },

  /** One hand up near the chin, head tilted — thinking. */
  think: {
    ...REST,
    torso: { y: 0.12 },
    head: { x: 0.14, z: 0.2, y: -0.1 },
    shoulderR: { z: 0.72, x: 0.62 },
    elbowR: { x: 1.85 },
    shoulderL: { z: -0.24, x: -0.1 },
    elbowL: { x: 0.5 },
    lift: 0,
    bob: 0.6,
  },

  /** Calm neutral for the Work page — arms relaxed, no gestures. */
  work: {
    ...REST,
    shoulderL: { z: -0.46 },
    shoulderR: { z: 0.46 },
    elbowL: { x: 0.26 },
    elbowR: { x: 0.26 },
    bob: 0.55,
  },

  /**
   * Contact. The reference has it standing open and attentive rather than
   * curled up — arms held slightly away from the body, head level, with the
   * scan rings pulsing overhead.
   */
  bow: {
    ...REST,
    torso: { x: 0.05 },
    head: { x: 0.05 },
    shoulderL: { z: -0.42, x: 0.16 },
    shoulderR: { z: 0.42, x: 0.16 },
    elbowL: { x: 0.42 },
    elbowR: { x: 0.42 },
    // wide, slightly crouched stance
    hipL: { x: -0.12, z: -0.2 },
    hipR: { x: -0.12, z: 0.2 },
    kneeL: { x: 0.3 },
    kneeR: { x: 0.3 },
    lift: -0.1,
    bob: 0.7,
    scanning: true,
  },
};

/** Home cycles through these, holding each for the given number of seconds. */
export const HOME_CYCLE: { pose: Pose; hold: number }[] = [
  { pose: "idle", hold: 4.5 },
  { pose: "wave", hold: 3.2 },
  { pose: "idle", hold: 3.5 },
  { pose: "think", hold: 4.5 },
];
