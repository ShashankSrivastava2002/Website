/**
 * The walk cycle.
 *
 * Driven by curves measured out of `three.js/examples/models/gltf/Xbot.glb`,
 * clip "walk" — the same Mixamo capture the skinning examples play through an
 * AnimationMixer. `walkdata.ts` holds the baked tables; this file fits them to
 * a specific pair of legs.
 *
 * The previous version approximated those curves with hand-written sines. The
 * measurements say four of them were wrong in ways that read as "robot" even
 * on the human figure:
 *
 *  - Duty factor was 0.6. The reference is 0.500 on both legs. 0.6 is an amble;
 *    this walk is brisk, and stance being exactly half is what makes the two
 *    legs' phases mirror cleanly.
 *
 *  - The knee returned to 0 at heel strike and at toe-off. The reference knee
 *    never leaves [0.376, 1.208] — it does not straighten at ANY point in the
 *    cycle. A leg that locks at heel strike is the single clearest tell of
 *    procedural animation, and I had explicitly forced that by dropping a
 *    constant offset to fix a seam discontinuity. The seam was real; zero was
 *    the wrong place to fix it.
 *
 *  - Ankle pitch ran 0 -> +0.62, one-sided. The reference runs -0.30 -> +0.33
 *    about its rest: the foot dorsiflexes to clear the floor during swing, then
 *    plantarflexes to push off. Only having the push-off half meant the toe
 *    reached for the floor on every swing.
 *
 *  - Vertical bob was 9.9% of leg length; the reference is 4.87%. Twice the
 *    real value, which reads as a bounce rather than a walk.
 *
 * Retained from the previous version, because the measurements support it:
 * a phase that starts at a defined contact, a weight ramp with asymmetric in
 * and out durations, a ramp-out deferred to the next foot plant, and — the part
 * a baked clip cannot give you — a stance hip solved so the planted foot
 * travels backwards at exactly the speed the body travels forwards. A clip
 * authored for one skeleton skates on another; the solve is what makes these
 * curves safe to put on legs with different proportions.
 */

import {
  WALK_SAMPLES,
  REF_DUTY,
  REF_LEG_LENGTH,
  HIP,
  KNEE,
  ANKLE,
  ANKLE_AMP,
  TOE,
  SHOULDER,
  SHOULDER_AMP,
  ELBOW,
  ELBOW_AMP,
  ELBOW_HOLD,
  PELVIS_YAW,
  PELVIS_YAW_AMP,
  CHEST_YAW,
  CHEST_YAW_AMP,
  PELVIS_ROLL,
  PELVIS_ROLL_AMP,
  BOB,
  BOB_OVER_LEG,
} from "./walkdata";

/** Fraction of the cycle a foot spends on the ground. Measured, not chosen. */
const DUTY = REF_DUTY;

/** Cadence used when the figure is marching on the spot (steps/sec). */
const IDLE_CADENCE = 0.8;

/**
 * Speed below which the figure is treated as stationary and marches instead of
 * stepping off distance. Small on purpose: above it, cadence is speed / step
 * and the planted foot cannot slide at all.
 */
const CREEP = 0.06;

/**
 * Reference step length over reference leg length.
 *
 * The clip has no root motion, so the stride is the planted toe's own
 * excursion: 0.975 units against a 0.889 leg. Callers scale their own leg
 * length by this to get a stride in the reference's proportions.
 */
export const REF_STEP_OVER_LEG = 1.0968;

export type LegPose = {
  /** hip pitch; NEGATIVE swings the leg forward (toward +z), per `footZ` */
  hip: number;
  /** knee flexion; always > 0 — the reference knee never locks */
  knee: number;
  /** ankle pitch, chosen so the sole stays flat through stance */
  ankle: number;
  /** toe (metatarsal) flexion, for rigs that have the joint */
  toe: number;
};

const smooth = (v: number) => v * v * (3 - 2 * v);
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Read a baked cycle table at fractional phase `u` (wraps). */
function tap(table: readonly number[], u: number) {
  const x = (u - Math.floor(u)) * WALK_SAMPLES;
  const i = Math.floor(x) % WALK_SAMPLES;
  const j = (i + 1) % WALK_SAMPLES;
  const f = x - Math.floor(x);
  return table[i] * (1 - f) + table[j] * f;
}

/** Knee flexion at phase `u`, straight off the capture. */
export const kneeAt = (u: number) => tap(KNEE, u);
/** Ankle pitch about rest at phase `u`. */
export const ankleAt = (u: number) => tap(ANKLE, u) * ANKLE_AMP;
/** Toe flexion at phase `u`. */
export const toeAt = (u: number) => tap(TOE, u);

/**
 * Secondary channels — everything above the hips, plus the arms.
 *
 * These are stored unit-amplitude with their measured range alongside, so a
 * caller can dial one down without losing the shape. The amplitudes below are
 * the reference's own, in radians, and transfer directly: an angle is an angle
 * regardless of bone length. Only `bob` is a length, so only `bob` is scaled.
 */
export function secondary(phase: number) {
  return {
    /** contralateral arm swing; add to the leg's own hip sign */
    shoulder: tap(SHOULDER, phase) * SHOULDER_AMP,
    /**
     * Flexion MODULATION only, about a held bend. The capture's own hold is
     * `ELBOW_HOLD` (0.626 rad — the reference elbow is never straight); the
     * `walk` pose already carries 0.46 of its own, so callers whose rest pose
     * holds a bend add just this, and callers whose rest pose is straight add
     * `ELBOW_HOLD` as well. Adding both to a pose that already bends would
     * double it.
     */
    elbow: tap(ELBOW, phase) * ELBOW_AMP,
    pelvisYaw: tap(PELVIS_YAW, phase) * PELVIS_YAW_AMP,
    /** counter-rotates against the pelvis (measured correlation -0.64) */
    chestYaw: tap(CHEST_YAW, phase) * CHEST_YAW_AMP,
    /** pelvic list; one cycle per stride, unlike the bob's two */
    pelvisRoll: tap(PELVIS_ROLL, phase) * PELVIS_ROLL_AMP,
    /** unit-amplitude; multiply by leg length * BOB_OVER_LEG */
    bob: tap(BOB, phase),
  };
}

export { ELBOW_HOLD, BOB_OVER_LEG, REF_LEG_LENGTH };

/**
 * A gait sampler fitted to a specific pair of legs.
 *
 * `thigh` and `shin` are the rig's real bone lengths (hip pivot to knee pivot,
 * knee pivot to sole). They set the stride length, which is why this is built
 * per-rig rather than hard-coded: the robot and the human have different legs
 * and would skate against a shared constant. Pass `stepLength` as
 * `(thigh + shin) * REF_STEP_OVER_LEG` to walk in the reference's proportions.
 */
export function makeGait(thigh: number, shin: number, stepLength: number) {
  const L = thigh + shin;

  /** Forward kinematics: horizontal offset of the sole from the hip pivot. */
  const footZ = (hip: number, knee: number) =>
    -(thigh * Math.sin(hip) + shin * Math.sin(hip + knee));

  // How far the planted foot must travel backwards under the hip.
  //
  // NOT half a step, which is the intuitive answer and wrong by exactly the
  // duty factor. The body advances `2 * step` per stride; a foot is planted
  // for DUTY of that stride, so while it is down the hip passes over it by
  // `DUTY * 2 * step`.
  const wantHalf = DUTY * stepLength;

  // The largest half-excursion these legs can actually reach, measured rather
  // than guessed: the knee is bent throughout, so the effective leg is shorter
  // than `L` and by a different amount at every phase. Scan the stance for the
  // tightest limit and keep a margin, so the bisection below always has a
  // solution and the hip never has to hyperextend to find one.
  let reach = Infinity;
  for (let i = 0; i <= 32; i++) {
    const knee = kneeAt((i / 32) * DUTY);
    reach = Math.min(reach, Math.abs(footZ(0.7, knee)));
  }
  const half = Math.min(wantHalf, reach * 0.94);
  const step = half / DUTY;

  /**
   * Stance hip angles, solved so the sole travels backwards linearly.
   *
   * A closed form exists only if the knee is straight; it never is, so this
   * bisects once at module load and the frame loop just interpolates.
   *
   * 256 entries, not 64: at 64 the linear interpolation between samples left
   * 5.6% of per-frame positional jitter in the planted foot (the steady drift
   * was already 0.01%). Costs ~10k iterations per call — so call it ONCE, at
   * module scope. `useRef(new Gait(makeGait(...)))` does not: `useRef`
   * evaluates its argument on every render and discards all but the first, so
   * an inline profile pays the bisection on every render. Both rigs build
   * `GAIT_PROFILE` at module scope for exactly this reason.
   */
  const STEPS = 256;
  const stanceHip = new Float32Array(STEPS + 1);
  for (let i = 0; i <= STEPS; i++) {
    const s = i / STEPS;
    const want = half - 2 * half * s; // +half (forward) -> -half (behind)
    const knee = kneeAt(s * DUTY);
    // footZ is monotonically decreasing in hip over this range, so bisection
    // is safe and cannot land on the wrong branch.
    let lo = -1.2;
    let hi = 1.2;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (footZ(mid, knee) > want) lo = mid;
      else hi = mid;
    }
    stanceHip[i] = (lo + hi) / 2;
  }

  const hipAtStanceStart = stanceHip[0];
  const hipAtToeOff = stanceHip[STEPS];

  // The capture's own swing, normalised to 0..1 across the swing window. Using
  // the shape rather than a smoothstep keeps the late-swing plateau, where the
  // reference hip holds near its forward limit for the last ~12% of the cycle
  // while the knee extends to reach for the floor. A smoothstep arrives at the
  // same place with the hip still moving, which lands the foot heel-first into
  // a moving target and is where the last of the skate used to come from.
  const swing0 = tap(HIP, DUTY);
  const swing1 = tap(HIP, 1);
  const swingSpan = swing1 - swing0;

  function hipAt(u: number) {
    if (u < DUTY) {
      const x = (u / DUTY) * STEPS;
      const i = Math.min(STEPS - 1, Math.floor(x));
      const f = x - i;
      return stanceHip[i] * (1 - f) + stanceHip[i + 1] * f;
    }
    // Remap the captured swing onto this rig's solved endpoints, so the shape
    // is the reference's but the contact positions are ours.
    const s = (u - DUTY) / (1 - DUTY);
    const t =
      Math.abs(swingSpan) < 1e-6
        ? smooth(s)
        : (tap(HIP, DUTY + s * (1 - DUTY)) - swing0) / swingSpan;
    return hipAtToeOff + (hipAtStanceStart - hipAtToeOff) * t;
  }

  // Phase at which the rolling foot leaves flat contact and rises onto the toe,
  // and the phase by which a heel-first landing has flattened out.
  const TOE_OFF_ROLL = DUTY * 0.82;
  const HEEL_FLAT = 0.12;
  const PITCH_REF = ankleAt(TOE_OFF_ROLL);

  /**
   * Foot pitch relative to the floor, 0 = sole flat.
   *
   * Four segments that must agree at every seam, which the first table-driven
   * version did not: it forced 0 across all of early stance and picked the
   * capture back up at toe-off, leaving a 0.348 rad step at heel strike — the
   * foot snapped flat the instant it landed. The fix is to let the landing
   * dorsiflexion decay over `HEEL_FLAT` instead of clipping it, which makes
   * u = 0 agree with u = 1 by construction (both read `ankleAt(0) - PITCH_REF`)
   * and makes u = HEEL_FLAT and u = TOE_OFF_ROLL agree with the flat segment
   * at 0.
   */
  function pitchAt(u: number) {
    const raw = ankleAt(u) - PITCH_REF;
    if (u < HEEL_FLAT) return raw * (1 - smooth(u / HEEL_FLAT)); // land, flatten
    if (u < TOE_OFF_ROLL) return 0; // flat on the floor
    return raw; // roll onto the toe, then clear the floor through swing
  }

  /**
   * Foot pitch relative to the floor. 0 = sole flat.
   *
   * The ankle exists so this can be *specified* rather than inherited. Hip,
   * knee and ankle are all x rotations in one chain, so the foot's pitch is
   * exactly their sum — `ankle = target - (hip + knee)` is an identity, not an
   * approximation. Through the flat-foot part of stance the target is 0 and
   * the sole stays flat to within float error; elsewhere it follows the
   * capture.
   */
  function sampleLeg(u: number): LegPose {
    const hip = hipAt(u);
    const knee = kneeAt(u);
    return { hip, knee, ankle: pitchAt(u) - (hip + knee), toe: toeAt(u) };
  }

  return { sampleLeg, step, L, footZ, half };
}

/**
 * Vertical travel of the pelvis, 0..1.
 *
 * Two rises per stride. The capture agrees on the frequency but not the phase:
 * its troughs sit at 0.44 and 0.94, not 0.5 and 0.0, because the body is still
 * falling slightly as the next foot takes the load. `secondary().bob` carries
 * the measured curve; this is kept for callers that only want the frequency.
 */
export function pelvisRise(phase: number) {
  return (1 - Math.cos(4 * Math.PI * phase)) * 0.5;
}

/**
 * A walk cycle with its own clock, its own weight, and a synchronised exit.
 *
 * Modelled on `AnimationAction`: `request()` is `crossFadeTo`, and the
 * plant-synchronised ramp-out is `synchronizeCrossFade`.
 */
export class Gait {
  /** 0..1 through one full stride (two steps) */
  phase = 0;
  /** blend weight, 0..1 */
  weight = 0;

  private want = false;
  /** cancelled, but still running until the next foot plant */
  private draining = false;

  /** Asymmetric, as in the reference: quick to start, slower to settle. */
  private readonly fadeIn = 0.4;
  private readonly fadeOut = 0.7;

  constructor(private readonly profile: ReturnType<typeof makeGait>) {}

  request(on: boolean) {
    if (on === this.want) return;
    this.want = on;
    if (on) this.draining = false;
    // Leaving the walk does NOT start the fade — `update` waits for the next
    // foot plant, so the ramp-out begins with the legs under the body rather
    // than frozen at full stride extension.
    else if (this.weight > 0) this.draining = true;
  }

  get walking() {
    return this.want;
  }

  /**
   * @param dt    frame time
   * @param speed world units per second the rig is actually travelling
   */
  update(dt: number, speed: number) {
    if (this.want || this.draining) {
      // Distance-driven, so the feet cannot slide.
      //
      // This used to be `max(IDLE_CADENCE, speed / step)`, a floor — which is
      // exactly a licence to skate, because below the floor the legs cycle
      // faster than the body travels. It went unnoticed only because the old
      // stride was short enough that the floor never engaged at the speeds the
      // walk-in used; with the reference's longer stride it engages below
      // 0.66 u/s and put 65% skate into the end of every walk-in.
      //
      // Any real travel now drives cadence outright. The nominal cadence is
      // blended in only as the speed approaches zero, where there is genuinely
      // no distance to divide by and the figure is marching on the spot.
      const fromSpeed = Math.abs(speed) / this.profile.step;
      const march = Math.max(0, 1 - Math.abs(speed) / CREEP);
      const stepsPerSec = fromSpeed + (IDLE_CADENCE - fromSpeed) * march * march;
      const prev = this.phase;
      this.phase = (this.phase + (stepsPerSec * dt) / 2) % 1;
      if (this.draining && crossedPlant(prev, this.phase)) this.draining = false;
    }

    const target = this.want || this.draining ? 1 : 0;
    const rate = target > this.weight ? 1 / this.fadeIn : 1 / this.fadeOut;
    this.weight =
      target > this.weight
        ? Math.min(target, this.weight + rate * dt)
        : Math.max(target, this.weight - rate * dt);

    if (this.weight === 0) this.phase = 0; // next walk starts on a known foot
    return this.weight;
  }

  /** Both legs, offset half a cycle from each other. */
  legs() {
    return {
      left: this.profile.sampleLeg(this.phase),
      right: this.profile.sampleLeg((this.phase + 0.5) % 1),
    };
  }

  /** Torso, pelvis and arm channels for the current phase. */
  secondary() {
    return secondary(this.phase);
  }

  /**
   * Pelvis and chest yaw, signs resolved for this rig.
   *
   * Prefer this over scaling the yaw off `hipR - hipL`. That works, but the
   * coefficient has to be re-derived for every rig — the robot needs a 1.28 rad
   * hip swing where the human needs 0.95 for the same ground, so one constant
   * cannot serve both and a shared one silently over-rotates the shorter-thighed
   * figure. These are absolute angles from the capture and transfer as they are.
   *
   * The capture's yaw runs -0.615 against this rig's `hipR - hipL`, hence the
   * negation; `chestYaw` keeps its own measured phase rather than being a scaled
   * copy of the pelvis, which is the point — the two are only correlated -0.64,
   * so the chest is not simply the pelvis upside down.
   */
  torso() {
    const s = secondary(this.phase);
    return { pelvisYaw: -s.pelvisYaw, chestYaw: -s.chestYaw };
  }

  /**
   * Both arms, half a cycle apart.
   *
   * Signs are the capture's, which run OPPOSITE to this rig's solved hip: the
   * solve derives its hip from `footZ`, where a forward foot needs a negative
   * hip, while the capture measures a forward thigh as positive. Correlating
   * the two over a full cycle gives -0.89, so callers negate. Nothing here can
   * detect that automatically — it is a property of the rig the curves are
   * being put on, so it is resolved once, here, rather than at each call site.
   */
  arms() {
    const l = secondary(this.phase);
    const r = secondary((this.phase + 0.5) % 1);
    return {
      left: { shoulder: -l.shoulder, elbow: -l.elbow },
      right: { shoulder: -r.shoulder, elbow: -r.elbow },
    };
  }
}

/** Did the phase step across a foot plant (0 or 0.5) this frame? */
function crossedPlant(prev: number, now: number) {
  if (now < prev) return true; // wrapped through 0
  return prev < 0.5 && now >= 0.5;
}
