/**
 * Loading and clip retargeting for the two glTF characters.
 *
 * The figures are `Soldier.glb` (the robot) and `Michelle.glb` (the human),
 * with `Xbot.glb` carried along purely as a source of gestures neither of the
 * other two contains. All three are Mixamo rigs, and the reason this works at
 * all is a measured fact rather than an assumption:
 *
 *   Soldier and Michelle expose EXACTLY the same 65 bones, name for name.
 *   Xbot adds two (LeftEye, RightEye) and is otherwise a superset.
 *
 * So the `names` map that `webgpu_animation_retargeting.html` spells out by
 * hand is the identity here, and `retargetClip` falls back to `bone.name` on
 * its own. What is NOT shared is the bind pose: comparing rest rotations bone
 * by bone gives a mean difference of 0.356 rad and a full pi at the hips. That
 * is why the clips cannot simply be copied across, and why every cross-figure
 * clip below goes through `retargetClip`, which resolves each bone in WORLD
 * space and is therefore indifferent to how the two rigs were bound.
 *
 * `preserveBonePositions` (on by default) is the other half of it: only the hip
 * receives a position track, and every other bone keeps its own rest offset. So
 * a retargeted clip drives the target's rotations while the target keeps its own
 * limb lengths — Michelle does not inherit Soldier's proportions along with his
 * walk.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { AnimationUtils } from "three";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { retargetClip } from "three/examples/jsm/utils/SkeletonUtils.js";

export const MODEL_URLS = {
  soldier: "/models/Soldier.glb",
  michelle: "/models/Michelle.glb",
  xbot: "/models/Xbot.glb",
} as const;

/** The clip vocabulary the rest of the app addresses, independent of source. */
export type ClipName = "idle" | "walk" | "run" | "dance" | "agree" | "headShake";

/**
 * Resolve a Mixamo bone, whatever the loader called it.
 *
 * The glTF files name their bones `mixamorig:Hips`, but `GLTFLoader` passes
 * every node name through `PropertyBinding.sanitizeNodeName`, which strips the
 * characters reserved by the animation-binding syntax — `[ ] . : /` — so at
 * runtime the bone is `mixamorigHips`. That is why the retargeting example
 * writes its whole `names` map without colons.
 *
 * Looking up the colonised name returns `undefined` and every caller here
 * treated that as "no bone" rather than as an error. The visible result was a
 * `scale: 0` handed to `retargetClip`, because the hip-height ratio divided a
 * missing bone's height by another missing bone's height; that zeroes the hip
 * position track and drops the figure flat on its back. Hence the throw: a bone
 * that cannot be found is a bug, never a default.
 */
export function bone(root: THREE.Object3D, short: string): THREE.Object3D {
  const found =
    root.getObjectByName(`mixamorig${short}`) ?? root.getObjectByName(`mixamorig:${short}`);
  if (!found) throw new Error(`characters: no bone "${short}" (tried both mixamorig spellings)`);
  return found;
}

/** The hip bone's runtime name on this model, for `retargetClip`'s `hip`. */
function hipName(root: THREE.Object3D) {
  return bone(root, "Hips").name;
}

/**
 * The stretch of `SambaDance` used as the like reaction.
 *
 * The clip runs 18.2 seconds, which is a performance rather than a reaction.
 * These bounds are the pair of times, 3 to 5 seconds apart, whose poses are
 * closest to each other across the whole clip: comparing every frame against
 * every other, the gap here is 0.094 rad/bone against a 0.226 average, so it
 * returns 2.4x closer to where it started than an arbitrary cut would. That is
 * what lets it end without a snap back to idle.
 */
const SAMBA_TRIM: [number, number] = [0.45, 4.85];

/**
 * Gestures that layer onto whatever the base is doing rather than replacing it.
 *
 * Only Xbot's two real animations are here. Its `sad_pose` and `sneak_pose` are
 * two keyframes long, and after retargeting they only register while the mixer
 * is interpolating BETWEEN those two keys — held constant, or clamped with
 * `LoopOnce` + `clampWhenFinished`, they contribute exactly nothing (measured:
 * the right hand sits at the idle baseline to three decimal places under both).
 * Rather than ship a posture that silently does nothing, they are left out.
 */
const ADDITIVE: ClipName[] = ["agree", "headShake"];

/* ------------------------------------------------------------------ */

/** First skinned mesh under `root`. Soldier has two sharing one skeleton. */
export function findSkin(root: THREE.Object3D): THREE.SkinnedMesh {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  if (!found) throw new Error("characters: no SkinnedMesh in model");
  return found;
}

/** World-space height of a bone in the model's bind pose. */
function boneHeight(root: THREE.Object3D, short: string) {
  root.updateMatrixWorld(true);
  return new THREE.Vector3().setFromMatrixPosition(bone(root, short).matrixWorld).y;
}

/**
 * The figure's standing extent while `clip` plays: lowest bone and crown.
 *
 * Measured off the BONES, deliberately. The obvious alternative — union the
 * skinned meshes' bounding boxes — is wrong here and wrong in a way that hides:
 * `computeBoundingBox` returns the PRE-skinning vertex extents, which live in
 * whatever space the artist authored, and the two files do not agree. Soldier's
 * mesh is centimetres and Z-up (0..183); Michelle's is metres and Y-up
 * (0..1.66). Both then sit under a 0.01 root scale, so unioning their boxes
 * gave Soldier a plausible 1.83 and Michelle 0.004 — and a figure scaled by
 * 2.5/0.004 = 646x, parked 55 units below the floor and entirely invisible.
 * Bones are posed in world space by the same skinning the renderer uses, so
 * they are the only extent that means the same thing for both models.
 *
 * Measured on the IDLE clip rather than the bind pose, and BOTH ends on it, so
 * that scaling to a common height and standing on a common floor are the same
 * measurement. Mixing the two — height from the bind pose, floor from the clip
 * — left Michelle's crown 0.135 short of Soldier's, because her retargeted idle
 * stands 0.085 higher than her bind pose does. Same trap as the old HUMAN_FIT:
 * the sole gap and the head gap have to close together or neither is right.
 */
function stance(root: THREE.Object3D, clip: THREE.AnimationClip) {
  const skin = findSkin(root);
  const bones = skin.skeleton.bones;
  const crown = bone(root, "HeadTop_End");
  const v = new THREE.Vector3();

  const mixer = new THREE.AnimationMixer(skin);
  const action = mixer.clipAction(clip);
  action.play();

  let lo = Infinity;
  let hi = -Infinity;
  const SAMPLES = 24;
  for (let i = 0; i < SAMPLES; i++) {
    mixer.update(clip.duration / SAMPLES);
    root.updateMatrixWorld(true);
    for (const b of bones) lo = Math.min(lo, v.setFromMatrixPosition(b.matrixWorld).y);
    hi = Math.max(hi, v.setFromMatrixPosition(crown.matrixWorld).y);
  }

  action.stop();
  mixer.uncacheClip(clip);
  skin.skeleton.pose();
  root.updateMatrixWorld(true);

  return { lo, hi, height: hi - lo };
}

/**
 * Retarget `clip` from `sourceRoot`'s skeleton onto `targetRoot`'s.
 *
 * Both roots are cloned first. `retargetClip` samples by repeatedly posing the
 * target skeleton and reading the source's world matrices, so handing it either
 * live scene would leave a displayed figure frozen in the clip's last frame.
 *
 * `scale` corrects the one channel that is a length rather than an angle. The
 * hip position track is copied in the target's local units, so without it a
 * clip captured on a 1.03-unit hip lands unchanged on a 1.06-unit hip and the
 * figure sinks or floats by the difference.
 */
/** Bone names present on both skeletons, as an identity rename map. */
function sharedBoneNames(target: THREE.Object3D, source: THREE.Object3D) {
  const src = new Set(findSkin(source).skeleton.bones.map((b) => b.name));
  const out: Record<string, string> = {};
  for (const b of findSkin(target).skeleton.bones) if (src.has(b.name)) out[b.name] = b.name;
  return out;
}

function retargetOnto(
  targetRoot: THREE.Object3D,
  sourceRoot: THREE.Object3D,
  clip: THREE.AnimationClip,
  name: ClipName,
  trim?: [number, number]
) {
  const target = cloneSkinned(targetRoot);
  const source = cloneSkinned(sourceRoot);
  target.updateMatrixWorld(true);
  source.updateMatrixWorld(true);
  const hipRatio = boneHeight(target, "Hips") / boneHeight(source, "Hips");

  /* The SOURCE argument is a Skeleton, not a scene.
     `retargetClip` branches on `source.isObject3D`: a Skeleton takes the
     `getHelperFromSkeleton` path, which wraps it in a SkeletonHelper rooted at
     bones[0] so the bone world matrices actually update as the clip plays.
     Handing it the scene Group instead satisfies `isObject3D` and then dies on
     `source.skeleton.bones`, because a Group has no skeleton. The TARGET is the
     SkinnedMesh, which does have one. */
  const out = retargetClip(findSkin(target), findSkin(source).skeleton, clip, {
    hip: hipName(target),
    scale: hipRatio,
    /* REQUIRED, and the single hardest thing to find here.
       `retarget`'s own `getBoneName` is `options.names[bone.name]` with NO
       fallback to the bone's own name — only `retargetClip` falls back, and
       only for naming the output tracks. So an omitted `names` map does not
       mean "match on name", it means NO bone matches: every bone is left at
       whatever `skeleton.pose()` set, and the figure comes out lying flat.
       Measured, with the map and without: torso up-vector 0.990 versus -0.130.
       All 49 shared bones are listed rather than the reference example's 20,
       so hands and feet retarget too. */
    names: sharedBoneNames(target, source),
    /* Keep the hip's vertical travel, drop its fore-aft and lateral drift. The
       samba wanders 0.80 units over its length; on a figure standing in a fixed
       spot on the page that reads as the character sliding off its mark. */
    hipInfluence: new THREE.Vector3(0, 1, 0),
    ...(trim ? { trim } : {}),
  }) as THREE.AnimationClip;
  out.name = name;
  return out;
}

/**
 * Turn a gesture clip into an additive layer, following
 * `webgl_animation_skinning_additive_blending` exactly.
 *
 * The `subclip(clip, name, 2, 3, 30)` is that example's own line and it matters:
 * a `_pose` clip holds its keys at 0.033 and 0.067 seconds, so frames 2..3 at
 * 30fps select the settled pose after `makeClipAdditive` has subtracted the
 * neutral one at frame 0. Taking the whole clip instead would play the ramp on
 * a loop.
 */
function toAdditive(clip: THREE.AnimationClip) {
  AnimationUtils.makeClipAdditive(clip);
  return clip.name.endsWith("_pose") || clip.duration < 0.2
    ? AnimationUtils.subclip(clip, clip.name, 2, 3, 30)
    : clip;
}

/**
 * Prepare a cloned scene for display.
 *
 * Two things, both necessary.
 *
 * OWN MATERIALS: `SkeletonUtils.clone` shares material instances with the
 * cached glTF, and the dissolve patches materials in place through
 * `onBeforeCompile`. Without cloning, dissolving one figure would dissolve
 * every figure sharing that material — including the cached original, which
 * then hands the next mount a pre-patched material.
 *
 * NO FRUSTUM CULLING: a skinned mesh is posed on the GPU, but three culls it
 * against `geometry.boundingSphere`, which describes the UNSKINNED vertices.
 * Those live in whatever space the file was authored in, and these two files
 * disagree by a factor of a hundred — Soldier's mesh is in centimetres,
 * Michelle's in metres. Michelle's bounding sphere therefore came out ~100x too
 * small, sat nowhere near where she was actually drawn, and the renderer culled
 * her on every frame: the About morph faded the robot out and revealed nothing.
 * Skinned meshes should not be culled by their rest bounds.
 */
function prepare(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    if (!m.material) return;
    m.material = Array.isArray(m.material)
      ? m.material.map((x) => x.clone())
      : m.material.clone();
  });
  return root;
}

/**
 * Put a model in a common world orientation before anything else touches it.
 *
 * Soldier faces -Z; Michelle and Xbot face +Z. Measured, not eyeballed: the
 * vector from each heel to its own toe points the opposite way on Soldier, and
 * his left and right shoulders sit at mirrored x. Their glTF roots carry
 * opposite quarter-turns about x (-90 and +90), which is where it comes from.
 *
 * This has to be fixed BEFORE retargeting, not after, and that is the part that
 * is easy to get wrong. `retargetClip` reads each source bone's WORLD matrix
 * and re-expresses it in the target's local frame, so the target inherits the
 * source's world facing. Correct the two figures only at display time and the
 * native clips would face one way while every retargeted clip faced the other —
 * the Soldier would snap through 180 degrees the moment a like started the
 * samba, and back again when it ended. Normalising first means every clip,
 * native or retargeted, agrees.
 *
 * The camera sits at +Z, so +Z is also the direction that faces the viewer.
 */
function orient(scene: THREE.Object3D, yaw: number) {
  const g = new THREE.Group();
  g.rotation.y = yaw;
  g.add(scene);
  g.updateMatrixWorld(true);
  return g;
}

/** Yaw that turns each model to face +Z. */
const FACING: Record<"soldier" | "michelle" | "xbot", number> = {
  soldier: Math.PI,
  michelle: 0,
  xbot: 0,
};

/** Pick a clip out of a glTF by name, case-insensitively. */
function pick(clips: THREE.AnimationClip[], want: string) {
  const found = clips.find((c) => c.name.toLowerCase() === want.toLowerCase());
  if (!found) throw new Error(`characters: no clip "${want}" (have ${clips.map((c) => c.name).join(", ")})`);
  return found;
}

export type Character = {
  /** A fresh, independently posable copy of the model. */
  scene: THREE.Object3D;
  skin: THREE.SkinnedMesh;
  clips: Partial<Record<ClipName, THREE.AnimationClip>>;
  /** Standing extent while idling: sets both the figure's size and its floor. */
  stance: { lo: number; hi: number; height: number };
};

type Gltf = { scene: THREE.Object3D; animations: THREE.AnimationClip[] };

/**
 * Load all three models and build both characters' clip libraries.
 *
 * Suspends until the glTFs are in, then memoises: the build below clones two
 * scenes and bakes eleven retargeted clips, and the component calling this
 * re-renders on every pose change. Doing that work per render is the same
 * mistake as an expensive expression inside `useRef` — the result is discarded
 * but the cost is not. See lesson 11 in .context.
 */
export function useCharacters(): { soldier: Character; michelle: Character } {
  const soldierGltf = useGLTF(MODEL_URLS.soldier) as unknown as Gltf;
  const michelleGltf = useGLTF(MODEL_URLS.michelle) as unknown as Gltf;
  const xbotGltf = useGLTF(MODEL_URLS.xbot) as unknown as Gltf;

  return useMemo(
    () => build(soldierGltf, michelleGltf, xbotGltf),
    [soldierGltf, michelleGltf, xbotGltf]
  );
}

function build(
  soldierGltf: Gltf,
  michelleGltf: Gltf,
  xbotGltf: Gltf
): { soldier: Character; michelle: Character } {
  /* Oriented copies. Everything below — display, retarget source and retarget
     target alike — is built from these, so no part of the system ever sees the
     raw, differently-facing originals. */
  const soldierSrc = orient(cloneSkinned(soldierGltf.scene), FACING.soldier);
  const michelleSrc = orient(cloneSkinned(michelleGltf.scene), FACING.michelle);
  const xbotSrc = orient(cloneSkinned(xbotGltf.scene), FACING.xbot);

  const soldierScene = prepare(orient(cloneSkinned(soldierGltf.scene), FACING.soldier));
  const michelleScene = prepare(orient(cloneSkinned(michelleGltf.scene), FACING.michelle));

  // Native clips: each figure's own captures need no retargeting at all.
  const sIdle = pick(soldierGltf.animations, "Idle");
  const sWalk = pick(soldierGltf.animations, "Walk");
  const sRun = pick(soldierGltf.animations, "Run");
  const mSamba = pick(michelleGltf.animations, "SambaDance");

  // Cross-figure clips. Michelle owns the dance and nothing else usable; the
  // Soldier owns locomotion and no gestures. Each borrows from the other, and
  // both borrow the gestures from Xbot.
  const xAgree = pick(xbotGltf.animations, "agree");
  const xShake = pick(xbotGltf.animations, "headShake");

  /**
   * Build one figure's library, converting the gesture clips to additive.
   *
   * Every gesture arrives from `retargetOnto`, which returns a fresh clip, so
   * `makeClipAdditive` — which mutates in place — can never reach the cached
   * glTF's own animations. The native base clips are used as-is and are the
   * shared ones, which is exactly why nothing additive is ever done to them.
   */
  const withAdditive = (clips: Partial<Record<ClipName, THREE.AnimationClip>>) => {
    for (const name of ADDITIVE) {
      const c = clips[name];
      if (c) clips[name] = toAdditive(c);
    }
    return clips;
  };

  const soldier: Character = {
    scene: soldierScene,
    skin: findSkin(soldierScene),
    stance: { lo: 0, hi: 0, height: 1 },
    clips: withAdditive({
      idle: sIdle,
      walk: sWalk,
      run: sRun,
      dance: retargetOnto(soldierSrc, michelleSrc, mSamba, "dance", SAMBA_TRIM),
      agree: retargetOnto(soldierSrc, xbotSrc, xAgree, "agree"),
      headShake: retargetOnto(soldierSrc, xbotSrc, xShake, "headShake"),
    }),
  };

  const michelle: Character = {
    scene: michelleScene,
    skin: findSkin(michelleScene),
    stance: { lo: 0, hi: 0, height: 1 },
    clips: withAdditive({
      // Retargeted onto herself: it costs one bake and buys the same XZ-drift
      // removal the Soldier copy gets, so she dances on the spot too.
      dance: retargetOnto(michelleSrc, michelleSrc, mSamba, "dance", SAMBA_TRIM),
      idle: retargetOnto(michelleSrc, soldierSrc, sIdle, "idle"),
      walk: retargetOnto(michelleSrc, soldierSrc, sWalk, "walk"),
      run: retargetOnto(michelleSrc, soldierSrc, sRun, "run"),
      agree: retargetOnto(michelleSrc, xbotSrc, xAgree, "agree"),
      headShake: retargetOnto(michelleSrc, xbotSrc, xShake, "headShake"),
    }),
  };

  // Measured last: it needs the idle clip, which the libraries above build.
  soldier.stance = stance(soldierScene, soldier.clips.idle!);
  michelle.stance = stance(michelleScene, michelle.clips.idle!);

  return { soldier, michelle };
}

useGLTF.preload(MODEL_URLS.soldier);
useGLTF.preload(MODEL_URLS.michelle);
useGLTF.preload(MODEL_URLS.xbot);
