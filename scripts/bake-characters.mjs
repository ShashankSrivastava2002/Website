/**
 * Build step: bake every clip onto every figure, once, offline.
 *
 * The previous version of this site did its retargeting in the browser, on
 * every page load: eleven `SkeletonUtils.retargetClip` calls across three
 * differently-bound Mixamo rigs, plus a stance measurement, before the first
 * frame could be drawn. That is where essentially every animation bug came
 * from — a source argument that had to be a Skeleton and not a scene, a `names`
 * map whose absence silently matched no bones at all, a hip-height ratio that
 * divided by a bone the loader had renamed, a facing correction that had to
 * happen before retargeting rather than after, and retargeted clips that carry
 * no scale tracks and so could never undo a `skeleton.pose()` that had written
 * a 0.01 into one.
 *
 * None of that is possible if the clips arrive already on the right skeleton.
 * So this script does the retargeting once, at build time, and writes two
 * self-contained files:
 *
 *   public/models/robot.glb   Soldier  + idle walk run dance agree headshake
 *   public/models/human.glb   Michelle + idle walk run dance agree headshake
 *
 * Both are baked facing +Z, both use plain joint names, and both expose the
 * same six clips under the same six names. The runtime's entire job becomes
 * `useGLTF(url)` and `clips.find(c => c.name === want)`.
 *
 *   node scripts/bake-characters.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned, retargetClip } from "three/examples/jsm/utils/SkeletonUtils.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, meshopt, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";
import sharp from "sharp";

/* -- Node shims so GLTFLoader.parse runs headless ------------------------- */
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
globalThis.URL.createObjectURL = () => "blob:stub";
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElementNS: () => ({ style: {}, setAttribute() {}, getContext: () => ({}) }),
  createElement: () => ({ style: {}, setAttribute() {}, getContext: () => ({}) }),
};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
/* Sources live OUTSIDE public/. They are build-time inputs — 8.4 MB of
   uncompressed Mixamo rigs that nothing at runtime loads — and anything under
   public/ is served verbatim to every visitor. The two files the site actually
   downloads are written to public/models/ below. */
const SRC = path.join(ROOT, "assets", "source-models");
const OUT = path.join(ROOT, "public", "models");

function loadGltf(file) {
  const buf = fs.readFileSync(path.join(SRC, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((res, rej) => new GLTFLoader().parse(ab, "", res, rej));
}

/* -- rig helpers ---------------------------------------------------------- */

/** Mixamo bone, whichever spelling survived the loader's name sanitiser. */
const bone = (root, short) =>
  root.getObjectByName(`mixamorig${short}`) ?? root.getObjectByName(`mixamorig:${short}`);

const findSkin = (root) => {
  let found = null;
  root.traverse((o) => {
    if (!found && o.isSkinnedMesh) found = o;
  });
  if (!found) throw new Error("no SkinnedMesh");
  return found;
};

const hipHeight = (root) => {
  root.updateMatrixWorld(true);
  return new THREE.Vector3().setFromMatrixPosition(bone(root, "Hips").matrixWorld).y;
};

/**
 * Identity rename map over the bones the two skeletons share.
 *
 * `only` narrows it further, and the gestures below need that. `retarget`
 * copies each source bone's WORLD orientation onto the target, which is what
 * makes it indifferent to how the two rigs were bound — but it also means a
 * source whose bind pose points a bone the other way hands the target a bone
 * pointing the other way. Xbot does exactly that. Measured, the world direction
 * of `LeftUpLeg`'s local +Y in each bind pose:
 *
 *   Soldier    (0.00, -1.00,  0.00)     thigh points down
 *   Michelle   (0.07, -1.00,  0.02)     down
 *   Xbot       (0.00,  1.00,  0.00)     UP
 *
 * So every clip retargeted off Xbot arrived with its legs rotated a full half
 * turn: the Soldier's feet sampled at y=1.83 against a head at 1.55, standing
 * on his own scalp. It never showed on the old site because those clips were
 * immediately made additive, and subtracting frame 0 cancels a constant 180
 * degrees exactly — the figure looked right for the entire life of a bug that
 * was in every frame of it.
 *
 * Restricting the two gestures to the upper body is the fix rather than a
 * workaround: a nod has nothing to say about knees, and a clip that stays
 * silent about them lets the target keep its own.
 */
function sharedBoneNames(target, source) {
  const src = new Set(findSkin(source).skeleton.bones.map((b) => b.name));
  const out = {};
  for (const b of findSkin(target).skeleton.bones) if (src.has(b.name)) out[b.name] = b.name;
  return out;
}

/** Spine up. What a nod or a head shake is allowed to touch. */
const UPPER_BODY = [
  "Spine", "Spine1", "Spine2", "Neck", "Head",
  "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand",
  "RightShoulder", "RightArm", "RightForeArm", "RightHand",
];

/**
 * Face a model along +Z before anything reads its world matrices.
 *
 * Soldier faces -Z and Michelle +Z; their glTF roots carry opposite quarter
 * turns about x. `retargetClip` re-expresses each SOURCE bone's world matrix in
 * the TARGET's local frame, so the target inherits the source's world facing —
 * which means this has to happen before retargeting, not at display time, or
 * native and retargeted clips end up facing opposite ways on the same figure.
 */
function orient(scene, yaw) {
  const g = new THREE.Group();
  g.rotation.y = yaw;
  g.add(scene);
  g.updateMatrixWorld(true);
  return g;
}

const FACING = { soldier: Math.PI, michelle: 0, xbot: 0 };

function retargetOnto(targetRoot, sourceRoot, clip, name, trim, only) {
  /* `only` is applied to the OUTPUT, not to `names`, and that distinction is
     the whole thing. Narrowing `names` looks like it should make `retargetClip`
     ignore a bone, but the two functions disagree about the fallback:
     `retarget`'s `getBoneName` is `options.names[bone.name]` with none, while
     `retargetClip`'s is `getBoneName(...) || bone.name`. So a bone left out of
     the map is still WRITTEN to the output clip — recording not the source's
     motion but whatever `target.skeleton.pose()` left the bone at, which for a
     root bone under a non-bone parent is its bind world matrix in a local slot.
     Restricting the map therefore does not drop the legs, it replaces them with
     garbage: the Soldier came out 0.656 units tall instead of 1.83. Retarget
     everything, then throw away the tracks that were never wanted. */
  const target = cloneSkinned(targetRoot);
  const source = cloneSkinned(sourceRoot);
  target.updateMatrixWorld(true);
  source.updateMatrixWorld(true);

  const out = retargetClip(findSkin(target), findSkin(source).skeleton, clip, {
    hip: bone(target, "Hips").name,
    scale: hipHeight(target) / hipHeight(source),
    names: sharedBoneNames(target, source, only),
    // Keep the hip's vertical travel, drop its fore-aft and lateral drift: the
    // samba wanders 0.8 units, which on a figure standing on a fixed mark reads
    // as it sliding off the page.
    hipInfluence: new THREE.Vector3(0, 1, 0),
    ...(trim ? { trim } : {}),
  });
  out.name = name;

  if (only) {
    const keep = new Set(only.flatMap((n) => [`mixamorig${n}`, `mixamorig:${n}`]));
    out.tracks = out.tracks.filter((t) => keep.has(parseTrack(t.name)?.bone ?? ""));
    out.resetDuration();
  }
  return out;
}

/**
 * The stretch of `SambaDance` used as the like reaction.
 *
 * Scored on motion as well as loop closure. Picking purely for closure — the
 * pose distance between the window's two ends — lands on [0.45, 4.85], which is
 * the best-closing window in the clip and also, measured over every 4.4s window,
 * the 26th most energetic of 28: the quietest passage is the easiest to loop, so
 * that criterion optimises straight into the flattest part of the dance. This
 * window carries 26% more motion for 0.035 rad/bone more gap, which the 0.45s
 * crossfade back to idle absorbs without showing.
 */
const SAMBA_TRIM = [13.02, 16.83];

/* -- three.js clip -> glTF animation -------------------------------------- */

/** `.bones[mixamorigHips].quaternion` and `mixamorigHips.quaternion` alike. */
function parseTrack(name) {
  const m = /^(?:\.bones\[)?([^\]\.]+)\]?\.(\w+)$/.exec(name);
  if (!m) throw new Error(`unparseable track name: ${name}`);
  const PATH = { quaternion: "rotation", position: "translation", scale: "scale" };
  const target = PATH[m[2]];
  return target ? { bone: m[1], target } : null;
}

/**
 * Write a THREE.AnimationClip into a glTF Document as a named animation.
 *
 * glTF targets nodes by INDEX, so the only thing that has to line up is the
 * bone-name lookup — which is why this resolves against the sanitised spelling
 * three uses in track names (`mixamorigHips`) rather than the spelling in the
 * file (`mixamorig:Hips`).
 */
function writeClip(doc, buffer, nodeByName, clip) {
  const anim = doc.createAnimation(clip.name);
  let written = 0;

  for (const track of clip.tracks) {
    const parsed = parseTrack(track.name);
    if (!parsed) continue;
    const node = nodeByName.get(parsed.bone);
    if (!node) continue;

    const size = parsed.target === "rotation" ? 4 : 3;
    const type = parsed.target === "rotation" ? "VEC4" : "VEC3";

    const input = doc
      .createAccessor(`${clip.name}_${parsed.bone}_t`)
      .setArray(new Float32Array(track.times))
      .setType("SCALAR")
      .setBuffer(buffer);

    const output = doc
      .createAccessor(`${clip.name}_${parsed.bone}_v`)
      .setArray(new Float32Array(track.values))
      .setType(type)
      .setBuffer(buffer);

    if (output.getCount() !== input.getCount())
      throw new Error(`${clip.name}/${parsed.bone}: ${output.getCount()} values vs ${input.getCount()} times (stride ${size})`);

    const sampler = doc
      .createAnimationSampler()
      .setInput(input)
      .setOutput(output)
      .setInterpolation("LINEAR");

    anim.addSampler(sampler);
    anim.addChannel(
      doc.createAnimationChannel().setSampler(sampler).setTargetNode(node).setTargetPath(parsed.target)
    );
    written++;
  }

  if (!written) throw new Error(`clip "${clip.name}" bound to no nodes`);
  return written;
}

/* -- writing one figure --------------------------------------------------- */

const q = new THREE.Quaternion();
const v = new THREE.Vector3();

/**
 * Bake the facing correction into the file instead of the scene graph.
 *
 * At runtime the correction was a wrapper Group; here it is folded into each
 * root node's own transform. For a node whose world transform is T*R*S, an
 * outer rotation Q gives (Q*T) * (Q*R) * S — exact for the uniform scales these
 * files use, and it means nothing downstream has to know the models were ever
 * pointing different ways.
 */
function bakeFacing(doc, yaw) {
  if (!yaw) return;
  q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  for (const scene of doc.getRoot().listScenes()) {
    for (const node of scene.listChildren()) {
      const r = new THREE.Quaternion().fromArray(node.getRotation());
      node.setRotation(r.premultiply(q).toArray());
      node.setTranslation(v.fromArray(node.getTranslation()).applyQuaternion(q).toArray());
    }
  }
}

async function bake({ file, out, yaw, clips }) {
  /* The encoder has to reach the IO, not just the `meshopt()` transform.
     `EXT_meshopt_compression` encodes at WRITE time and pulls its encoder out of
     the IO's dependency map, so registering the extensions alone gets you all
     the way to a finished document and then a `Cannot read properties of
     undefined (reading 'encodeFilterExp')` from inside `writeBinary`. */
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(path.join(SRC, file));
  const root = doc.getRoot();

  // The source clips are dead weight now — every clip this figure needs is
  // rebuilt below, including the ones it already owned.
  for (const a of root.listAnimations()) a.dispose();

  const buffer = root.listBuffers()[0] ?? doc.createBuffer();

  /* Joints keep their Mixamo names in the file (`mixamorig:Hips`) but three
     strips the colon when it loads them, because `[ ] . : /` are reserved by
     the animation-binding syntax. That mismatch is what once produced a
     `scale: 0` from a hip-height ratio over two bones that "did not exist".
     Renaming here means the loaded name and the file name are finally the same
     string, and the runtime needs no dual-spelling lookup at all. */
  const nodeByName = new Map();
  for (const node of root.listNodes()) {
    const name = node.getName();
    if (!name) continue;
    nodeByName.set(name.replace(/[\[\]\.:\/]/g, ""), node);
  }

  let channels = 0;
  for (const clip of clips) channels += writeClip(doc, buffer, nodeByName, clip);

  // Plain joint names, now that nothing resolves by the Mixamo spelling.
  for (const node of root.listNodes()) {
    const n = node.getName();
    if (n?.startsWith("mixamorig")) node.setName(n.replace(/^mixamorig:?/, ""));
  }

  bakeFacing(doc, yaw);

  /* Compression, and it is not a nicety here: measured before this ran, the two
     files were 2.49 and 3.61 MB, of which textures were only 0.66 and 0.72 —
     the weight is vertex and animation data, so shrinking images alone would
     have bought almost nothing. Meshopt quantises and encodes exactly that, and
     it is what the runtime pays for with one `setMeshoptDecoder` call. */
  await MeshoptEncoder.ready;
  const before = doc
    .getRoot()
    .listAccessors()
    .reduce((n, a) => n + a.getArray().byteLength, 0);

  await doc.transform(
    dedup(),
    prune({ keepAttributes: false }),
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: 88 }),
    meshopt({ encoder: MeshoptEncoder, level: "high" })
  );

  const dest = path.join(OUT, out);
  await io.write(dest, doc);
  const mb = (fs.statSync(dest).size / 1e6).toFixed(2);
  console.log(
    `  ${out.padEnd(11)} ${mb.padStart(5)} MB  ${clips.length} clips, ${channels} channels, ` +
      `${(before / 1e6).toFixed(2)} MB of vertex+anim data in\n` +
      `              [${clips.map((c) => `${c.name} ${c.duration.toFixed(2)}s`).join(", ")}]`
  );
}

/* -- main ----------------------------------------------------------------- */

/* Clear the outputs first. A failure anywhere below used to leave the previous
   build sitting on disk, and the verifier would then happily pass a file that
   the run which was supposed to produce it had crashed before writing. */
fs.mkdirSync(OUT, { recursive: true });
for (const stale of ["robot.glb", "human.glb"]) {
  const f = path.join(OUT, stale);
  if (fs.existsSync(f)) fs.rmSync(f);
}

const soldier = await loadGltf("Soldier.glb");
const michelle = await loadGltf("Michelle.glb");
const xbot = await loadGltf("Xbot.glb");

const pick = (gltf, name) => {
  const c = gltf.animations.find((a) => a.name.toLowerCase() === name.toLowerCase());
  if (!c) throw new Error(`no clip "${name}" (have ${gltf.animations.map((a) => a.name).join(", ")})`);
  return c;
};

const soldierRig = orient(cloneSkinned(soldier.scene), FACING.soldier);
const michelleRig = orient(cloneSkinned(michelle.scene), FACING.michelle);
const xbotRig = orient(cloneSkinned(xbot.scene), FACING.xbot);

const sIdle = pick(soldier, "Idle");
const sWalk = pick(soldier, "Walk");
const sRun = pick(soldier, "Run");
const mSamba = pick(michelle, "SambaDance");
const xAgree = pick(xbot, "agree");
const xShake = pick(xbot, "headShake");

/* Both figures end up with the same six clips under the same six names. The
   Soldier owns locomotion and no gestures; Michelle owns the dance and nothing
   else usable; Xbot owns the two gestures. Each borrows what it lacks — and
   after this runs, neither file remembers that it borrowed anything. */
const rename = (clip, name) => {
  const c = clip.clone();
  c.name = name;
  return c;
};

console.log("baking characters\n");

await bake({
  file: "Soldier.glb",
  out: "robot.glb",
  yaw: FACING.soldier,
  clips: [
    rename(sIdle, "idle"),
    rename(sWalk, "walk"),
    rename(sRun, "run"),
    retargetOnto(soldierRig, michelleRig, mSamba, "dance", SAMBA_TRIM),
    retargetOnto(soldierRig, xbotRig, xAgree, "agree", null, UPPER_BODY),
    retargetOnto(soldierRig, xbotRig, xShake, "headshake", null, UPPER_BODY),
  ],
});

await bake({
  file: "Michelle.glb",
  out: "human.glb",
  yaw: FACING.michelle,
  clips: [
    retargetOnto(michelleRig, soldierRig, sIdle, "idle"),
    retargetOnto(michelleRig, soldierRig, sWalk, "walk"),
    retargetOnto(michelleRig, soldierRig, sRun, "run"),
    // Retargeted onto herself: one bake, and she gets the same XZ-drift removal
    // the robot's copy gets, so she dances on the spot too.
    retargetOnto(michelleRig, michelleRig, mSamba, "dance", SAMBA_TRIM),
    retargetOnto(michelleRig, xbotRig, xAgree, "agree", null, UPPER_BODY),
    retargetOnto(michelleRig, xbotRig, xShake, "headshake", null, UPPER_BODY),
  ],
});

console.log("\ndone.");
