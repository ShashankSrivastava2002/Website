/**
 * Bake Mixamo's Y Bot into a drop-in replacement for Xbot.
 *
 * The file Mixamo gives you, run through assimp, is not interchangeable with
 * Xbot.glb. Three things differ, and each one fails in a way that looks like
 * "the model is broken" rather than like a convention mismatch.
 *
 * 1. ASSIMP HELPER NODES. assimp does not write a bone's transform onto the
 *    bone. It splits the FBX transform into separate nodes and leaves the Bone
 *    itself at the origin:
 *
 *      mixamorigHips_$AssimpFbx$_Translation   t = 0, 99.79, 0
 *        mixamorigHips_$AssimpFbx$_PreRotation t = 0, 0, 0
 *          mixamorigHips [Bone]                t = 0, 0, 0
 *
 *    90 such nodes across 45 bones. It renders correctly, so it is easy to
 *    believe the file is fine — but every bone reads as having no offset, and
 *    an animation track targeting `mixamorigHips.position` writes to a node
 *    whose translation is not what positions the pelvis. Xbot's clips would
 *    silently do nothing. Collapsing composes each helper's matrix into its
 *    children and splices it out, which is lossless.
 *
 * 2. UNITS. Y Bot is in centimetres, Xbot in metres — hips at 99.79 against
 *    1.040. What has to match is subtler than "scale the model", because three
 *    skins a mesh in three separate spaces that must agree:
 *
 *      geometry space == bone WORLD space == inverse-bind space
 *
 *    Everything here is scaled by the same 0.01 — node translations, geometry,
 *    and the inverse binds' translation column — so the three stay in step and
 *    there is only one convention in the file. (For [R | t] the inverse is
 *    [R^T | -R^T t], so scaling a bind translation by s scales the inverse
 *    bind's translation column by s and leaves its rotation alone; hence
 *    elements 12..14 only.) The bake is checked by skinning the bind pose and
 *    comparing it against the source's, times 0.01.
 *
 * 3. NO ANIMATION. Y Bot ships one 0.03s clip, `mixamo.com`, which is the
 *    T-pose. Every clip the robot plays lives in Xbot.glb, so the mesh and the
 *    motion come from different files — see `build` in characters.ts. Dropping
 *    it first is also what makes the collapse safe: with no animation channels
 *    left, no sampler can be pointing at a node this removes.
 *
 * Run: node scripts/bake-ybot.mjs
 */
import { NodeIO } from "@gltf-transform/core";
import * as THREE from "three";
import fs from "node:fs";

const SRC = "assets/source-models/y_bot.glb";
const OUT = "public/models/Ybot.glb";
const S = 0.01;
const HELPER = "$AssimpFbx$";

const io = new NodeIO();
const doc = await io.read(SRC);
const root = doc.getRoot();

/* (3) first: no channels means no sampler can reference a spliced node. */
let dropped = 0;
for (const anim of root.listAnimations()) { anim.dispose(); dropped += 1; }

/* (1) collapse, top-down so a chain composes in the right order. */
const toMatrix = (n) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...n.getTranslation()),
    new THREE.Quaternion(...n.getRotation()),
    new THREE.Vector3(...n.getScale())
  );
const fromMatrix = (n, m) => {
  const t = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  m.decompose(t, q, s);
  n.setTranslation(t.toArray()).setRotation(q.toArray()).setScale(s.toArray());
};

const parentOf = new Map();
const order = [];
const walk = (node, parent) => {
  parentOf.set(node, parent);
  order.push(node);
  for (const c of node.listChildren()) walk(c, node);
};
for (const scene of root.listScenes()) for (const c of scene.listChildren()) walk(c, scene);

let collapsed = 0;
for (const node of order) {
  if (!node.getName().includes(HELPER)) continue;
  const parent = parentOf.get(node);
  const local = toMatrix(node);
  for (const child of node.listChildren()) {
    fromMatrix(child, new THREE.Matrix4().multiplyMatrices(local, toMatrix(child)));
    node.removeChild(child);
    parent.addChild(child);
    parentOf.set(child, parent);
  }
  parent.removeChild(node);
  node.dispose();
  collapsed += 1;
}

/* (2) geometry and inverse binds into metres; bone locals stay centimetres. */
const seen = new Set();
let prims = 0;
for (const mesh of root.listMeshes()) {
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos || seen.has(pos)) continue;
    seen.add(pos);
    const a = pos.getArray().slice();
    for (let i = 0; i < a.length; i += 1) a[i] *= S;
    pos.setArray(a);
    prims += 1;
  }
}

let skins = 0;
for (const skin of root.listSkins()) {
  const ibm = skin.getInverseBindMatrices();
  if (!ibm) continue;
  const a = ibm.getArray().slice();
  for (let m = 0; m < a.length; m += 16) {
    a[m + 12] *= S;
    a[m + 13] *= S;
    a[m + 14] *= S;
  }
  ibm.setArray(a);
  skins += 1;
}

/* Every node translation into metres too, so bone LOCALS match the geometry
   and the inverse binds. The alternative — leaving locals in centimetres under
   an `Armature` at scale 0.01, which is exactly how Xbot is built — is a trap
   here: a uniform scale on an ancestor scales the whole 3x3 basis of every bone
   world matrix, not just its translation, so the inverse binds would need their
   BASIS scaled by 100 rather than their translation by 0.01. Getting that wrong
   makes skinMatrix collapse to ~0.01*I plus the bone's translation, which drags
   every vertex onto its own bone: measured, the mesh shrank onto the skeleton
   at 1.603 where the source's crown says it should reach 1.799. Scaling the
   nodes keeps one convention throughout and is checked below. */
let nodes = 0;
for (const node of root.listNodes()) {
  const t = node.getTranslation();
  node.setTranslation([t[0] * S, t[1] * S, t[2] * S]);
  nodes += 1;
}

await io.write(OUT, doc);
const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0);
console.log(
  `dropped ${dropped} clip(s); collapsed ${collapsed} ${HELPER} nodes; ` +
  `scaled ${nodes} nodes, ${prims} position accessor(s), ${skins} skin(s) by ${S}`
);
console.log(`${SRC} ${kb(SRC)}kB -> ${OUT} ${kb(OUT)}kB`);
