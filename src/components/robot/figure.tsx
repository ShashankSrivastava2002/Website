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
    if (from && fromName && LOCOMOTION.has(next) && LOCOMOTION.has(fromName)) {
      to.time = from.time * (to.getClip().duration / from.getClip().duration);
    }

    to.play();
    if (from) from.crossFadeTo(to, dur, true);
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
        to.setEffectiveWeight(0);
        to.play();
        to.fadeIn(dur);
      }
    }
    cur.current.add = next;
  };

  /* --- react to pose changes --- */
  useEffect(() => {
    const want = POSE_CLIPS[pose] ?? POSE_CLIPS.idle;
    // A dance in progress owns the base layer until it finishes.
    if (danceUntil.current <= 0) setBase(want.base, BASE_FADE);
    setAdditive(want.add ?? null, ADD_FADE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, rig]);

  /* --- react to likes --- */
  useEffect(() => {
    if (danceGen === seenDance.current) return;
    seenDance.current = danceGen;
    const dance = rig.actions.dance;
    if (!dance) return;
    dance.reset();
    dance.setEffectiveWeight(1);
    dance.setLoop(THREE.LoopOnce, 1);
    dance.play();
    const from = cur.current.base ? rig.actions[cur.current.base] : undefined;
    if (from) from.crossFadeTo(dance, 0.3, false);
    cur.current.base = "dance";
    danceUntil.current = dance.getClip().duration - 0.4;
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
        cur.current.base = null;
        setBase(POSE_CLIPS[pose]?.base ?? "idle", 0.5);
      }
    }

    rig.mixer.update(d);

    /* Cursor tracking, applied AFTER the mixer so it layers on the clip rather
       than being overwritten by it. Split across neck and head so the figure
       turns rather than swivelling one joint. */
    if (look) {
      const yaw = THREE.MathUtils.clamp(pointer.current.x * 0.5, -0.6, 0.6);
      const pitch = THREE.MathUtils.clamp(-pointer.current.y * 0.3, -0.3, 0.3);
      const neck = bone(character.scene, "Neck");
      const head = bone(character.scene, "Head");
      if (neck) {
        neck.rotation.y += yaw * 0.35;
        neck.rotation.x += pitch * 0.35;
      }
      if (head) {
        head.rotation.y += yaw * 0.65;
        head.rotation.x += pitch * 0.65;
      }
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
