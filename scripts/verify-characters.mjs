/**
 * Check the baked files the way the runtime will use them: load, play each
 * clip, and measure. Anything this catches is something the site would have
 * shown a visitor.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
globalThis.URL.createObjectURL = () => "blob:stub";
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElementNS: () => ({ style: {}, setAttribute() {}, getContext: () => ({}) }),
  createElement: () => ({ style: {}, setAttribute() {}, getContext: () => ({}) }),
};
/* The baked textures are WebP, and GLTFLoader feature-detects that by decoding
   a one-pixel data URI in an <img> and checking it came back 1px tall. Headless
   there is no <img>, so answer yes: nothing here reads a pixel anyway. */
globalThis.Image = class {
  set src(_v) {
    this.width = 1;
    this.height = 1;
    setTimeout(() => this.onload?.(), 0);
  }
};

const SRC = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), "public", "models");
/* The shipped files are meshopt-encoded, so the check has to read them the same
   way the browser will — decoder and all. Verifying the uncompressed
   intermediate instead would test a file nobody ever downloads. */
const load = async (f) => {
  const b = fs.readFileSync(path.join(SRC, f));
  const loader = new GLTFLoader().setMeshoptDecoder(await MeshoptDecoder.ready.then(() => MeshoptDecoder));
  return new Promise((res, rej) =>
    loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", res, rej)
  );
};

const WANT = ["idle", "walk", "run", "dance", "agree", "headshake"];
let bad = 0;
const fail = (m) => { console.log(`    FAIL  ${m}`); bad++; };

for (const file of ["robot.glb", "human.glb"]) {
  const g = await load(file);
  const scene = g.scene;
  scene.updateMatrixWorld(true);
  console.log(`\n${file}  (${(fs.statSync(path.join(SRC, file)).size / 1e6).toFixed(2)} MB)`);

  let skin = null;
  scene.traverse((o) => { if (!skin && o.isSkinnedMesh) skin = o; });
  const B = (n) => scene.getObjectByName(n);

  // 1. plain joint names, no mixamorig anywhere
  const stale = [];
  scene.traverse((o) => { if (o.name.startsWith("mixamorig")) stale.push(o.name); });
  console.log(`  joints ${skin.skeleton.bones.length}   names: ${stale.length ? `FAIL ${stale.length} still prefixed` : "plain"}`);
  if (stale.length) fail("mixamorig prefix survived");

  // 2. every clip present, under the agreed name
  const have = g.animations.map((a) => a.name);
  const missing = WANT.filter((w) => !have.includes(w));
  console.log(`  clips  ${have.join(" ")}${missing.length ? `   MISSING ${missing.join(",")}` : ""}`);
  if (missing.length) fail(`missing clips: ${missing.join(",")}`);

  // 3. baked facing: +Z is toward the viewer. Measure heel -> toe.
  const heel = new THREE.Vector3().setFromMatrixPosition(B("LeftFoot").matrixWorld);
  const toe = new THREE.Vector3().setFromMatrixPosition(B("LeftToeBase").matrixWorld);
  const fwd = toe.sub(heel).normalize();
  console.log(`  facing heel->toe z=${fwd.z.toFixed(3)} ${fwd.z > 0.3 ? "(+Z, toward camera) ok" : "WRONG WAY"}`);
  if (fwd.z <= 0.3) fail(`faces the wrong way (z=${fwd.z.toFixed(3)})`);

  // 4. each clip actually moves the figure, and nobody collapses
  for (const name of have) {
    const clip = g.animations.find((a) => a.name === name);
    const mixer = new THREE.AnimationMixer(skin);
    mixer.clipAction(clip).play();
    const box = new THREE.Box3();
    const hand = new THREE.Box3();
    const p = new THREE.Vector3();
    let minScale = Infinity;
    for (let i = 0; i < 60; i++) {
      mixer.update(clip.duration / 60);
      scene.updateMatrixWorld(true);
      for (const b of skin.skeleton.bones) box.expandByPoint(p.setFromMatrixPosition(b.matrixWorld));
      hand.expandByPoint(p.setFromMatrixPosition(B("LeftHand").matrixWorld));
      minScale = Math.min(minScale, B("Hips").scale.x);
    }
    const size = new THREE.Vector3(); box.getSize(size);
    const travel = new THREE.Vector3(); hand.getSize(travel);
    const h = size.y;
    const ok = h > 1.2 && h < 2.4 && minScale > 0.9;
    console.log(
      `    ${name.padEnd(10)} ${clip.duration.toFixed(2)}s  height ${h.toFixed(3)}  hand travel ${travel.length().toFixed(3)}  hipScale ${minScale.toFixed(3)} ${ok ? "" : "  <-- BAD"}`
    );
    if (!ok) fail(`${name}: height ${h.toFixed(3)}, hip scale ${minScale.toFixed(3)}`);
    mixer.uncacheClip(clip);
  }
}
console.log(bad ? `\n${bad} FAILURES` : "\nall checks passed");
process.exit(bad ? 1 : 0);
