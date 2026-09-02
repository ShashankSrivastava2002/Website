"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { ADDITIVE, bone, type Character, type ClipName } from "./character";
import { applyLook, resolveChain } from "./look";
import { easePointer, usePointer } from "./use-pointer";
import type { Pose } from "./poses";
import { POSE_CLIPS } from "./poses";

/**
 * Plays one baked character.
 *
 * Two layers, after the two three.js skinning examples: a BASE layer holding
 * idle / walk / run / dance and swapped with `crossFadeTo`, and an ADDITIVE
 * layer holding a gesture faded in over whatever the base is doing.
 *
 * Both figures expose the same six clips under the same six names, so this
 * component does not know or care which one it is driving.
 */

/** Clips that move the feet, and so must hand their phase on when swapped. */
const LOCOMOTION = new Set<ClipName>(["walk", "run"]);

const BASE_FADE = 0.45;
const ADD_FADE = 0.35;
const DANCE_IN = 0.3;
const DANCE_OUT = 0.45;
/** How much of the cursor look survives while the dance owns the body. */
const DANCE_LOOK_GAIN = 0.35;

export type FigureProps = {
  character: Character;
  pose: Pose;
  paused: boolean;
  /** Bumping this plays the dance once. Bumps during a dance are ignored. */
  danceGen?: number;
  /** World X the figure walks in from. 0 disables the walk-in. */
  startX?: number;
  /** Target world height, soles to crown. Both figures share it. */
  height: number;
  /** World Y the soles sit at. */
  floorY: number;
  look?: boolean;
};

/**
 * Ground speed the walk clip implies, in world units per second.
 *
 * Measured, not assumed. The clip has no root motion, so the speed has to be
 * read off the planted foot: the toe's fore-aft excursion is one step and the
 * body covers two per cycle. Play the clip at any other rate than this and the
 * feet skate.
 */
function clipGroundSpeed(scene: THREE.Object3D, skin: THREE.SkinnedMesh, clip: THREE.AnimationClip) {
  const mixer = new THREE.AnimationMixer(skin);
  mixer.clipAction(clip).play();
  const toe = bone(scene, "LeftToeBase");
  const p = new THREE.Vector3();

  const SAMPLES = 48;
  let lo = Infinity;
  let hi = -Infinity;
  mixer.setTime(0);
  for (let i = 0; i < SAMPLES; i++) {
    mixer.update(clip.duration / SAMPLES);
    scene.updateMatrixWorld(true);
    p.setFromMatrixPosition(toe.matrixWorld);
    lo = Math.min(lo, p.z);
    hi = Math.max(hi, p.z);
  }
  mixer.stopAllAction();
  mixer.uncacheClip(clip);

  return clip.duration > 0 ? (2 * (hi - lo)) / clip.duration : 0;
}

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

  /* Both figures are normalised to one height with their soles on one floor, so
     the About swap is an identity change and nothing else. Derived from each
     model's own measured stance rather than reconciled with hand-tuned
     constants afterwards — there is nothing left to get 2% wrong. */
  const fit = useMemo(() => {
    const scale = height / character.stance.height;
    return { scale, y: floorY - character.stance.lo * scale };
  }, [character, height, floorY]);

  const chain = useMemo(() => resolveChain(character.scene), [character]);

  const rig = useMemo(() => {
    const mixer = new THREE.AnimationMixer(character.skin);
    const actions = {} as Record<ClipName, THREE.AnimationAction>;

    for (const [name, clip] of Object.entries(character.clips)) {
      const additive = ADDITIVE.has(name as ClipName);
      const action = mixer.clipAction(
        clip,
        undefined,
        additive ? THREE.AdditiveAnimationBlendMode : THREE.NormalAnimationBlendMode
      );
      action.enabled = true;
      action.setEffectiveTimeScale(1);
      action.setEffectiveWeight(0);
      actions[name as ClipName] = action;
    }

    actions.dance.setLoop(THREE.LoopOnce, 1);
    actions.dance.clampWhenFinished = true;

    return {
      mixer,
      actions,
      walkSpeed: clipGroundSpeed(character.scene, character.skin, character.clips.walk),
      /* What each layer is showing, kept INSIDE the memo on purpose.
         Held in its own ref it outlives the actions it describes: rebuilding
         the mixer gives six fresh actions sitting at weight 0, while the ref
         still says the base layer is "idle" — so `setBase` sees no change,
         returns immediately, and nothing is ever played. The figure stands in
         its bind pose forever, which on a Mixamo rig is a T-pose, with
         `enabled: true, weight: 0, running: false` and a base of "idle" that
         was true one mixer ago. Bundling the two means they cannot disagree. */
      cur: { base: null as ClipName | null, add: null as ClipName | null },
    };
  }, [character]);

  const travel = useRef({ x: startX, v: 0 });
  const danceUntil = useRef(0);
  const seenDance = useRef(danceGen);
  const lookGain = useRef(1);

  const setBase = (next: ClipName, dur: number) => {
    const to = rig.actions[next];
    if (!to || rig.cur.base === next) return;
    const fromName = rig.cur.base;
    const from = fromName ? rig.actions[fromName] : undefined;

    to.enabled = true;
    to.setEffectiveTimeScale(1);
    to.setEffectiveWeight(1);
    to.time = 0;

    /* Hand the stride over rather than restarting it: two locomotion clips of
       different length describe the same cycle, so matching the NORMALISED
       phase keeps the same foot forward across the swap. */
    const strides = !!fromName && LOCOMOTION.has(next) && LOCOMOTION.has(fromName);
    if (from && strides) to.time = from.time * (to.getClip().duration / from.getClip().duration);

    to.play();
    /* Warp only between two locomotion clips. The third argument rescales the
       incoming action's timeScale by the ratio of clip lengths — right when a
       walk becomes a run, and a plain speed-up anywhere else: handing the 3.8s
       dance back to the 2.0s idle started the idle at 1.9x. */
    if (from) from.crossFadeTo(to, dur, strides);
    else to.fadeIn(dur);

    rig.cur.base = next;
  };

  const setAdditive = (next: ClipName | null, dur: number) => {
    if (rig.cur.add === next) return;
    const prev = rig.cur.add ? rig.actions[rig.cur.add] : undefined;
    prev?.fadeOut(dur);

    if (next) {
      const to = rig.actions[next];
      to.enabled = true;
      to.setEffectiveTimeScale(1);
      to.reset();
      /* 1, not 0. `fadeIn` schedules an interpolant that `_updateWeight`
         MULTIPLIES this weight by, so seeding 0 makes the product 0 for the
         whole ramp and the gesture never appears at all — measured at exactly
         0.000 for as long as the pose was held. `setBase` seeds 1 for the same
         reason. */
      to.setEffectiveWeight(1);
      to.play();
      to.fadeIn(dur);
    }
    rig.cur.add = next;
  };

  /* A dance in progress owns BOTH layers. The additive one used to be exempt,
     which let the home cycle fade a nod in over the samba a second or two in —
     two clips reaching for the same arms. */
  useEffect(() => {
    if (danceUntil.current > 0) return;
    const want = POSE_CLIPS[pose];
    setBase(want.base, BASE_FADE);
    setAdditive(want.add ?? null, ADD_FADE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, rig]);

  useEffect(() => {
    if (danceGen === seenDance.current) return;
    seenDance.current = danceGen;

    /* Already dancing: swallow it. Re-entering called
       `dance.crossFadeTo(dance)` — `cur.base` was "dance", so the outgoing and
       incoming action were the same object — scheduling a fade-out and a
       fade-in on one action in one frame, on top of a reset to frame zero.
       That is the pop when the key is held down. */
    if (danceUntil.current > 0) return;

    const dance = rig.actions.dance;
    const fromName = rig.cur.base;
    const from = fromName ? rig.actions[fromName] : undefined;

    dance.reset();
    dance.setLoop(THREE.LoopOnce, 1);
    dance.setEffectiveTimeScale(1);
    dance.setEffectiveWeight(1);
    dance.play();
    if (from && from !== dance) from.crossFadeTo(dance, DANCE_IN, false);
    else dance.fadeIn(DANCE_IN);

    rig.cur.base = "dance";
    danceUntil.current = Math.max(0.2, dance.getClip().duration - DANCE_OUT);
    setAdditive(null, 0.2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [danceGen, rig]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    rig.mixer.timeScale = paused ? 0 : 1;
    if (paused) return;

    easePointer(pointer.current, d);

    /* Walk-in: the figure covers real ground and the clip runs at exactly the
       rate that ground implies, so the feet cannot slide. */
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

    const ground = rig.walkSpeed * fit.scale;
    if (ground > 0) rig.actions.walk.setEffectiveTimeScale(W.v > 0.01 ? W.v / ground : 1);

    /* The dance hands the base layer back through the SAME crossfade it took it
       with. Clearing `cur.base` first instead left the hand-back with no
       outgoing action, so it faded the idle in and never faded the dance out —
       and `clampWhenFinished` then held a frozen samba at full weight against
       every later clip, for the life of the page. */
    if (danceUntil.current > 0) {
      danceUntil.current -= d;
      if (danceUntil.current <= 0) {
        danceUntil.current = 0;
        const want = POSE_CLIPS[pose];
        setBase(want.base, DANCE_OUT);
        setAdditive(want.add ?? null, ADD_FADE);
      }
    }

    rig.mixer.update(d);

    lookGain.current = THREE.MathUtils.damp(
      lookGain.current,
      danceUntil.current > 0 ? DANCE_LOOK_GAIN : 1,
      5,
      d
    );
    if (look && root.current) applyLook(chain, root.current, pointer.current, lookGain.current);

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
