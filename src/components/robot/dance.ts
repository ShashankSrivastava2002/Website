import type { Joint } from "./poses";

/**
 * The like reaction, traced frame-by-frame from the reference recording
 * (`ref_images/like_dancw.mov`, 60fps).
 *
 * What the reference actually does — and this is the part that matters — is NOT
 * one long canned routine. Each like fires the *next* move in a sequence, and
 * likes in quick succession escalate: the first click gets a kick, and someone
 * hammering the button ends up with the robot folded flat out on the floor.
 * Leave it alone for a couple of seconds and it resets to the top.
 *
 * Timings below are the measured ones. The opening kick, for instance:
 *   2.60s idle -> 2.75 arms rise -> 2.90 right arm overhead -> 3.00 kick
 *   launches -> 3.10 apex, leg horizontal, torso counter-leaning back ->
 *   3.25 held -> 3.65 leg down -> 3.85 recovered, arms out.
 * That is 1.25s door to door, which is what `kick` reproduces.
 */

export type DanceJoints = {
  torso?: Joint;
  head?: Joint;
  shoulderL?: Joint;
  shoulderR?: Joint;
  elbowL?: Joint;
  elbowR?: Joint;
  hipL?: Joint;
  hipR?: Joint;
  kneeL?: Joint;
  kneeR?: Joint;
};

export type DanceKey = DanceJoints & {
  /** seconds from the start of this move */
  t: number;
  /** vertical offset of the whole body */
  lift?: number;
  /** whole-body pitch — what lets the figure fold flat rather than just bend */
  bodyPitch?: number;
  /** whole-body roll */
  bodyRoll?: number;
  /** whole-body yaw */
  bodyYaw?: number;
};

export type Move = { name: string; dur: number; keys: DanceKey[] };

/* Rotating a limb that points down by +x swings its foot BACKWARD, so a
   forward kick is negative. Same convention as the walk cycle. */

/** 1 — the signature move. Arm overhead, then a high forward kick. */
const kick: Move = {
  name: "kick",
  dur: 1.3,
  keys: [
    { t: 0.0, lift: 0 },
    // anticipation: both arms come up, body sinks a touch before it goes
    {
      t: 0.15,
      shoulderL: { z: -0.55 }, shoulderR: { z: 0.55 },
      elbowL: { x: 1.0 }, elbowR: { x: 1.0 },
      lift: -0.03, kneeL: { x: 0.22 }, kneeR: { x: 0.22 }, bodyYaw: -0.06,
    },
    // right arm swings overhead, chest twists open
    {
      t: 0.3,
      torso: { y: 0.2, x: -0.08 }, head: { y: -0.12, z: 0.1 },
      shoulderR: { z: 2.58 }, elbowR: { x: 0.78 },
      shoulderL: { z: -0.75 }, elbowL: { x: 1.3 },
      lift: 0.02, bodyYaw: -0.24,
    },
    // launch
    {
      t: 0.42,
      torso: { y: 0.26, x: -0.18 }, head: { y: -0.15, x: 0.1 },
      shoulderR: { z: 2.52 }, elbowR: { x: 0.8 },
      shoulderL: { z: -0.85 }, elbowL: { x: 1.45 },
      hipL: { x: -0.9 }, kneeL: { x: 0.5 },
      hipR: { x: 0.08 }, kneeR: { x: 0.06 },
      lift: 0.04, bodyYaw: -0.48,
    },
    // APEX — leg horizontal, torso counter-leaning back
    {
      t: 0.55,
      torso: { y: 0.3, x: -0.32 }, head: { y: -0.18, x: 0.16 },
      shoulderR: { z: 2.42 }, elbowR: { x: 0.86 },
      shoulderL: { z: -0.9 }, elbowL: { x: 1.5 },
      hipL: { x: -1.55 }, kneeL: { x: 0.12 },
      hipR: { x: 0.12 }, kneeR: { x: 0.05 },
      lift: 0.06, bodyYaw: -0.58,
    },
    // held
    {
      t: 0.8,
      torso: { y: 0.28, x: -0.3 }, head: { y: -0.16, x: 0.14 },
      shoulderR: { z: 2.46 }, elbowR: { x: 0.84 },
      shoulderL: { z: -0.88 }, elbowL: { x: 1.48 },
      hipL: { x: -1.45 }, kneeL: { x: 0.18 },
      hipR: { x: 0.1 }, kneeR: { x: 0.05 },
      lift: 0.05, bodyYaw: -0.56,
    },
    // leg folds back down
    {
      t: 1.05,
      torso: { y: 0.14, x: -0.12 }, head: { y: -0.06 },
      shoulderR: { z: 1.1 }, elbowR: { x: 0.9 },
      shoulderL: { z: -0.7 }, elbowL: { x: 0.9 },
      hipL: { x: -0.55 }, kneeL: { x: 0.75 },
      lift: 0.0, bodyYaw: -0.3,
    },
    // recovered, arms open
    {
      t: 1.3,
      shoulderL: { z: -0.62 }, shoulderR: { z: 0.62 },
      elbowL: { x: 0.4 }, elbowR: { x: 0.4 },
      kneeL: { x: 0.12 }, kneeR: { x: 0.12 },
      lift: 0,
    },
  ],
};

/** 2 — two quick bounces with the hands together at the chest. */
const bounce: Move = {
  name: "bounce",
  dur: 0.95,
  keys: [
    { t: 0.0 },
    {
      t: 0.16,
      shoulderL: { z: -0.42, x: 0.35 }, shoulderR: { z: 0.42, x: 0.35 },
      elbowL: { x: 1.25 }, elbowR: { x: 1.25 },
      kneeL: { x: 0.55 }, kneeR: { x: 0.55 },
      hipL: { x: 0.2 }, hipR: { x: 0.2 },
      torso: { x: 0.12 }, head: { x: 0.1 },
      lift: -0.14,
    },
    {
      t: 0.34,
      shoulderL: { z: -0.5, x: 0.2 }, shoulderR: { z: 0.5, x: 0.2 },
      elbowL: { x: 0.9 }, elbowR: { x: 0.9 },
      kneeL: { x: 0.08 }, kneeR: { x: 0.08 },
      torso: { x: -0.05 }, head: { x: -0.05 },
      lift: 0.07,
    },
    {
      t: 0.52,
      shoulderL: { z: -0.42, x: 0.35 }, shoulderR: { z: 0.42, x: 0.35 },
      elbowL: { x: 1.25 }, elbowR: { x: 1.25 },
      kneeL: { x: 0.55 }, kneeR: { x: 0.55 },
      hipL: { x: 0.2 }, hipR: { x: 0.2 },
      torso: { x: 0.12 }, head: { x: 0.1 },
      lift: -0.14,
    },
    {
      t: 0.7,
      shoulderL: { z: -0.5, x: 0.2 }, shoulderR: { z: 0.5, x: 0.2 },
      elbowL: { x: 0.9 }, elbowR: { x: 0.9 },
      kneeL: { x: 0.08 }, kneeR: { x: 0.08 },
      lift: 0.06,
    },
    { t: 0.95, shoulderL: { z: -0.5 }, shoulderR: { z: 0.5 }, elbowL: { x: 0.4 }, elbowR: { x: 0.4 } },
  ],
};

/** 3 — both arms punched overhead, chest open, leaning back. */
const reach: Move = {
  name: "reach",
  dur: 1.05,
  keys: [
    { t: 0.0 },
    {
      t: 0.14,
      kneeL: { x: 0.45 }, kneeR: { x: 0.45 }, lift: -0.12,
      shoulderL: { z: -0.3 }, shoulderR: { z: 0.3 },
      elbowL: { x: 1.1 }, elbowR: { x: 1.1 },
      torso: { x: 0.14 },
    },
    {
      t: 0.34,
      shoulderL: { z: -2.55, x: -0.1 }, shoulderR: { z: 2.55, x: -0.1 },
      elbowL: { x: 0.3 }, elbowR: { x: 0.3 },
      torso: { x: -0.26 }, head: { x: -0.2 },
      kneeL: { x: 0.05 }, kneeR: { x: 0.05 },
      lift: 0.11,
    },
    {
      t: 0.62,
      shoulderL: { z: -2.45, x: 0.06 }, shoulderR: { z: 2.45, x: -0.06 },
      elbowL: { x: 0.36 }, elbowR: { x: 0.36 },
      torso: { x: -0.22, y: 0.12 }, head: { x: -0.16, y: 0.1 },
      lift: 0.09,
    },
    {
      t: 0.85,
      shoulderL: { z: -1.2 }, shoulderR: { z: 1.2 },
      elbowL: { x: 0.6 }, elbowR: { x: 0.6 },
      torso: { x: -0.05 }, lift: 0.0,
    },
    { t: 1.05, shoulderL: { z: -0.55 }, shoulderR: { z: 0.55 }, elbowL: { x: 0.4 }, elbowR: { x: 0.4 } },
  ],
};

/** 4 — wide squat with a hard twist through the waist. */
const twist: Move = {
  name: "twist",
  dur: 1.15,
  keys: [
    { t: 0.0 },
    {
      t: 0.2,
      hipL: { z: -0.42 }, hipR: { z: 0.42 },
      kneeL: { x: 0.78 }, kneeR: { x: 0.78 },
      shoulderL: { z: -0.95 }, shoulderR: { z: 0.95 },
      elbowL: { x: 0.85 }, elbowR: { x: 0.85 },
      torso: { x: 0.14 }, lift: -0.24, bodyYaw: -0.3,
    },
    {
      t: 0.48,
      hipL: { z: -0.4 }, hipR: { z: 0.4 },
      kneeL: { x: 0.7 }, kneeR: { x: 0.7 },
      shoulderL: { z: -1.15, x: 0.4 }, shoulderR: { z: 0.7, x: -0.4 },
      elbowL: { x: 0.7 }, elbowR: { x: 1.0 },
      torso: { y: 0.46, x: 0.1 }, head: { y: 0.3 },
      lift: -0.2, bodyYaw: 0.42,
    },
    {
      t: 0.78,
      hipL: { z: -0.36 }, hipR: { z: 0.36 },
      kneeL: { x: 0.6 }, kneeR: { x: 0.6 },
      shoulderL: { z: -0.7, x: -0.4 }, shoulderR: { z: 1.15, x: 0.4 },
      elbowL: { x: 1.0 }, elbowR: { x: 0.7 },
      torso: { y: -0.46, x: 0.1 }, head: { y: -0.3 },
      lift: -0.2, bodyYaw: -0.42,
    },
    {
      t: 1.0,
      kneeL: { x: 0.28 }, kneeR: { x: 0.28 },
      shoulderL: { z: -0.7 }, shoulderR: { z: 0.7 },
      lift: -0.06, bodyYaw: 0,
    },
    { t: 1.15 },
  ],
};

/**
 * 5 — the big one. Folds forward until the body is flat out horizontal, holds,
 * then rises into an arms-wide landing. Measured at 9.6s–11.2s in the
 * reference: fold 9.6–10.0, flat 10.0–10.5, rise 10.5–11.0, land 11.0–11.2.
 */
const dive: Move = {
  name: "dive",
  dur: 1.85,
  keys: [
    { t: 0.0 },
    // gather
    {
      t: 0.16,
      kneeL: { x: 0.72 }, kneeR: { x: 0.72 },
      hipL: { x: 0.3 }, hipR: { x: 0.3 },
      shoulderL: { z: -0.35, x: -0.5 }, shoulderR: { z: 0.35, x: -0.5 },
      elbowL: { x: 1.1 }, elbowR: { x: 1.1 },
      torso: { x: 0.3 }, head: { x: 0.25 },
      lift: -0.26, bodyYaw: -0.3,
    },
    // fold over
    {
      t: 0.42,
      bodyPitch: 0.95,
      kneeL: { x: 0.5 }, kneeR: { x: 0.5 },
      hipL: { x: 0.16 }, hipR: { x: 0.16 },
      shoulderL: { z: -0.5, x: 0.7 }, shoulderR: { z: 0.5, x: 0.7 },
      elbowL: { x: 0.5 }, elbowR: { x: 0.5 },
      torso: { x: 0.2 }, head: { x: -0.35 },
      lift: -0.05, bodyYaw: -0.72,
    },
    // FLAT — body parallel to the floor, arms reaching ahead
    {
      t: 0.62,
      bodyPitch: 1.5,
      kneeL: { x: 0.1 }, kneeR: { x: 0.1 },
      hipL: { x: 0.44, z: -0.16 }, hipR: { x: 0.5, z: 0.16 },
      shoulderL: { z: -0.34, x: 1.0 }, shoulderR: { z: 0.34, x: 1.0 },
      elbowL: { x: 0.24 }, elbowR: { x: 0.24 },
      torso: { x: 0.1 }, head: { x: -0.5 },
      lift: 0.16, bodyYaw: -1.12,
    },
    // held flat, drifting round
    {
      t: 0.95,
      bodyPitch: 1.44, bodyRoll: 0.16, bodyYaw: -1.34,
      kneeL: { x: 0.3 }, kneeR: { x: 0.12 },
      hipL: { x: 0.52, z: -0.2 }, hipR: { x: 0.38, z: 0.2 },
      shoulderL: { z: -0.4, x: 0.9 }, shoulderR: { z: 0.3, x: 1.05 },
      elbowL: { x: 0.32 }, elbowR: { x: 0.2 },
      head: { x: -0.45, y: 0.2 },
      lift: 0.14,
    },
    // rise
    {
      t: 1.28,
      bodyPitch: 0.68, bodyRoll: 0.06, bodyYaw: -0.78,
      kneeL: { x: 0.6 }, kneeR: { x: 0.6 },
      hipL: { x: 0.1 }, hipR: { x: 0.1 },
      shoulderL: { z: -0.7, x: 0.3 }, shoulderR: { z: 0.7, x: 0.3 },
      elbowL: { x: 0.6 }, elbowR: { x: 0.6 },
      torso: { x: 0.16 }, head: { x: 0.1 },
      lift: -0.08,
    },
    // landing, arms wide
    {
      t: 1.52,
      bodyPitch: 0.06,
      kneeL: { x: 0.34 }, kneeR: { x: 0.34 },
      hipL: { z: -0.3 }, hipR: { z: 0.3 },
      shoulderL: { z: -1.08, x: 0.1 }, shoulderR: { z: 1.08, x: 0.1 },
      elbowL: { x: 0.32 }, elbowR: { x: 0.32 },
      torso: { x: -0.06 }, head: { x: -0.08 },
      lift: -0.06, bodyYaw: -0.24,
    },
    { t: 1.85, shoulderL: { z: -0.6 }, shoulderR: { z: 0.6 }, elbowL: { x: 0.4 }, elbowR: { x: 0.4 } },
  ],
};

/**
 * Likes walk down this list. The last entry repeats, so leaning on the button
 * keeps the big move coming rather than running out of dance.
 */
export const MOVES: Move[] = [kick, bounce, reach, twist, dive];

/** How long after a like before the sequence resets to the first move. */
export const DANCE_RESET = 2.6;

const JOINTS = [
  "torso", "head", "shoulderL", "shoulderR",
  "elbowL", "elbowR", "hipL", "hipR", "kneeL", "kneeR",
] as const;

export type DanceSample = {
  joints: Record<(typeof JOINTS)[number], { x: number; y: number; z: number }>;
  lift: number;
  bodyPitch: number;
  bodyRoll: number;
  bodyYaw: number;
};

/**
 * Cubic interpolation across the whole key list, ported from three.js's
 * `CubicInterpolant` (src/math/interpolants/CubicInterpolant.js) — the
 * interpolant an `AnimationMixer` uses for `InterpolateSmooth` tracks.
 *
 * This replaces a per-segment smoothstep. Smoothstep has zero derivative at
 * BOTH ends of every segment, so the dance came to a complete stop at every
 * single keyframe and re-accelerated from rest — five moves' worth of traced
 * timing, delivered as a series of twitches. A Hermite spline whose tangent at
 * each key is the slope between its neighbours flows through the interior keys
 * at speed and only stops where the motion actually stops.
 *
 * `ZeroSlopeEnding` at both ends, because a move genuinely does start and end
 * at rest — that is the one place the old behaviour was right, and it is kept.
 */
function cubicWeights(keys: DanceKey[], i1: number, t: number) {
  const t0 = keys[i1 - 1].t;
  const t1 = keys[i1].t;

  let iPrev = i1 - 2;
  let iNext = i1 + 1;
  let tPrev = keys[iPrev]?.t;
  let tNext = keys[iNext]?.t;

  // Mirror the segment past each end so the first and last keys have zero
  // slope. Note the index is the segment's OTHER key, not a clamp — that is
  // what makes the derivative vanish rather than merely flatten.
  if (tPrev === undefined) {
    iPrev = i1;
    tPrev = 2 * t0 - t1;
  }
  if (tNext === undefined) {
    iNext = i1 - 1;
    tNext = 2 * t1 - t0;
  }

  const halfDt = (t1 - t0) * 0.5;
  const wP = halfDt / (t0 - tPrev);
  const wN = halfDt / (tNext - t1);

  const p = (t - t0) / (t1 - t0);
  const pp = p * p;
  const ppp = pp * p;

  return {
    iPrev,
    iNext,
    sP: -wP * ppp + 2 * wP * pp - wP * p,
    s0: (1 + wP) * ppp + (-1.5 - 2 * wP) * pp + (-0.5 + wP) * p + 1,
    s1: (-1 - wN) * ppp + (1.5 + wN) * pp + 0.5 * p,
    sN: wN * ppp - wN * pp,
  };
}

function blank(): DanceSample {
  const joints = {} as DanceSample["joints"];
  for (const j of JOINTS) joints[j] = { x: 0, y: 0, z: 0 };
  return { joints, lift: 0, bodyPitch: 0, bodyRoll: 0, bodyYaw: 0 };
}

/**
 * Sample a move at time `t`.
 *
 * Every channel is resolved independently and a key that omits a joint means
 * "return it to neutral", not "hold whatever it had" — otherwise a limb parked
 * by one keyframe stays parked for the rest of the move and the dance slowly
 * seizes up.
 */
export function sampleMove(move: Move, t: number): DanceSample {
  const keys = move.keys;
  const out = blank();
  if (keys.length === 0) return out;
  if (keys.length === 1) {
    for (const j of JOINTS) {
      const k = (keys[0][j] ?? {}) as Joint;
      out.joints[j] = { x: k.x ?? 0, y: k.y ?? 0, z: k.z ?? 0 };
    }
    out.lift = keys[0].lift ?? 0;
    out.bodyPitch = keys[0].bodyPitch ?? 0;
    out.bodyRoll = keys[0].bodyRoll ?? 0;
    out.bodyYaw = keys[0].bodyYaw ?? 0;
    return out;
  }

  const tc = Math.min(Math.max(t, keys[0].t), keys[keys.length - 1].t);
  let i1 = 1;
  while (i1 < keys.length - 1 && keys[i1].t <= tc) i1++;

  const { iPrev, iNext, sP, s0, s1, sN } = cubicWeights(keys, i1, tc);

  /** One scalar channel, blended across the four samples the spline touches. */
  const chan = (pick: (k: DanceKey) => number) =>
    sP * pick(keys[iPrev]) +
    s0 * pick(keys[i1 - 1]) +
    s1 * pick(keys[i1]) +
    sN * pick(keys[iNext]);

  for (const j of JOINTS) {
    out.joints[j] = {
      x: chan((k) => ((k[j] ?? {}) as Joint).x ?? 0),
      y: chan((k) => ((k[j] ?? {}) as Joint).y ?? 0),
      z: chan((k) => ((k[j] ?? {}) as Joint).z ?? 0),
    };
  }
  out.lift = chan((k) => k.lift ?? 0);
  out.bodyPitch = chan((k) => k.bodyPitch ?? 0);
  out.bodyRoll = chan((k) => k.bodyRoll ?? 0);
  out.bodyYaw = chan((k) => k.bodyYaw ?? 0);
  return out;
}
