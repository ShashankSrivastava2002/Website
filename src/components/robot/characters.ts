/**
 * Loading and clip retargeting for the two glTF characters.
 *
 * The figures are `Ybot.glb` (the robot) and `Michelle.glb` (the human), with
 * `Xbot.glb` loaded as a clip donor that is never drawn. `Soldier.glb` is no
 * longer loaded.
 *
 * The Soldier was the robot until his idle was measured against the reference
 * recording. It is a combat stance: the hips sit 43.7 degrees off square with
 * one foot staggered 0.68 units behind the other, and it holds that pose the
 * whole clip. Nothing above the waist can fix that — squaring the hips means
 * turning the legs, and the feet are planted where the clip puts them — so
 * correcting the spine only ever squared the top half over a lower half that
 * never moved, which is exactly why the tracking read as "only the neck moves".
 *
 *   Soldier / Idle    hips off-square 43.7deg   feet stagger 0.68
 *   Xbot / idle        hips off-square  3.7deg   feet stagger 0.01
 *
 * Xbot stands square with level feet, which is the reference stance, and it is
 * the only one of the three carrying idle, walk, run, agree and headShake. So
 * it stays loaded for those five clips and nothing else: Y Bot ships a single
 * 0.03s T-pose, and Michelle only has the samba.
 *
 * Y Bot replaced Xbot as the robot's BODY because Xbot reads female — Mixamo's
 * two base characters differ in exactly the way you would expect, measured on
 * the bind pose:
 *
 *              shoulder width   hip width
 *   Xbot           0.303          0.164
 *   Y Bot          0.375          0.182
 *
 * Every clip therefore crosses rigs now, where before the robot played its own
 * captures untouched. That is not free — see `retargetOnto`, and note that the
 * two rigs are bound a half-turn apart at the hip, Xbot's thigh axis pointing
 * up and Y Bot's down — but it is the same one hop the human's clips already
 * took, through the same tested path. `scripts/bake-ybot.mjs` documents what
 * had to be repaired in the Y Bot download before any of it would work.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { AnimationUtils } from "three";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export const MODEL_URLS = {
  /* Soldier.glb stays on disk for reference but is no longer fetched — it was
     2.16 MB of download for a stance the site cannot use. */
  robot: "/models/Ybot.glb",
  human: "/models/Michelle.glb",
  /* Loaded for its ANIMATIONS ONLY — never displayed. Y Bot ships a T-pose and
     nothing else, so the robot's mesh and the robot's motion now come from
     different files. See `build`. */
  motion: "/models/Xbot.glb",
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

/**
 * The stretch of `SambaDance` used as the like reaction.
 *
 * The clip runs 18.2 seconds, which is a performance rather than a reaction.
 *
 * These bounds were originally chosen to minimise ONE thing: how close the
 * window's last pose is to its first, so the cut would not snap back to idle.
 * That criterion picked [0.45, 4.85], whose closure is genuinely the best in
 * the clip at 0.091 rad/bone — and which is also, measured across every 4.4s
 * window in the clip, the 26th most energetic of 28. It optimised straight into
 * the flattest stretch of the samba, because the quietest passage is naturally
 * the easiest one to loop. The reaction played for its full length and read as
 * the figure shuffling.
 *
 * Scoring motion as well as closure — mean per-frame angular travel summed over
 * all 65 joints, against pose distance between the two ends — gives this window
 * instead: 26% more motion for 0.035 rad/bone of extra gap. That trade is worth
 * taking now in a way it was not before, because the hand-back is a real 0.45s
 * crossfade rather than a cut (see DANCE_OUT in figure.tsx), and a crossfade
 * absorbs a small pose gap without showing it.
 */
const SAMBA_TRIM: [number, number] = [13.02, 16.83];

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

  /* Snapshot every bone's LOCAL transform so the measurement can be undone
     exactly. The obvious way to undo it -- `skeleton.pose()` -- is wrong here,
     and wrong in a way that is invisible on one model and fatal on another.

     `Skeleton.pose()` rebuilds each bone's local matrix from its bind matrix,
     but it only divides out the parent when the parent is ITSELF a bone. A root
     bone whose parent is a plain node therefore has its bind WORLD matrix
     written into its LOCAL slot, and every non-bone ancestor transform gets
     applied a second time on the next update.

     Michelle's `mixamorigHips` hangs directly off `Character`, which carries the
     0.01 metres/centimetres conversion, so `pose()` rewrote her hip as
     position (0, 1.026, -0.005) with scale 0.01 -- a 602x collapse of the whole
     skeleton into a 0.003-unit ball. Nothing put it back: her clips are
     retargeted and retargeting emits no scale tracks, so the 0.01 stuck for the
     life of the page and she rendered as a speck. The Soldier survived the same
     call only because his conversion happens to decompose to scale 1, and his
     native clips carry 52 scale tracks that would have overwritten it anyway.

     Saving and restoring the three local vectors is exact for any rig and
     depends on no assumption about the hierarchy above the root bone. */
  const rest = bones.map((b) => ({
    position: b.position.clone(),
    quaternion: b.quaternion.clone(),
    scale: b.scale.clone(),
  }));

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

  bones.forEach((b, i) => {
    b.position.copy(rest[i].position);
    b.quaternion.copy(rest[i].quaternion);
    b.scale.copy(rest[i].scale);
  });
  root.updateMatrixWorld(true);

  return { lo, hi, height: hi - lo };
}

/**
 * Retarget `clip` from `sourceRoot`'s rig onto `targetRoot`'s.
 *
 * Written out rather than calling `SkeletonUtils.retargetClip`, because that
 * function drops the one term that makes retargeting correct across rigs that
 * were bound differently:
 *
 *     desiredWorld(bone) = animWorld(source) * ( bindWorld(source)^-1 * bindWorld(bone) )
 *                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 *
 * three copies the source bone's world orientation onto the target verbatim and
 * omits the trailing correction, which is fine only while both rigs happen to
 * bind their bones the same way round. These do not. Measured on the bind pose,
 * the world direction of `LeftUpLeg`'s local +Y:
 *
 *     Soldier    (0.00, -1.00,  0.00)     thigh points down
 *     Michelle   (0.07, -1.00,  0.02)     down
 *     Xbot       (0.00,  1.00,  0.00)     UP
 *
 * So every clip crossing to or from Xbot arrived with its legs rotated a half
 * turn — the samba retargeted onto Xbot put its highest foot at 1.81 against a
 * head at 1.39, standing on its own scalp. With the bind difference restored
 * the same clip lands feet 0.36, head 1.39, and the correction is a no-op
 * between two rigs that already agree, so nothing else changes.
 *
 * Both roots are cloned first: the sampling loop poses them repeatedly, and
 * handing it a displayed scene would leave that figure frozen on the last frame.
 */
const SAMPLE_FPS = 30;

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

  const targetSkin = findSkin(target);
  const sourceSkin = findSkin(source);
  const sourceByName = new Map(sourceSkin.skeleton.bones.map((b) => [b.name, b]));
  // Only bones both rigs actually have. Xbot carries two eye bones the others
  // do not; the Soldier is missing every fingertip.
  const bones = targetSkin.skeleton.bones.filter((b) => sourceByName.has(b.name));
  if (!bones.length) throw new Error(`characters: "${name}" shares no bones between rigs`);

  /* Captured BEFORE anything is posed — this is the whole correction. */
  const correction = new Map<string, THREE.Quaternion>();
  const qa = new THREE.Quaternion();
  for (const b of bones) {
    const bindTarget = b.getWorldQuaternion(new THREE.Quaternion());
    const bindSource = sourceByName.get(b.name)!.getWorldQuaternion(qa.clone());
    correction.set(b.name, bindSource.clone().invert().multiply(bindTarget));
  }

  const hipRatio = boneHeight(target, "Hips") / boneHeight(source, "Hips");
  const targetHips = bone(target, "Hips");

  const mixer = new THREE.AnimationMixer(sourceSkin);
  const action = mixer.clipAction(clip);
  action.play();

  const from = trim ? trim[0] : 0;
  const to = trim ? trim[1] : clip.duration;
  const frames = Math.max(2, Math.round((to - from) * SAMPLE_FPS));

  const times = new Float32Array(frames);
  const rotations = new Map(bones.map((b) => [b.name, new Float32Array(frames * 4)]));
  const hipTrack = new Float32Array(frames * 3);

  const qWorld = new THREE.Quaternion();
  const qParent = new THREE.Quaternion();
  const qLocal = new THREE.Quaternion();
  const vHip = new THREE.Vector3();
  const mInv = new THREE.Matrix4();
  const worldOf = new Map<string, THREE.Quaternion>();

  for (let f = 0; f < frames; f++) {
    const t = (f * (to - from)) / (frames - 1);
    mixer.setTime(from + t);
    source.updateMatrixWorld(true);
    times[f] = t;

    /* `skeleton.bones` is stored parent-before-child, so a bone's new world
       orientation is always known by the time its children need it. */
    worldOf.clear();
    for (const b of bones) {
      sourceByName.get(b.name)!.getWorldQuaternion(qWorld);
      qWorld.multiply(correction.get(b.name)!);
      worldOf.set(b.name, qWorld.clone());

      const parent = b.parent!;
      const parentWorld = worldOf.get(parent.name);
      if (parentWorld) qParent.copy(parentWorld).invert();
      else parent.getWorldQuaternion(qParent).invert();

      qLocal.copy(qParent).multiply(qWorld);
      qLocal.toArray(rotations.get(b.name)!, f * 4);
    }

    /* Only the hip gets a position track; every other bone keeps its own rest
       offset, so the target keeps its own limb lengths rather than inheriting
       the source's proportions along with its motion.

       Vertical travel is kept and scaled by the hip-height ratio; fore-aft and
       lateral drift are dropped, because the samba wanders 0.8 units over its
       length and on a figure standing on a fixed mark that reads as it sliding
       off its own shadow. */
    vHip.setFromMatrixPosition(bone(source, "Hips").matrixWorld);
    targetHips.parent!.updateMatrixWorld(true);
    vHip.applyMatrix4(mInv.copy(targetHips.parent!.matrixWorld).invert());
    vHip.x = targetHips.position.x;
    vHip.z = targetHips.position.z;
    vHip.y *= hipRatio;
    vHip.toArray(hipTrack, f * 3);
  }

  action.stop();
  mixer.uncacheClip(clip);

  const tracks: THREE.KeyframeTrack[] = bones.map(
    (b) => new THREE.QuaternionKeyframeTrack(`.bones[${b.name}].quaternion`, times, rotations.get(b.name)!)
  );
  tracks.push(new THREE.VectorKeyframeTrack(`.bones[${targetHips.name}].position`, times, hipTrack));

  return new THREE.AnimationClip(name, -1, tracks);
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
 * Repaint Xbot in the reference bot's palette.
 *
 * Sampled off ref_images/cursor_detail.jpg: the shell is near-black — the
 * darkest reads come back #101010 to #161616 — and it is glossy, throwing long
 * thin specular streaks rather than a broad soft highlight. The joints between
 * the plates read as bright polished metal, nearly white (#676c6f in shadow up
 * to #eff3f6 on the lit side). Those two make up the whole figure; the mint and
 * amber (#96dfd4 and roughly #f0a24a) sit only on the visor bar and chest
 * sigil, which are geometry this model does not have.
 *
 * The file splits the same way the reference does, so this is a swap rather
 * than a re-authoring. `asdf1:Beta_HighLimbsGeoSG2` is the outer plating —
 * 15.9k verts reaching y=1.81, so it carries the head — and `Beta_Joints_MAT`
 * is the hardware between the plates, 12.5k verts topping out at 1.59. Both
 * ship a flat salmon (0.837, 0.302, 0.264 and a browner 0.333, 0.125, 0.101),
 * which is the Mixamo default rather than anyone's choice.
 *
 * The numbers below are lifted from materials.ts, where they were tuned
 * against this same reference under this same light rig, and the reasoning
 * there still applies: the plating wants low roughness under a hard clearcoat,
 * and the joints want metalness backed off with the base colour lifted, since
 * a true mirror only reflects the dark surroundings and reads as black against
 * black.
 *
 * Matched on material name, not on mesh order — glTF makes no promise about
 * the order primitives come back in, and getting the two the wrong way round
 * would paint the head chrome and the joints black, which is a plausible
 * enough robot to go unnoticed. The count check below is there for the same
 * reason: a rename in the file would otherwise leave the figure salmon with
 * nothing said about it.
 */
function paintShell(root: THREE.Object3D) {
  const shell = new THREE.MeshPhysicalMaterial({
    color: "#0a0c10",
    metalness: 0.66,
    roughness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.85,
  });
  const joint = new THREE.MeshStandardMaterial({
    color: "#e8ecf3",
    metalness: 0.82,
    roughness: 0.24,
    envMapIntensity: 2.4,
  });

  /* One instance of each, shared across this scene's meshes but not across
     figures: `prepare` runs first and hands every mesh its own material so the
     dissolve's `onBeforeCompile` patch cannot leak between figures. These are
     built inside the call for the same reason. */
  /* Matched on the MESH name, with the material name as a fallback.
     `Beta_Joints` and `Beta_Surface` are the two meshes every Mixamo "beta" rig
     ships — Xbot and Ybot both — whereas the material names carry per-export
     junk: this file's surface material is `asdf1:Beta_HighLimbsGeoSG2`, and the
     `asdf1:` and the trailing digit are artefacts of whoever exported it, not
     anything to rely on. Testing the mesh name first is what lets the model be
     swapped for its male counterpart without touching this function. */
  let painted = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
    const id = `${m.name} ${m.material.name}`;
    if (/joint/i.test(id)) m.material = joint;
    else if (/surface|limbs/i.test(id)) m.material = shell;
    else return;
    painted += 1;
  });
  if (painted !== 2 && process.env.NODE_ENV !== "production") {
    console.warn(`[robot] repaint matched ${painted} of 2 materials`);
  }
  return root;
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

/** Yaw that turns each model to face +Z. Measured: all three already do. */
const FACING: Record<"robot" | "human" | "motion", number> = {
  robot: 0,
  human: 0,
  motion: 0,
};

/** Pick a clip out of a glTF by name, case-insensitively. */
function pick(clips: THREE.AnimationClip[], want: string) {
  const found = clips.find((c) => c.name.toLowerCase() === want.toLowerCase());
  if (!found) throw new Error(`characters: no clip "${want}" (have ${clips.map((c) => c.name).join(", ")})`);
  return found;
}

/**
 * Drop every position and scale track that never changes.
 *
 * Xbot's clips carry a full 201 tracks each: position, quaternion AND scale for
 * all 67 bones. Measured across the five clips the robot actually plays, 66 of
 * the 67 position tracks hold a single constant value that equals the bone's
 * own bind offset to within 1e-4, and all 67 scale tracks sit at exactly 1.
 * Only `mixamorigHips.position` genuinely animates — 0.58 units of bob in idle,
 * 4.83 in walk, 9.42 of root travel in run.
 *
 * So 133 of every 201 tracks re-assert, sixty times a second, values the
 * skeleton already holds. Removing them is a no-op by construction: a bone with
 * no position track keeps its bind offset, which is the number the track was
 * writing.
 *
 * It also makes the clips rig-independent, which is the part that matters if
 * this model is ever swapped for another Mixamo character (Ybot, say). Those
 * constant tracks are Xbot's PROPORTIONS baked into the animation — bone
 * lengths, shoulder width, hip width. Played on a different body they would
 * overwrite that body's own offsets and drag its skeleton into Xbot's shape
 * while its mesh stayed skinned to its own bind pose. Rotation-only clips carry
 * the performance without the performer, which is how Mixamo clips are meant to
 * travel; `mixamorigHips.position` is then the single track that needs scaling
 * by the hip-height ratio between the two rigs.
 *
 * Constant-ness is the test rather than a hardcoded bone name so this stays
 * correct for any rig. Note it keeps the moving arm and leg position tracks in
 * `sad_pose` and `sneak_pose` — neither is in the robot's vocabulary, but if
 * one is ever added it would need the same proportion check.
 */
function slimClip(clip: THREE.AnimationClip) {
  const EPS = 1e-4;
  const kept = clip.tracks.filter((t) => {
    if (!t.name.endsWith(".position") && !t.name.endsWith(".scale")) return true;
    const v = t.values;
    const stride = t.getValueSize();
    for (let i = 0; i < stride; i += 1) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = i; k < v.length; k += stride) {
        if (v[k] < lo) lo = v[k];
        if (v[k] > hi) hi = v[k];
      }
      if (hi - lo > EPS) return true;
    }
    return false;
  });
  if (kept.length === clip.tracks.length) return clip;
  const out = clip.clone();
  out.tracks = kept;
  return out;
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
export function useCharacters(): { robot: Character; human: Character } {
  const robotGltf = useGLTF(MODEL_URLS.robot) as unknown as Gltf;
  const humanGltf = useGLTF(MODEL_URLS.human) as unknown as Gltf;
  const motionGltf = useGLTF(MODEL_URLS.motion) as unknown as Gltf;
  return useMemo(
    () => build(robotGltf, humanGltf, motionGltf),
    [robotGltf, humanGltf, motionGltf]
  );
}

function build(
  robotGltf: Gltf,
  humanGltf: Gltf,
  motionGltf: Gltf
): { robot: Character; human: Character } {
  /* Oriented copies. Everything below — display, retarget source and retarget
     target alike — is built from these, so no part of the system ever sees the
     raw, differently-facing originals. Both of these rigs already face +Z, so
     the yaw is zero for both; `orient` stays because the wrapper group is what
     `relativeQuaternion` in figure.tsx stops at. */
  const robotSrc = orient(cloneSkinned(robotGltf.scene), FACING.robot);
  const humanSrc = orient(cloneSkinned(humanGltf.scene), FACING.human);
  const motionSrc = orient(cloneSkinned(motionGltf.scene), FACING.motion);

  const robotScene = paintShell(
    prepare(orient(cloneSkinned(robotGltf.scene), FACING.robot))
  );
  const humanScene = prepare(orient(cloneSkinned(humanGltf.scene), FACING.human));

  /* Every clip in the site except the dance comes out of Xbot, which is loaded
     for these five and never drawn. Y Bot ships one 0.03s T-pose. */
  const xIdle = slimClip(pick(motionGltf.animations, "idle"));
  const xWalk = slimClip(pick(motionGltf.animations, "walk"));
  const xRun = slimClip(pick(motionGltf.animations, "run"));
  const xAgree = slimClip(pick(motionGltf.animations, "agree"));
  const xShake = slimClip(pick(motionGltf.animations, "headShake"));
  const samba = pick(humanGltf.animations, "SambaDance");

  /**
   * Convert the gesture clips to additive.
   *
   * A nod is something you do WHILE standing, not instead of standing. Every
   * gesture here is a fresh clip — either a clone of the source or a retarget
   * result — so `makeClipAdditive`, which mutates in place, can never reach the
   * cached glTF's own animations.
   */
  const withAdditive = (clips: Partial<Record<ClipName, THREE.AnimationClip>>) => {
    for (const name of ADDITIVE) {
      const c = clips[name];
      if (c) clips[name] = toAdditive(c);
    }
    return clips;
  };

  const robot: Character = {
    scene: robotScene,
    skin: findSkin(robotScene),
    stance: { lo: 0, hi: 0, height: 1 },
    clips: withAdditive({
      idle: retargetOnto(robotSrc, motionSrc, xIdle, "idle"),
      walk: retargetOnto(robotSrc, motionSrc, xWalk, "walk"),
      run: retargetOnto(robotSrc, motionSrc, xRun, "run"),
      agree: retargetOnto(robotSrc, motionSrc, xAgree, "agree"),
      headShake: retargetOnto(robotSrc, motionSrc, xShake, "headShake"),
      dance: retargetOnto(robotSrc, humanSrc, samba, "dance", SAMBA_TRIM),
    }),
  };

  /* She takes her locomotion from the same Xbot captures the robot does, one
     hop rather than by way of Y Bot. */
  const human: Character = {
    scene: humanScene,
    skin: findSkin(humanScene),
    stance: { lo: 0, hi: 0, height: 1 },
    clips: withAdditive({
      idle: retargetOnto(humanSrc, motionSrc, xIdle, "idle"),
      walk: retargetOnto(humanSrc, motionSrc, xWalk, "walk"),
      run: retargetOnto(humanSrc, motionSrc, xRun, "run"),
      agree: retargetOnto(humanSrc, motionSrc, xAgree, "agree"),
      headShake: retargetOnto(humanSrc, motionSrc, xShake, "headShake"),
      // Retargeted onto herself: one pass, and it buys the same XZ-drift
      // removal the robot's copy gets, so she dances on the spot too.
      dance: retargetOnto(humanSrc, humanSrc, samba, "dance", SAMBA_TRIM),
    }),
  };

  // Measured last: it needs the idle clip, which the libraries above build.
  robot.stance = stance(robotScene, robot.clips.idle!);
  human.stance = stance(humanScene, human.clips.idle!);

  return { robot, human };
}

useGLTF.preload(MODEL_URLS.robot);
useGLTF.preload(MODEL_URLS.human);
useGLTF.preload(MODEL_URLS.motion);
