/**
 * Prove a stripped clip donor is interchangeable with the file it came from.
 *
 * `bake-motion.mjs` throws away every donor's geometry, materials and textures.
 * What `retargetOnto` actually consumes is narrower than that: it needs a
 * SkinnedMesh to exist (it calls `findSkin` on the source), and it samples each
 * bone's WORLD transform frame by frame while a mixer plays the clip. So the
 * invariant to check is not "the files match" but "every bone lands in exactly
 * the same place at every frame, and a skin is still findable".
 *
 * That is stricter than comparing retarget output, and it holds for any clip,
 * any target rig, and any future change to the retargeter.
 *
 * Run: node scripts/verify-motion.mjs
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import fs from "node:fs";

globalThis.self = globalThis;

const PAIRS = [
  ["public/models/Xbot.glb", "public/models/Xbot.motion.glb"],
  ["public/models/Michelle.glb", "public/models/Michelle.motion.glb"],
];
const FPS = 30;

/* Bone POSITIONS must match exactly — anything else means the skeleton moved.
   Rotations are allowed 1e-2 rad (0.57 deg). gltf-transform re-writes each
   node's rotation on save and the round trip is not bit-exact, which shows up
   as up to 1.04e-3 rad of static bind-pose difference concentrated on the
   smallest bones — thumbs, fingertips, toe tips. Carried all the way through
   `retargetOnto` that is worth at most 0.33 deg of output, on Michelle's
   LeftToe_End, with the hip position track exactly unchanged. A toe bone is
   ~5cm, so 0.33 deg moves its tip about a third of a millimetre. */
const TOL_POS = 0;
const TOL_ROT = 1e-2;

const load = (p) =>
  new Promise((res, rej) => {
    const b = fs.readFileSync(p);
    new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", res, rej);
  });

const skinOf = (scene) => {
  let found = null;
  scene.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    const n = o.geometry.attributes.position?.count ?? 0;
    if (!found || n > found.n) found = { mesh: o, n };
  });
  return found;
};

let failed = 0;

for (const [fullPath, stripPath] of PAIRS) {
  const full = await load(fullPath);
  const strip = await load(stripPath);

  const fs_ = skinOf(full.scene);
  const ss = skinOf(strip.scene);
  if (!ss) {
    console.log(`FAIL ${stripPath}: no SkinnedMesh — findSkin would throw`);
    failed += 1;
    continue;
  }

  const bonesOf = (scene) => {
    const m = new Map();
    scene.traverse((o) => {
      if (o.isBone) m.set(o.name, o);
    });
    return m;
  };
  const bf = bonesOf(full.scene);
  const bs = bonesOf(strip.scene);
  const missing = [...bf.keys()].filter((n) => !bs.has(n));

  const names = full.animations.map((a) => a.name);
  const stripNames = strip.animations.map((a) => a.name);
  const lostClips = names.filter((n) => !stripNames.includes(n));

  let worstPos = 0;
  let worstRot = 0;
  let worstAt = "";

  for (const clip of full.animations) {
    const other = strip.animations.find((a) => a.name === clip.name);
    if (!other) continue;
    const mA = new THREE.AnimationMixer(full.scene);
    const mB = new THREE.AnimationMixer(strip.scene);
    mA.clipAction(clip).play();
    mB.clipAction(other).play();

    const frames = Math.max(2, Math.round(clip.duration * FPS));
    const pA = new THREE.Vector3();
    const pB = new THREE.Vector3();
    const qA = new THREE.Quaternion();
    const qB = new THREE.Quaternion();

    for (let f = 0; f < frames; f += 1) {
      const t = (f * clip.duration) / (frames - 1);
      mA.setTime(t);
      mB.setTime(t);
      full.scene.updateMatrixWorld(true);
      strip.scene.updateMatrixWorld(true);
      for (const [name, boneA] of bf) {
        const boneB = bs.get(name);
        if (!boneB) continue;
        boneA.matrixWorld.decompose(pA, qA, new THREE.Vector3());
        boneB.matrixWorld.decompose(pB, qB, new THREE.Vector3());
        const dp = pA.distanceTo(pB);
        const dq = 2 * Math.acos(Math.min(1, Math.abs(qA.dot(qB))));
        if (dp > worstPos) {
          worstPos = dp;
          worstAt = `${clip.name}/${name}@f${f}`;
        }
        if (dq > worstRot) worstRot = dq;
      }
    }
    mA.stopAllAction();
    mB.stopAllAction();
  }

  const ok = !missing.length && !lostClips.length && worstPos <= TOL_POS && worstRot <= TOL_ROT;
  if (!ok) failed += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${stripPath}\n` +
    `     skin ${ss.mesh.name} (${ss.n} verts, was ${fs_.n})` +
    ` | bones ${bs.size}/${bf.size}${missing.length ? ` MISSING ${missing.join(",")}` : ""}` +
    ` | clips ${stripNames.length}/${names.length}${lostClips.length ? ` LOST ${lostClips.join(",")}` : ""}\n` +
    `     max bone world drift: position ${worstPos.toExponential(2)} m,` +
    ` rotation ${worstRot.toExponential(2)} rad (${((worstRot * 180) / Math.PI).toFixed(3)} deg)` +
    `  ${worstAt ? `worst-position-at ${worstAt}` : ""}`
  );
}

process.exit(failed ? 1 : 0);
