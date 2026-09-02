"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { bone, type Character, type ClipName } from "./characters";
import type { Pose } from "./poses";
import { easePointer, usePointer } from "./use-pointer";
import {
  applyLookChain,
  releaseLookChain,
  resolveAnchor,
  resolveArms,
  resolveJoints,
  cursorTarget,
  targetAngles,
} from "./look-chain";
import { captureLegs, releaseLegs, resolveLegs, shiftHips, solveLegs } from "./leg-ik";

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

/** How much of the cursor look survives while the dance owns the body. */
const LOOK_DANCE_GAIN = 0.35;

/* The aim range now lives in look-chain.ts (AIM_SPREAD_*), because it is a
   property of the figure rather than of the camera. */

/**
 * How far the pelvis slides toward the cursor, in world units, and the aim
 * angle that counts as "all the way". 0.075 on a figure 2.5 units tall is about
 * 3% of its height — small in isolation, but with the feet pinned it is enough
 * to visibly straighten one leg and bend the other.
 */
const HIP_SHIFT = 0.075;
const HIP_SHIFT_REF = 40 * (Math.PI / 180);

/** Fraction of the pelvis yaw the feet are allowed to follow. */
const FOOT_FOLLOW = 0.45;

/** Scratch for the raw cursor handed to `screenToTarget`. */
const aimPoint = { x: 0, y: 0 };

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

  /* Resolved once: `getObjectByName` walks the graph, and this needs four bones
     every frame. Each entry also carries its own eased angle, so the chain's
     state lives and dies with the figure it belongs to. */
  const joints = useMemo(() => resolveJoints(character.scene), [character]);
  const aimFrom = useMemo(() => resolveAnchor(character.scene), [character]);
  const arms = useMemo(() => resolveArms(character.scene), [character]);
  const legs = useMemo(() => resolveLegs(character.scene), [character]);

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
  /** Eased -1..1 weight shift, slower than any joint so the body leans last. */
  const hipShift = useRef(0);

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

    /* Hand the bones back to the clip before the mixer runs — see
       `releaseLookChain`. Without it the look compounds on any frame the mixer
       decides not to write. */
    releaseLookChain(joints, arms);
    releaseLegs(legs);
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

    /* Cursor tracking, applied AFTER the mixer so it layers on top of the clip
       rather than being overwritten by it. See look-chain.ts. */
    if (look && root.current) {
      /* The RAW cursor, not the eased one. `easePointer` already smooths toward
         the latest sample, and every joint then lerps on top of that — two
         filters in series, which is why the figure felt like it was responding
         to something that had happened a moment ago rather than to the cursor.
         The chain's own per-joint speeds are the only smoothing that should be
         here, and they are what carry the sense of weight. */
      aimPoint.x = pointer.current.tx;
      aimPoint.y = pointer.current.ty;
      const point = cursorTarget(root.current, aimFrom, aimPoint);
      const aim = targetAngles(root.current, aimFrom, point);

      /* Record the clip's foot placement BEFORE the pelvis moves — these are
         the positions the legs get solved back onto. */
      captureLegs(legs, root.current);

      applyLookChain(joints, aim, d, gain, arms);

      /* The weight shift. With the feet pinned below, moving the pelvis
         sideways is what forces one leg to straighten and the other to bend;
         it is the only part of this that makes the LEGS do anything. Eased on
         its own slow channel so the body leans over rather than snapping. */
      hipShift.current = THREE.MathUtils.damp(
        hipShift.current,
        THREE.MathUtils.clamp(aim.yaw / HIP_SHIFT_REF, -1, 1) * gain,
        2.6,
        d
      );
      shiftHips(legs, root.current, hipShift.current, HIP_SHIFT);

      /* Feet back onto their marks, following a fraction of the pelvis turn so
         they pivot a few degrees at the extremes instead of staying welded. */
      solveLegs(legs, root.current, joints[0].yaw * FOOT_FOLLOW);
    }

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
