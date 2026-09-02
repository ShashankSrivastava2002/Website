"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import type { GLTFLoader } from "three-stdlib";

/**
 * Loading, and nothing else.
 *
 * This file used to be four hundred lines. It retargeted eleven clips across
 * three differently-bound Mixamo rigs in the browser, on every page load, and
 * then measured the result to work out how tall the figure had come out —
 * because until it had run, nobody knew.
 *
 * All of that now happens in `scripts/bake-characters.mjs`, once, at build
 * time. What ships is two files that already agree with each other: same six
 * clips under the same six names, same +Z facing, plain joint names, meshopt
 * compressed. So the runtime's job is to load them and hand back a clip by
 * name, which is the entire contents of this module.
 */

export const MODELS = {
  robot: "/models/robot.glb",
  human: "/models/human.glb",
} as const;

/** Every clip both files are guaranteed to carry. Enforced by the bake's verifier. */
export type ClipName = "idle" | "walk" | "run" | "dance" | "agree" | "headshake";

/**
 * Clips that are a delta on top of whatever the base layer is doing.
 *
 * A nod is a thing you do *while* standing, not instead of standing, and the
 * two gesture clips only touch the spine and arms — the bake drops their leg
 * tracks, because their source rig binds legs the opposite way up and hands
 * over a figure standing on its own head. Layered additively over a live idle
 * they read as posture; played as a base clip they would freeze everything
 * below the waist.
 */
export const ADDITIVE = new Set<ClipName>(["agree", "headshake"]);

export type Character = {
  /** An independently posable copy — two figures must not share a skeleton. */
  scene: THREE.Object3D;
  skin: THREE.SkinnedMesh;
  clips: Record<ClipName, THREE.AnimationClip>;
  /** Soles and crown in the model's own units, for fitting it to the stage. */
  stance: { lo: number; hi: number; height: number };
};

/* The compressed files need their decoder before the first byte is parsed.
   Typed against three-stdlib's GLTFLoader rather than three's own: drei
   re-exports the stdlib fork, and the two are structurally different enough
   that TypeScript rejects one where the other is expected. */
const useMeshopt = (loader: GLTFLoader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
};

function findSkin(root: THREE.Object3D): THREE.SkinnedMesh {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  if (!found) throw new Error("stage: no SkinnedMesh in model");
  return found;
}

export function bone(root: THREE.Object3D, name: string): THREE.Object3D {
  const found = root.getObjectByName(name);
  if (!found) throw new Error(`stage: no bone "${name}"`);
  return found;
}

/**
 * Prepare a clone for display.
 *
 * NO FRUSTUM CULLING is the one that bites. A skinned mesh is posed on the GPU
 * but culled on the CPU against `geometry.boundingSphere`, which describes the
 * UNSKINNED vertices in whatever space the file was authored in. These two
 * files disagree by a factor of a hundred — the robot's mesh is in centimetres,
 * the human's in metres — so the human's sphere came out ~100x too small, sat
 * nowhere near where she was drawn, and the renderer culled her every frame.
 *
 * OWN MATERIALS because the dissolve patches materials in place, and
 * `SkeletonUtils.clone` shares them with the cached glTF.
 */
function prepare(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    if (!m.material) return;
    m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
  });
  return root;
}

/**
 * How tall the figure stands while idling, measured off the BONES.
 *
 * Not off the bounding box: `computeBoundingBox` returns pre-skinning extents
 * in the file's authoring units, and these two files do not share units. Bones
 * are posed in world space by the same skinning the renderer uses, so they are
 * the only extent that means the same thing for both.
 *
 * Measured on the idle clip rather than the bind pose, and BOTH ends on it, so
 * that "scale to a common height" and "stand on a common floor" are one
 * measurement rather than two that have to agree afterwards.
 */
function stance(root: THREE.Object3D, clip: THREE.AnimationClip) {
  const skin = findSkin(root);
  const bones = skin.skeleton.bones;
  const crown = root.getObjectByName("HeadTop_End") ?? bone(root, "Head");
  const v = new THREE.Vector3();

  /* Snapshot and restore the local TRS rather than calling `skeleton.pose()`.
     `pose()` rebuilds each bone's local matrix from its bind matrix but only
     divides out the parent when the parent is ITSELF a bone — so a root bone
     hanging off a plain node gets its bind WORLD matrix written into its LOCAL
     slot, and every ancestor transform is applied twice. On the human, whose
     hips hang directly off a node carrying the 0.01 unit conversion, that wrote
     a scale of 0.01 into the hip and collapsed the whole skeleton into a
     0.003-unit ball, permanently. Saving three vectors is exact for any rig. */
  const rest = bones.map((b) => ({
    position: b.position.clone(),
    quaternion: b.quaternion.clone(),
    scale: b.scale.clone(),
  }));

  const mixer = new THREE.AnimationMixer(skin);
  mixer.clipAction(clip).play();

  let lo = Infinity;
  let hi = -Infinity;
  const SAMPLES = 24;
  for (let i = 0; i < SAMPLES; i++) {
    mixer.update(clip.duration / SAMPLES);
    root.updateMatrixWorld(true);
    for (const b of bones) lo = Math.min(lo, v.setFromMatrixPosition(b.matrixWorld).y);
    hi = Math.max(hi, v.setFromMatrixPosition(crown.matrixWorld).y);
  }

  mixer.stopAllAction();
  mixer.uncacheClip(clip);
  bones.forEach((b, i) => {
    b.position.copy(rest[i].position);
    b.quaternion.copy(rest[i].quaternion);
    b.scale.copy(rest[i].scale);
  });
  root.updateMatrixWorld(true);

  return { lo, hi, height: hi - lo };
}

function build(gltf: { scene: THREE.Object3D; animations: THREE.AnimationClip[] }): Character {
  const scene = prepare(cloneSkinned(gltf.scene));
  const clips = {} as Record<ClipName, THREE.AnimationClip>;

  for (const clip of gltf.animations) {
    // Clone: `makeClipAdditive` mutates, and the cached glTF is shared.
    const c = clip.clone();
    if (ADDITIVE.has(c.name as ClipName)) THREE.AnimationUtils.makeClipAdditive(c);
    clips[c.name as ClipName] = c;
  }

  return { scene, skin: findSkin(scene), clips, stance: stance(scene, clips.idle) };
}

export function useCharacter(url: string): Character {
  const gltf = useGLTF(url, undefined, undefined, useMeshopt) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  return useMemo(() => build(gltf), [gltf]);
}

/** Warm both files while the rest of the page is still parsing. */
export function usePreloadCharacters() {
  useEffect(() => {
    useGLTF.preload(MODELS.robot, undefined, undefined, useMeshopt);
    useGLTF.preload(MODELS.human, undefined, undefined, useMeshopt);
  }, []);
}
