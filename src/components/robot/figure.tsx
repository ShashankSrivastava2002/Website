"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { bone, type Character, type ClipName } from "./characters";
import type { Pose } from "./poses";
import { easePointer, usePointer } from "./use-pointer";

/**
 * Plays a glTF character.
 *
 * Two layers, taken straight from the two skinning examples:
 *
 *  - a BASE layer holding one of idle / walk / run / dance, changed with
 *    `crossFadeTo` on a weight ramp (`webgl_animation_skinning_blending`);
 *  - an ADDITIVE layer holding a gesture, made additive with
 *    `AnimationUtils.makeClipAdditive` and faded in over whatever the base is
 *    doing (`webgl_animation_skinning_additive_blending`).
 *
 * The additive layer is the reason the gestures work at all. Four of the seven
 * poses this app asks for are gestures, and two of the source clips
 * (`sad_pose`, `sneak_pose`) are two keyframes long — switching the base layer
 * to one of those would freeze the figure mid-stride with no breathing and no
 * idle motion. As an additive delta over a running idle, the same two keyframes
 * become a posture the figure holds while still being alive.
 */

/* ------------------------------------------------------------------ */

/**
 * Pose -> (base clip, additive gesture).
 *
 * None of the three models contains a wave or a bow, so those map to the
 * nearest gesture that does exist rather than to nothing. `agree` is a nod and
 * `headShake` is its opposite; `sad_pose` drops the head and shoulders and
 * `sneak_pose` leans the figure forward over its own feet.
 */
const POSE_CLIPS: Record<Pose, { base: ClipName; add?: ClipName }> = {
  boot: { base: "idle" },
  idle: { base: "idle" },
  walk: { base: "walk" },
  wave: { base: "idle", add: "agree" },
  think: { base: "idle", add: "headShake" },
  // No gesture: none of the three models contains anything that reads as
  // "working", and the two short Xbot poses that might have are inert once
  // retargeted (see ADDITIVE in characters.ts). Plain idle beats a wrong one.
  work: { base: "idle" },
  bow: { base: "idle", add: "agree" },
};

/** Clips that move the feet, and so must hand their phase on when swapped. */
const LOCOMOTION = new Set<ClipName>(["walk", "run"]);

const BASE_FADE = 0.45;
const ADD_FADE = 0.35;

/** How long the dance takes to take the base layer over, and to hand it back. */
const DANCE_IN = 0.3;
const DANCE_OUT = 0.45;

/* ------------------------------------------------------------------ */

/**
 * How a cursor turn is shared out along the spine, hips to head.
 *
 * Tracking with the neck and head alone is what made the old version read as a
 * mannequin on a swivel. A person turning to look at something moves everything
 * from the pelvis up: every joint gives a little and the head gives most. These
 * shares each sum to 1, so LOOK_YAW and LOOK_PITCH below are the TOTAL
 * deflection and the split between joints is a separate, tunable thing.
 *
 * `lag` is the other half of it. The hips and spine read a slower-eased cursor
 * than the neck and head do (see `easePointer`), so the head arrives first and
 * the body settles in behind it. Without that offset six joints rotating in
 * lockstep just look like one rigid rotation with extra steps.
 */
const LOOK_CHAIN = [
  { name: "Spine", yaw: 0.12, pitch: 0.06, lag: true, upright: 0.5, square: 0.4 },
  { name: "Spine1", yaw: 0.16, pitch: 0.1, lag: true, upright: 0.5, square: 0.4 },
  { name: "Spine2", yaw: 0.2, pitch: 0.14, lag: true, upright: 0.5, square: 0.4 },
  { name: "Neck", yaw: 0.2, pitch: 0.24, lag: false, upright: 0, square: 0 },
  { name: "Head", yaw: 0.32, pitch: 0.46, lag: false, upright: 1, square: 1 },
] as const;

/**
 * The chain starts at `Spine`, NOT at `Hips`, and the rig itself does not move.
 *
 * Both of those were tried, and both look wrong for the same reason: the feet
 * are planted. `Hips` is the parent of the legs, so any yaw on it swings the
 * boots; a yaw on the figure's own group swings them too, and a sideways shift
 * slides them. On screen that does not read as a character looking at the
 * cursor, it reads as the whole model being dragged across its own shadow —
 * the stance skews, the soles turn, and the contact shadow stops matching what
 * is standing on it. A person tracking something across a room turns from the
 * waist up and leaves their feet where they are, which is what this now does.
 */

/**
 * Total deflection at full cursor throw, in radians, summed over the chain.
 *
 * The yaw was 0.52 (30 degrees), which against the reference recording is about
 * half of what it should be: at 2.0s in `ref_images/cursor_detail.jpg` the head
 * is close to profile while the chest has swung visibly with it. 0.9 rad puts
 * the head at 52 degrees and the chest, which takes 0.48 of the total, at 25 —
 * a turn rather than a glance. Pitch stays small on purpose; the reference
 * barely tips its head, and every degree of pitch spent on the spine is a
 * degree of lean fighting the upright correction below.
 */
const LOOK_YAW = 0.9;
const LOOK_PITCH = 0.3;
/** How much of it survives while the dance owns the body. */
const LOOK_DANCE_GAIN = 0.35;

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
/* Frame-local scratch. Both figures run inside one synchronous frame callback,
   so sharing these is safe and saves six allocations per joint per frame. */
const qFrame = new THREE.Quaternion();
const qDelta = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
const qInv = new THREE.Quaternion();

/**
 * Orientation of `node` relative to `stop`, built from local quaternions only.
 *
 * Deliberately not `getWorldQuaternion`, and deliberately not bone-local Euler
 * angles either. Both alternatives are wrong here, for different reasons.
 *
 * The look has to be applied about the FIGURE'S axes rather than each bone's
 * own, because the two rigs disagree about what a bone's own axes are. Measured
 * on the bind pose, applying `rotation.y += 0.3` to all six joints and reading
 * the world yaw that actually results at each one:
 *
 *   Michelle   +0.3  +0.6  +0.9  +1.2  +1.5  +1.8
 *   Soldier    -0.3   0.0  +0.3  +0.6  +0.9  +1.2
 *
 * The Soldier's `Hips` turns the WRONG WAY — his pelvis carries the pi that
 * `characters.ts` records in its header — and his `Spine` then spends its whole
 * contribution cancelling it. The head still ends up pointing roughly the right
 * way, which is exactly why this hid: the old code only drove the neck and head,
 * so it never touched the two joints that disagree. Converting one rotation into
 * each bone's parent frame is indifferent to how either rig was bound.
 *
 * The frame is taken relative to the figure's own group rather than the scene
 * because the ancestors above it are the About somersault and the section
 * tumble. Against true world axes the look would fight a rig that is upside
 * down mid-flip; against the figure's own root it rides along with it.
 */
/**
 * Stand the figure up.
 *
 * The reference robot is VERTICAL in every frame — the neck column is straight
 * up whether it is facing you or turned to profile, and the visor never rolls.
 * The Soldier's native idle is not: it is a hunched combat stance that leans
 * 3.9 degrees on average and rolls its head 4.1, drifting between 2.4 and 6.9
 * as it breathes. Measured live at the moment the cursor sits dead centre and
 * the look contributes exactly nothing, the head was rolled 8.2 degrees. That
 * is the whole of the "not standing straight" complaint: it is the clip, not
 * the cursor tracking, which is why it is visible when the mouse is not moving.
 *
 * Rather than pick a different idle — the only upright one available is Xbot's,
 * whose legs are bound a half turn the wrong way up — this corrects the pose
 * that is there. Each spine joint takes half of ITS OWN residual lean, so the
 * correction compounds down the chain (0.5, then 0.5 of what is left, and so
 * on) and lands most of the work at the base, which is where a person corrects
 * posture from. The head then takes all of its remaining residual, which levels
 * the visor.
 *
 * `setFromUnitVectors` gives the MINIMAL rotation between two directions, so it
 * removes lean and roll while leaving the facing untouched — the figure stands
 * up without turning. Applied before the cursor look, so the look's own pitch
 * survives it.
 */
type LookChainEntry = {
  bone: THREE.Object3D;
  yaw: number;
  pitch: number;
  lag: boolean;
  upright: number;
  square: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const pitchAxis = new THREE.Vector3();
const qUp = new THREE.Quaternion();
const qFix = new THREE.Quaternion();
const qJoint = new THREE.Quaternion();
const vUp = new THREE.Vector3();
const vFwd = new THREE.Vector3();

function applyUpright(chain: LookChainEntry[], root: THREE.Object3D, strength: number) {
  if (strength <= 0.001) return;
  relativeQuaternion(chain[0].bone.parent ?? chain[0].bone, root, qFrame);

  for (const j of chain) {
    if (j.upright > 0 || j.square > 0) {
      qInv.copy(qFrame).invert();

      /* SQUARE first, about the vertical: how far this joint's forward has
         drifted off the rig's own +Z, undone by its share. The idle leaves the
         chest turned 19.8 degrees and holds it there, so the figure reads as
         permanently facing slightly away — the reference is square-on whenever
         it is not actively tracking. Doing this before the swing below means
         the swing sees an already-squared joint and has only the lean left to
         take out. */
      if (j.square > 0) {
        qJoint.copy(qFrame).multiply(j.bone.quaternion);
        vFwd.set(0, 0, 1).applyQuaternion(qJoint);
        const drift = Math.atan2(vFwd.x, vFwd.z);
        qFix.setFromAxisAngle(UP, -drift * j.square * strength);
        j.bone.quaternion.premultiply(qFrame).premultiply(qFix).premultiply(qInv);
      }

      /* Then SWING the joint's own up-axis back to vertical. `setFromUnitVectors`
         is the minimal rotation between two directions, so it takes out lean and
         roll and leaves the facing — including the squaring just applied. */
      if (j.upright > 0) {
        qJoint.copy(qFrame).multiply(j.bone.quaternion);
        vUp.set(0, 1, 0).applyQuaternion(qJoint);
        qUp.setFromUnitVectors(vUp, UP);
        qFix.identity().slerp(qUp, j.upright * strength);
        j.bone.quaternion.premultiply(qFrame).premultiply(qFix).premultiply(qInv);
      }
    }
    qFrame.multiply(j.bone.quaternion);
  }
}

function relativeQuaternion(
  node: THREE.Object3D,
  stop: THREE.Object3D | null,
  out: THREE.Quaternion
) {
  out.identity();
  for (let o: THREE.Object3D | null = node; o && o !== stop; o = o.parent) {
    out.premultiply(o.quaternion);
  }
  return out;
}

/**
 * Turn every joint about ONE shared axis, each by its own share of `total`.
 *
 * Carried down the chain: once a joint is turned, its new orientation is the
 * frame the joint below it is expressed in.
 */
function pass(
  chain: LookChainEntry[],
  root: THREE.Object3D,
  axis: THREE.Vector3,
  total: number,
  which: "yaw" | "pitch",
  p: { x: number; y: number; bx: number; by: number }
) {
  relativeQuaternion(chain[0].bone.parent ?? chain[0].bone, root, qFrame);

  for (const j of chain) {
    const channel = which === "yaw" ? (j.lag ? p.bx : p.x) : j.lag ? p.by : p.y;
    qDelta.setFromAxisAngle(axis, total * (which === "yaw" ? j.yaw : j.pitch) * channel);
    qInv.copy(qFrame).invert();
    // local' = frame^-1 * delta * frame * local
    j.bone.quaternion.premultiply(qFrame).premultiply(qDelta).premultiply(qInv);
    qFrame.multiply(j.bone.quaternion);
  }
}

/* ------------------------------------------------------------------ */

/**
 * Ground speed the walk clip implies, in world units per second.
 *
 * Measured, not assumed. The clip has no root motion — the Soldier walk
 * translates its hips by 0.058 over a stride whose feet travel 1.065 — so the
 * speed has to be read off the planted foot instead: the toe's fore-aft
 * excursion is one step, the body covers two per cycle, hence `2 * excursion /
 * duration`. Play the clip at any other speed than this and the feet skate,
 * which is the same failure the procedural rig had and the same fix.
 */
function clipGroundSpeed(scene: THREE.Object3D, skin: THREE.SkinnedMesh, clip: THREE.AnimationClip) {
  const mixer = new THREE.AnimationMixer(skin);
  const action = mixer.clipAction(clip);
  action.play();

  const toe = bone(scene, "LeftToeBase");

  const SAMPLES = 48;
  const step = clip.duration / SAMPLES;
  let lo = Infinity;
  let hi = -Infinity;
  const p = new THREE.Vector3();

  mixer.setTime(0);
  for (let i = 0; i < SAMPLES; i++) {
    mixer.update(step);
    scene.updateMatrixWorld(true);
    p.setFromMatrixPosition(toe.matrixWorld);
    lo = Math.min(lo, p.z);
    hi = Math.max(hi, p.z);
  }
  action.stop();
  mixer.uncacheClip(clip);

  return clip.duration > 0 ? (2 * (hi - lo)) / clip.duration : 0;
}

/* ------------------------------------------------------------------ */

export type FigureProps = {
  character: Character;
  pose: Pose;
  paused: boolean;
  /** Bumping this replays the dance from the top. */
  danceGen?: number;
  /** World X the figure walks in from. 0 disables the walk-in. */
  startX?: number;
  /** Target world height, soles to crown. Both figures share it. */
  height: number;
  /** World Y the soles sit at. */
  floorY: number;
  /** Whether this figure should track the cursor with its head. */
  look?: boolean;
};

export default function Figure({
  character,
  pose,
  paused,
  danceGen = 0,
  startX = 0,
  height,
  floorY,
  look = true,
}: FigureProps) {
  const root = useRef<THREE.Group>(null);
  const pointer = usePointer();

  /* Resolved once. `bone()` walks the scene graph to find a name, and the old
     code paid for that twice per figure per frame to reach the same two bones. */
  const chain = useMemo(
    () => LOOK_CHAIN.map((j) => ({ ...j, bone: bone(character.scene, j.name) })),
    [character]
  );

  /* --- fit: normalise both figures to one height, soles on the floor ---
     Soldier stands 1.81 units in his own file and Michelle 1.65, a 10%
     difference that would read as the figure changing size mid-morph. Scaling
     each by its own bind-pose extents makes the swap an identity change only.

     Size and floor come from ONE measurement of the idle stance, so both feet
     and crown land exactly: verified feet -1.4200 and crown 1.0800 for both
     figures. Measured off the model rather than dialled in — see lesson 7, and
     lesson 8 for why the two ends have to be measured together. */
  const fit = useMemo(() => {
    const scale = height / character.stance.height;
    return { scale, y: floorY - character.stance.lo * scale };
  }, [character, height, floorY]);

  /* --- mixer and actions --- */
  const rig = useMemo(() => {
    const mixer = new THREE.AnimationMixer(character.skin);
    const actions = {} as Record<ClipName, THREE.AnimationAction | undefined>;

    for (const [name, clip] of Object.entries(character.clips)) {
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(0);
      actions[name as ClipName] = action;
    }

    // Dance runs once per like and hands back to the base layer.
    const dance = actions.dance;
    if (dance) {
      dance.setLoop(THREE.LoopOnce, 1);
      dance.clampWhenFinished = true;
    }

    const walkClip = character.clips.walk;
    const speed = walkClip ? clipGroundSpeed(character.scene, character.skin, walkClip) : 0;

    return { mixer, actions, walkSpeed: speed };
  }, [character]);

  /** What the base and additive layers are currently showing. */
  const cur = useRef<{ base: ClipName | null; add: ClipName | null }>({ base: null, add: null });
  const travel = useRef({ x: startX, v: 0 });
  const danceUntil = useRef(0);
  const seenDance = useRef(danceGen);
  /** Eased 1 -> LOOK_DANCE_GAIN, so the look yields to the choreography. */
  const lookGain = useRef(1);
  /* How hard to stand the figure up. Full while it is standing, off while it is
     dancing — the samba leans 8.5 degrees on purpose and straightening that
     would flatten the choreography into a shuffle. */
  const upright = useRef(1);

  /* --- crossfade helpers, following webgl_animation_skinning_blending --- */
  const setBase = (next: ClipName, dur: number) => {
    const { actions } = rig;
    const to = actions[next];
    if (!to || cur.current.base === next) return;
    const fromName = cur.current.base;
    const from = fromName ? actions[fromName] : undefined;

    to.enabled = true;
    to.setEffectiveTimeScale(1);
    to.setEffectiveWeight(1);
    to.time = 0;

    /* Hand the stride over rather than restarting it. `webgl_animation_walk`
       does this as `current.time = old.time * (durA / durB)`: two locomotion
       clips of different length still describe the same cycle, so matching the
       NORMALISED phase keeps the same foot forward across the swap. Starting
       at 0 instead plants whichever foot the new clip happens to open on. */
    const strides = !!from && !!fromName && LOCOMOTION.has(next) && LOCOMOTION.has(fromName);
    if (strides && from && fromName) {
      to.time = from.time * (to.getClip().duration / from.getClip().duration);
    }

    to.play();
    /* Warp only between two locomotion clips. `crossFadeTo`'s third argument
       rescales the incoming action's timeScale by the ratio of the two clip
       lengths and decays it back to 1 over the fade. Between a walk and a run
       that is the point — it keeps the cadence continuous while the stride
       length changes. Anywhere else it is just a speed-up: handing the 4.38s
       dance back to the 1.97s idle started the idle at 2.2x and let it slow
       down, so every dance ended with the figure briefly twitching. */
    if (from) from.crossFadeTo(to, dur, strides);
    else to.fadeIn(dur);

    cur.current.base = next;
  };

  const setAdditive = (next: ClipName | null, dur: number) => {
    const { actions } = rig;
    if (cur.current.add === next) return;
    const prev = cur.current.add ? actions[cur.current.add] : undefined;
    prev?.fadeOut(dur);

    if (next) {
      const to = actions[next];
      if (to) {
        to.enabled = true;
        to.setEffectiveTimeScale(1);
        to.reset();
        /* 1, not 0. `fadeIn` schedules an interpolant that `_updateWeight`
           MULTIPLIES the action's own weight by, so seeding the weight at 0
           makes the product 0 for the whole ramp and the gesture never appears
           at all. Measured on the live page: with `wave` selected and the
           additive layer reporting itself as active, the agree action's
           effective weight sat at 0.000 for as long as the pose was held, so
           every gesture pose has been rendering as plain idle. `setBase` seeds
           1 for exactly this reason. */
        to.setEffectiveWeight(1);
        to.play();
        to.fadeIn(dur);
      }
    }
    cur.current.add = next;
  };

  /* --- react to pose changes ---
     A dance in progress owns BOTH layers until it finishes. The additive one
     used to be exempt, which meant the home cycle's next pose faded `agree` in
     over the samba a second or two into it — two clips reaching for the same
     arms, which is half of what "the dance doesn't finish properly" looked
     like. Whatever the pose ends up being is re-applied on the way out. */
  useEffect(() => {
    if (danceUntil.current > 0) return;
    const want = POSE_CLIPS[pose] ?? POSE_CLIPS.idle;
    setBase(want.base, BASE_FADE);
    setAdditive(want.add ?? null, ADD_FADE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, rig]);

  /* --- react to likes ---
     Starting the dance goes through the same crossfade as any other base clip,
     and ending it does too. That symmetry is the fix: the previous version
     cleared `cur.base` to null before handing back, so the hand-back found no
     outgoing action and only faded the idle IN. The dance action was left at
     full weight, frozen on its last frame by `clampWhenFinished`, and from the
     first like onward the mixer blended that frozen samba 50/50 against every
     clip that followed, for the life of the page. The dance was never cut short
     — it just never let go, so the figure spent the rest of its life half in a
     pose it had finished. */
  useEffect(() => {
    if (danceGen === seenDance.current) return;
    seenDance.current = danceGen;

    /* Already dancing: swallow the like. Re-entering called
       `dance.crossFadeTo(dance)` — `cur.base` was "dance", so the outgoing and
       incoming action were the same object — which schedules a fade-out and a
       fade-in on one action in one frame, on top of a `reset()` back to frame
       zero. That is the pop when L is held down. Bumping `seenDance` above
       first means the like is dropped, not queued. */
    if (danceUntil.current > 0) return;

    const dance = rig.actions.dance;
    if (!dance) return;

    const fromName = cur.current.base;
    const from = fromName ? rig.actions[fromName] : undefined;

    dance.reset();
    dance.setLoop(THREE.LoopOnce, 1);
    dance.setEffectiveTimeScale(1);
    dance.setEffectiveWeight(1);
    dance.play();
    if (from && from !== dance) from.crossFadeTo(dance, DANCE_IN, false);
    else dance.fadeIn(DANCE_IN);

    cur.current.base = "dance";
    danceUntil.current = Math.max(0.2, dance.getClip().duration - DANCE_OUT);

    // The gesture layer would fight the dance for the arms.
    setAdditive(null, 0.2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [danceGen, rig]);

  /* --- frame loop --- */
  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    rig.mixer.timeScale = paused ? 0 : 1;
    if (paused) return;
    // Single clock: the pointer is eased from the render loop, not its own rAF.
    easePointer(pointer.current, d);

    /* Walk-in. The figure covers real ground and the clip is played at exactly
       the rate that ground implies, so the feet cannot slide. */
    const W = travel.current;
    const walking = pose === "walk" || pose === "boot";
    if (walking && Math.abs(W.x) > 1e-4) {
      const remain = -W.x;
      const cruise = rig.walkSpeed * fit.scale;
      const sp = Math.min(cruise, Math.max(0.25, Math.abs(remain) * 2.8));
      const move = Math.sign(remain) * sp * d;
      W.x = Math.abs(move) >= Math.abs(remain) ? 0 : W.x + move;
      W.v = sp;
    } else {
      W.x = THREE.MathUtils.damp(W.x, 0, 3, d);
      W.v = 0;
    }

    /* Match the clip's rate to the travel. `walkSpeed * fit.scale` is what one
       second of clip covers on the ground at this size; dividing the speed we
       actually want by it gives the time scale that makes the two agree. */
    const walkAction = rig.actions.walk;
    if (walkAction && rig.walkSpeed > 0) {
      const ground = rig.walkSpeed * fit.scale;
      walkAction.setEffectiveTimeScale(W.v > 0.01 ? W.v / ground : 1);
    }

    if (danceUntil.current > 0) {
      danceUntil.current -= d;
      if (danceUntil.current <= 0) {
        danceUntil.current = 0;
        /* `cur.base` is left reading "dance" on purpose — `setBase` needs it to
           find the outgoing action and actually fade the dance out. */
        const want = POSE_CLIPS[pose] ?? POSE_CLIPS.idle;
        setBase(want.base, DANCE_OUT);
        setAdditive(want.add ?? null, ADD_FADE);
      }
    }

    rig.mixer.update(d);

    /* The dance is choreography for the whole body; a cursor pulling the spine
       around at the same time reads as the figure being distracted mid-move.
       Eased rather than switched, so the look leaves and returns smoothly. */
    const gain = THREE.MathUtils.damp(
      lookGain.current,
      danceUntil.current > 0 ? LOOK_DANCE_GAIN : 1,
      5,
      d
    );
    lookGain.current = gain;
    upright.current = THREE.MathUtils.damp(
      upright.current,
      danceUntil.current > 0 ? 0 : 1,
      5,
      d
    );

    /* Cursor tracking, applied AFTER the mixer so it layers on the clip rather
       than being overwritten by it.

       One rotation, expressed once per joint in that joint's parent frame, and
       carried down the chain: after a joint is turned its own new orientation
       becomes the frame for the joint below it. See `relativeQuaternion` for
       why this cannot be done with `rotation.y +=`. */
    const p = pointer.current;
    if (look && root.current) {
      applyUpright(chain, root.current, upright.current);

      /* TWO passes, one axis each, and that is deliberate.
         Composing a yaw and a pitch per joint and multiplying five of those
         together does not give yaw-then-pitch: the cross terms accumulate into
         a ROLL about the figure's own forward axis. It cancels only if the two
         axes are distributed identically, and they are not — pitch is
         concentrated in the head (0.46) where yaw is spread down the spine.
         Splitting them means every rotation within a pass shares an axis, and
         rotations about a common axis commute, so each pass composes to exactly
         its total with nothing left over. Pitch first, then yaw about the rig's
         vertical, which is what keeps a turned head level. */
      /* Yaw first, then pitch about the axis the yaw left the body's shoulders
         on. Pitching about a fixed world X is only right while the figure faces
         the camera: once it has turned 85 degrees to follow the cursor, world X
         IS the head's forward axis, so a "nod" becomes a pure roll — measured
         at -8.6 degrees of visor tilt with the cursor in the top corner. The
         axis has to turn with the body. */
      pass(chain, root.current, AXIS_Y, LOOK_YAW * gain, "yaw", p);

      const yawTotal = chain.reduce((n, j) => n + j.yaw * (j.lag ? p.bx : p.x), 0);
      pitchAxis.copy(AXIS_X).applyAxisAngle(AXIS_Y, LOOK_YAW * gain * yawTotal);
      pass(chain, root.current, pitchAxis, -LOOK_PITCH * gain, "pitch", p);
    }

    // __PROBE__
    if (typeof window !== "undefined" && root.current) {
      const w = window as unknown as Record<string, unknown>;
      const key = character.skin.skeleton.bones.length < 60 ? "__robot" : "__human";
      character.scene.updateMatrixWorld(true);
      const P = (n: string) =>
        new THREE.Vector3().setFromMatrixPosition(bone(character.scene, n).matrixWorld);
      const deg = (r: number) => +((r * 180) / Math.PI).toFixed(1);
      // yaw of a left->right body line, projected on the floor: what you SEE turn
      const lineYaw = (l: string, r: string) => {
        const v = P(r).sub(P(l));
        return deg(Math.atan2(v.z, v.x));
      };
      const fwdYaw = (n: string) => {
        const q = new THREE.Quaternion();
        bone(character.scene, n).getWorldQuaternion(q);
        const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        return deg(Math.atan2(f.x, f.z));
      };
      w[key] = {
        shoulderLine: lineYaw("LeftShoulder", "RightShoulder"),
        hipLine: lineYaw("LeftUpLeg", "RightUpLeg"),
        headFwd: fwdYaw("Head"),
        chestFwd: fwdYaw("Spine2"),
        footL: +P("LeftToeBase").z.toFixed(3),
        footR: +P("RightToeBase").z.toFixed(3),
        px: +pointer.current.x.toFixed(2),
        bx: +pointer.current.bx.toFixed(2),
      };
    }
    // __PROBE_END__
    if (root.current) root.current.position.x = W.x;
  });

  return (
    <group ref={root}>
      <group scale={fit.scale} position={[0, fit.y, 0]}>
        <primitive object={character.scene} />
      </group>
    </group>
  );
}
