/**
 * Bake the Ready Player Me avatar into the male human, "Michael".
 *
 * He replaces Michelle as the figure that is DRAWN. Michelle stays loaded as a
 * clip donor, because `SambaDance` is hers and the like reaction is built from
 * it — the same split the robot already has, where Y Bot is the body and Xbot
 * is the motion.
 *
 * Unlike the Y Bot download this file needs almost nothing done to it. Measured
 * against Michelle, it already agrees on every convention that matters:
 *
 *                  units    faces   thigh local +Y    hips     crown
 *   Michelle       metres    +Z     0.07,-1.00,0.02   1.026    1.586
 *   Ready Player   metres    +Z     0.07,-1.00,-0.01  1.019    1.865
 *
 * Same handedness at the hip, so no half-turn correction of the kind Xbot and
 * Y Bot needed between them, and no centimetre/metre mismatch.
 *
 * The one incompatibility is naming. Its bones are `Hips`, `LeftUpLeg`, `Head`;
 * every other rig in the project is `mixamorigHips` (the colon in the glTF's
 * `mixamorig:Hips` is stripped by `PropertyBinding.sanitizeNodeName`, which is
 * why the runtime spelling has no colon). `retargetOnto` pairs source and
 * target bones by exact name and would find nothing in common, throwing
 * "shares no bones between rigs"; `bone()` only tries the two mixamorig
 * spellings and would throw on the first lookup. Renaming here rather than
 * teaching the runtime a third spelling keeps one convention in the codebase.
 *
 * Everything under the root joint is renamed, not just the skin's joint list —
 * `HeadTop_End` is a leaf that nothing is skinned to, so it is not a joint, but
 * `stance()` measures the crown with it and would not find it otherwise.
 *
 * Run: node scripts/bake-michael.mjs
 */
import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";
import fs from "node:fs";

const SRC = "assets/source-models/readyplayer.me.glb";
const OUT = "public/models/Michael.glb";
const PREFIX = "mixamorig";

const io = new NodeIO();
const doc = await io.read(SRC);
const root = doc.getRoot();

/* The root joint: the joint that is not a descendant of any other joint. */
const joints = new Set();
for (const skin of root.listSkins()) for (const j of skin.listJoints()) joints.add(j);
if (!joints.size) throw new Error("bake-michael: no skin joints");

const childOfJoint = new Set();
for (const j of joints) for (const c of j.listChildren()) childOfJoint.add(c);
const roots = [...joints].filter((j) => !childOfJoint.has(j));
if (roots.length !== 1) {
  throw new Error(`bake-michael: expected one root joint, found ${roots.length}`);
}

let renamed = 0;
let skipped = 0;
const rename = (node) => {
  const name = node.getName();
  if (name.startsWith(PREFIX)) skipped += 1;
  else {
    node.setName(PREFIX + name);
    renamed += 1;
  }
  for (const c of node.listChildren()) rename(c);
};
rename(roots[0]);

await io.write(OUT, doc);
const kb = (p) => (fs.statSync(p).size / 1024).toFixed(0);
console.log(`root joint: ${roots[0].getName()}`);
console.log(`renamed ${renamed} node(s) under it, ${skipped} already prefixed`);
console.log(`${SRC} ${kb(SRC)}kB -> ${OUT} ${kb(OUT)}kB`);

/* ------------------------------------------------------------------ */

/**
 * Stage two: swing the A-pose arms out into a T-pose.
 *
 * This is the part that matters, and it is invisible until the figure moves.
 * Ready Player Me binds its avatars in an A-POSE — arms down at roughly 60
 * degrees — while every other rig in this project is bound in a T-pose.
 * Measured as the angle between each bone's direction-to-child here and in
 * Xbot's bind:
 *
 *   legs, spine, neck, head     at most   9.2 deg   (the same pose)
 *   arms                        up to    59.8 deg   (a different pose)
 *   fingers                     up to   103.2 deg   (relaxed vs splayed)
 *
 * `retargetOnto` corrects for rigs bound differently by mapping bind to bind,
 * which is right when the difference is one of AXIS CONVENTION — Xbot's thigh
 * axis points up where Y Bot's points down, and that correction is what stops
 * the samba landing feet-above-head. It is wrong when the difference is one of
 * POSE. Source-at-bind maps to target-at-bind, so Xbot standing in a T-pose
 * puts Michael in his A-pose, and Xbot's idle — about 76 degrees down from his
 * own T-pose — then rotates Michael a further 76 degrees down from an A-pose
 * already hanging at 60. Measured on the retargeted idle, upper-arm direction:
 *
 *   source (Xbot)      0.23, -0.97,  0.00
 *   Y Bot              0.23, -0.97,  0.00     matches
 *   Michelle           0.21, -0.98,  0.00     matches
 *   Michael           -0.57, -0.65, -0.51     down, backwards, across the body
 *
 * Hence the palms-up, splayed hands and the bunched sleeves.
 *
 * WHAT NOT TO DO: give each bone Xbot's bind world orientation outright. That
 * conflates the two differences in the other direction — a bone's pose is the
 * direction to its child, and its convention is the roll about that direction,
 * and RPM extends its bones along a different local axis than Xbot. Tried and
 * measured: Michael's upper arm came out pointing 0.00,1.00,0.00, straight up,
 * and the retargeted idle went from 60 degrees of error to 95.
 *
 * So only the SWING is corrected — the minimal rotation taking each bone's
 * direction-to-child onto Xbot's — and the twist is left alone. Michael keeps
 * his own bone lengths and his own axis conventions, and `retargetOnto`'s
 * correction term is left to do what it is good at.
 *
 * Only the two arm chains are touched. The legs and spine already agree to
 * within 9.2 degrees, which is the same order Michelle differs by and she was
 * never a problem. The fingers are deliberately NOT straightened: leaving them
 * relaxed in bind means Xbot's small finger movements land as small deviations
 * from a natural hand rather than from a splayed one.
 *
 * Re-binding a skinned mesh is four edits, and skipping any one detaches the
 * mesh from the skeleton:
 *   - each bone's local rotation, so its new world direction is the target's
 *   - the geometry, re-skinned through the OLD inverse binds into the new pose
 *   - the normals, by the same per-vertex skin matrix
 *   - the inverse binds, recomputed as the inverse of the new bone worlds
 *
 * Morph targets are dropped: Ready Player Me ships ARKit face blendshapes whose
 * deltas are expressed in the old bind space, nothing in this project drives
 * them, and re-binding would leave them subtly wrong for no benefit.
 */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";

globalThis.self = globalThis;

const REFERENCE = "public/models/Xbot.glb";
/* Shoulder before arm before forearm: each correction is measured after its
   ancestors have already moved. */
const CHAIN = [
  "mixamorigLeftShoulder", "mixamorigLeftArm", "mixamorigLeftForeArm",
  "mixamorigRightShoulder", "mixamorigRightArm", "mixamorigRightForeArm",
];

const reference = await new Promise((res, rej) => {
  const b = fs.readFileSync(REFERENCE);
  new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", res, rej);
});
reference.scene.updateMatrixWorld(true);

/** Xbot's bind direction from `name` to `child`, in world space. */
function referenceDirection(name, child) {
  const a = reference.scene.getObjectByName(name);
  const b = reference.scene.getObjectByName(child);
  if (!a || !b) return null;
  return new THREE.Vector3()
    .setFromMatrixPosition(b.matrixWorld)
    .sub(new THREE.Vector3().setFromMatrixPosition(a.matrixWorld))
    .normalize();
}

/* Re-read what stage one wrote, so the two stages stay independent. */
const doc2 = await io.read(OUT);
const root2 = doc2.getRoot();

const parent = new Map();
const order = [];
{
  const walk = (n, p) => {
    parent.set(n, p);
    order.push(n);
    for (const c of n.listChildren()) walk(c, n);
  };
  for (const scene of root2.listScenes()) for (const c of scene.listChildren()) walk(c, null);
}
const byName = new Map(order.map((n) => [n.getName(), n]));

const localMatrix = (n) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(...n.getTranslation()),
    new THREE.Quaternion(...n.getRotation()),
    new THREE.Vector3(...n.getScale())
  );

/** World matrices for the current state, in hierarchy order. */
function worlds() {
  const out = new Map();
  for (const n of order) {
    const p = parent.get(n);
    out.set(n, p ? new THREE.Matrix4().multiplyMatrices(out.get(p), localMatrix(n)) : localMatrix(n));
  }
  return out;
}

const before = worlds();
const originalSkin = new Map();
for (const skin of root2.listSkins()) {
  const ibm = skin.getInverseBindMatrices().getArray();
  skin.listJoints().forEach((j, i) => {
    const inv = new THREE.Matrix4().fromArray(Array.from(ibm.slice(i * 16, i * 16 + 16)));
    originalSkin.set(j, new THREE.Matrix4().copy(inv));
  });
}

let swung = 0;
const report = [];
for (const name of CHAIN) {
  const node = byName.get(name);
  if (!node) throw new Error(`bake-michael: no bone "${name}"`);
  const kids = node.listChildren();
  if (kids.length !== 1) {
    throw new Error(`bake-michael: "${name}" has ${kids.length} children, expected 1`);
  }
  const child = kids[0];
  const want = referenceDirection(name, child.getName());
  if (!want) throw new Error(`bake-michael: reference has no "${name}" -> "${child.getName()}"`);

  const now = worlds();
  const have = new THREE.Vector3()
    .setFromMatrixPosition(now.get(child))
    .sub(new THREE.Vector3().setFromMatrixPosition(now.get(node)))
    .normalize();

  const swing = new THREE.Quaternion().setFromUnitVectors(have, want);
  const deg = THREE.MathUtils.radToDeg(2 * Math.acos(Math.min(1, Math.abs(swing.w))));

  /* Apply in world, then re-express in the parent's frame. */
  const parentQuat = new THREE.Quaternion();
  const p = parent.get(node);
  if (p) now.get(p).decompose(new THREE.Vector3(), parentQuat, new THREE.Vector3());
  const worldQuat = new THREE.Quaternion();
  now.get(node).decompose(new THREE.Vector3(), worldQuat, new THREE.Vector3());
  const nextWorld = swing.clone().multiply(worldQuat);
  node.setRotation(parentQuat.clone().invert().multiply(nextWorld).toArray());

  report.push(`${name.replace("mixamorig", "")} ${deg.toFixed(1)}deg`);
  swung += 1;
}

const after = worlds();

/* Re-skin the geometry through the OLD inverse binds and the NEW bone worlds. */
let reskinned = 0;
let targets = 0;
for (const skin of root2.listSkins()) {
  const joints = skin.listJoints();
  const skinMat = joints.map(
    (j) => new THREE.Matrix4().multiplyMatrices(after.get(j), originalSkin.get(j))
  );

  for (const mesh of root2.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const nrm = prim.getAttribute("NORMAL");
      const jnt = prim.getAttribute("JOINTS_0");
      const wgt = prim.getAttribute("WEIGHTS_0");
      if (!pos || !jnt || !wgt) continue;

      const P = pos.getArray().slice();
      const N = nrm ? nrm.getArray().slice() : null;
      const J = jnt.getArray();
      const W = wgt.getArray();
      const v = new THREE.Vector3();
      const acc = new THREE.Vector3();
      const nv = new THREE.Vector3();
      const nacc = new THREE.Vector3();
      const m3 = new THREE.Matrix3();

      for (let i = 0; i < pos.getCount(); i += 1) {
        acc.set(0, 0, 0);
        nacc.set(0, 0, 0);
        for (let k = 0; k < 4; k += 1) {
          const w = W[i * 4 + k];
          if (!w) continue;
          const m = skinMat[J[i * 4 + k]];
          if (!m) continue;
          v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(m);
          acc.addScaledVector(v, w);
          if (N) {
            nv.set(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]).applyMatrix3(m3.setFromMatrix4(m));
            nacc.addScaledVector(nv, w);
          }
        }
        P[i * 3] = acc.x;
        P[i * 3 + 1] = acc.y;
        P[i * 3 + 2] = acc.z;
        if (N) {
          nacc.normalize();
          N[i * 3] = nacc.x;
          N[i * 3 + 1] = nacc.y;
          N[i * 3 + 2] = nacc.z;
        }
      }
      pos.setArray(P);
      if (N) nrm.setArray(N);
      for (const t of prim.listTargets()) {
        prim.removeTarget(t);
        targets += 1;
      }
      reskinned += 1;
    }
  }

  /* New inverse binds: the inverse of where each bone now sits. */
  const out = new Float32Array(joints.length * 16);
  joints.forEach((j, i) => {
    new THREE.Matrix4().copy(after.get(j)).invert().toArray(out, i * 16);
  });
  skin.getInverseBindMatrices().setArray(out);
}

/* The dropped morph targets leave their accessors orphaned in the buffer.
   Scoped to exactly those two property types on purpose: an unrestricted
   `prune()` also runs `keepSolidTextures: false`, which folded the beard's and
   the body's base-colour maps down into flat `baseColorFactor` values. That is
   a legitimate optimisation when a texture really is one solid colour, but it
   is an asset-wide visual decision made silently to save 68 kB, and this bake
   has no business making it. */
await doc2.transform(prune({ propertyTypes: ["PrimitiveTarget", "Accessor"] }));

await io.write(OUT, doc2);
console.log(`swung ${swung} bone(s) into the reference pose: ${report.join(", ")}`);
console.log(`re-skinned ${reskinned} primitive(s), dropped ${targets} morph target(s)`);
console.log(`${OUT} ${kb(OUT)}kB`);

/* ------------------------------------------------------------------ */

/**
 * Stage three: complexion, outfit, and losing the hat.
 *
 * The Ready Player Me avatar arrives pale, in a mauve jacket, tan trousers and
 * a wide-brimmed hat. What is wanted is a South Asian complexion and something
 * funkier to wear, with the head left visible so it can have hair.
 *
 * Every one of these is a base-colour map, so the whole change is a recolour of
 * five JPEGs and the deletion of one mesh — no geometry, no material swaps.
 *
 * SKIN is a per-channel gain rather than a hue rotation. Skin is not one hue
 * with a lightness; it is a warm ramp, and rotating it lands somewhere plastic.
 * Scaling the channels apart preserves every bit of the painted detail — the
 * brows, the lip line, the shading around the nose — while moving the whole
 * ramp: the map's average goes from #ac7971 to roughly #8a503e.
 *
 * The OUTFIT is hue and saturation, which is the right tool there, because
 * these maps are one garment colour plus printed detail and rotating the hue
 * carries the print along with it. The jacket's pink flower and green leaves
 * survive as a flower and leaves, in new colours.
 *
 * The HAT goes. Its mesh is deleted rather than hidden, which also drops the
 * 234 kB texture that comes with it — the largest single image in the file.
 */
import sharp from "sharp";

/**
 * How each base-colour map is rewritten.
 *
 * `gain` is a per-channel multiply, for skin. `regions` is a hue-selective
 * remap, for cloth.
 *
 * The reason cloth needs regions and not a single rotation: the jacket map is
 * ONE image holding the coat, the waistcoat and the shirt, and the reference is
 * an olive jacket over a rust shirt — two different hues that a global rotation
 * cannot separate. Measured on the source texture, they fall into clean
 * clusters and can be addressed independently:
 *
 *   hue   0-45    43%   the coat body
 *   hue 290-360   37%   waistcoat and shirt
 *   hue  70-150    3%   the printed leaves
 *
 * Within a region the hue is REPLACED but saturation and value are SCALED, by
 * the ratio between the target and that region's own mean. That is what keeps
 * the weave, the shading and the seams: a flat fill would give the right colour
 * and a garment that looks like a paper cut-out.
 */
const RECOLOUR = {
  /* Sampled off the reference photograph rather than picked: the cheek and
     forehead there average #946c58 — hue 20 deg, saturation 0.41 — against the
     map's own #ac7971. These gains land it on that.
     
     The first pass at this crushed green and blue much harder ([0.80, 0.66,
     0.55]) and came out at saturation 0.55, hue 14 — noticeably redder and more
     orange than the photograph. Skin reads wrong long before it reads dark, and
     it was the SATURATION that was wrong, not the lightness. */
  Wolf3D_Skin: { gain: [0.86, 0.83, 0.74], gamma: 1.0 },
  Wolf3D_Body: { gain: [0.86, 0.83, 0.74], gamma: 1.0 },
  /* Near-black hair and beard against the darker skin. */
  Wolf3D_Beard: { gain: [0.42, 0.40, 0.40], gamma: 1 },

  Wolf3D_Outfit_Top: {
    regions: [
      /* The coat, to a dark olive bomber. */
      { from: [0, 45], hue: 88, saturation: 0.30, value: 0.31 },
      /* Waistcoat and shirt, to rust. */
      { from: [290, 360], hue: 14, saturation: 0.5, value: 0.46 },
      /* The printed leaves and flower, absorbed INTO the jacket rather than
         given a colour of their own. Two earlier attempts got this wrong in
         opposite directions: letting the print keep its own hue left vivid
         orange patches on the upper arms, and sweeping it into the shirt colour
         left the same patches in rust. The reference has two garments, so the
         print has to become one of them, and the sleeve it sits on is olive. */
      { from: [45, 290], hue: 88, saturation: 0.30, value: 0.31 },
    ],
    /* Near-grey pixels have no meaningful hue to sort on, so they are assigned
       explicitly. These are the cuffs, and in the reference the shirt cuff is
       what shows below the jacket sleeve — so they belong to region 1. */
    achromaticBelow: 0.12,
    achromaticRegion: 1,
    /* The printed flower, which no hue rule can separate: it is pink, sitting
       in the same 290-360 band as the shirt, so sorting by colour sent it to
       rust and left two orange blooms across the upper arms. It is a PLACE, not
       a colour — read off the source map, it occupies x 0.12-0.50, y 0.60-1.0,
       on UV that belongs to the jacket sleeve. So it is assigned by place. */
    rects: [{ x: [0.12, 0.5], y: [0.6, 1.0], region: 0 }],
  },
  Wolf3D_Outfit_Bottom: {
    regions: [{ from: [0, 360], hue: 220, saturation: 0.10, value: 0.26 }],
  },
  Wolf3D_Outfit_Footwear: {
    regions: [{ from: [0, 360], hue: 34, saturation: 0.28, value: 0.62 }],
  },
};

/** RGB 0..255 to HSV, hue in degrees. */
function toHsv(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx / 255];
}

function toRgb(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

const inRegion = (h, [lo, hi]) => (lo <= hi ? h >= lo && h < hi : h >= lo || h < hi);

/**
 * Apply a `regions` recipe to a raw RGB buffer, in place.
 *
 * Two passes: the first measures each region's mean saturation and value on
 * this actual texture, the second rewrites. Measuring rather than assuming is
 * what makes the scale factors mean something — "take this region to a mean
 * value of 0.31" rather than "multiply it by 0.6 and hope".
 */
function applyRegions(data, recipe, width, height) {
  const pick = (h, s, i) => {
    if (recipe.rects) {
      const px = (i / 3) % width;
      const py = Math.floor(i / 3 / width);
      for (const r of recipe.rects) {
        const u = px / width;
        const v = py / height;
        if (u >= r.x[0] && u < r.x[1] && v >= r.y[0] && v < r.y[1]) return r.region;
      }
    }
    if (recipe.achromaticBelow !== undefined && s < recipe.achromaticBelow) {
      return recipe.achromaticRegion;
    }
    for (let k = 0; k < recipe.regions.length; k += 1) {
      if (inRegion(h, recipe.regions[k].from)) return k;
    }
    return -1;
  };

  const stats = recipe.regions.map(() => ({ s: 0, v: 0, n: 0 }));
  for (let i = 0; i < data.length; i += 3) {
    const [h, s, v] = toHsv(data[i], data[i + 1], data[i + 2]);
    const k = pick(h, s, i);
    if (k < 0) continue;
    stats[k].s += s;
    stats[k].v += v;
    stats[k].n += 1;
  }
  const scale = recipe.regions.map((r, k) => ({
    v: stats[k].n ? r.value / (stats[k].v / stats[k].n) : 1,
  }));
  recipe.regions.forEach((r, k) => {
    stats[k].meanS = stats[k].n ? stats[k].s / stats[k].n : r.saturation;
  });

  for (let i = 0; i < data.length; i += 3) {
    const [h, s, v] = toHsv(data[i], data[i + 1], data[i + 2]);
    const k = pick(h, s, i);
    if (k < 0) continue;
    const region = recipe.regions[k];
    /* Saturation moves ADDITIVELY around the target, value multiplicatively.
       Scaling saturation by target/mean the way value is scaled looks right
       until a region's mean is low, and then every already-saturated pixel in
       it multiplies past 1 and clips — which is what turned the print on the
       sleeves into flat vivid orange. Value wants the ratio, because that is
       what preserves the shading and the weave. */
    const out = toRgb(
      region.hue,
      Math.min(1, Math.max(0, region.saturation + (s - stats[k].meanS) * 0.7)),
      Math.min(1, v * scale[k].v)
    );
    data[i] = out[0];
    data[i + 1] = out[1];
    data[i + 2] = out[2];
  }
}

const doc3 = await io.read(OUT);
const root3 = doc3.getRoot();

/* The hat goes first, so its material and texture are already orphaned by the
   time the recolour loop runs and never get re-encoded. Disposing the material
   explicitly rather than leaving it to `prune`: prune walks materials before
   textures in a single pass, so a material orphaned in that same pass keeps its
   texture alive until a second run. */
let hatMeshes = 0;
for (const node of root3.listNodes()) {
  const mesh = node.getMesh();
  if (!mesh) continue;
  if (!/Headwear/i.test(mesh.getName()) && !/Headwear/i.test(node.getName())) continue;
  for (const prim of mesh.listPrimitives()) {
    const material = prim.getMaterial();
    const texture = material?.getBaseColorTexture();
    material?.dispose();
    texture?.dispose();
  }
  node.dispose();
  mesh.dispose();
  hatMeshes += 1;
}

/**
 * Cut the moustache down.
 *
 * The avatar's is 96 mm across on a 160 mm head — 60% of the face width, and it
 * droops. The reference has a neat one. The mesh is scaled about its own
 * centroid rather than through the node transform, because a skinned mesh's
 * node transform is ignored by the skinning: the vertices are what has to move.
 *
 * Kept rather than deleted. The face underneath has no stubble painted on it,
 * so removing it outright leaves a clean-shaven man, and the reference is not.
 */
const MOUSTACHE_SCALE = [0.66, 0.58, 0.9];
let moustache = 0;
for (const mesh of root3.listMeshes()) {
  if (!/Beard/i.test(mesh.getName())) continue;
  for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute("POSITION");
    if (!pos) continue;
    const a = pos.getArray().slice();
    const centre = [0, 0, 0];
    for (let i = 0; i < a.length; i += 3) {
      centre[0] += a[i];
      centre[1] += a[i + 1];
      centre[2] += a[i + 2];
    }
    const n = a.length / 3;
    centre[0] /= n;
    centre[1] /= n;
    centre[2] /= n;
    for (let i = 0; i < a.length; i += 3) {
      for (let k = 0; k < 3; k += 1) {
        a[i + k] = centre[k] + (a[i + k] - centre[k]) * MOUSTACHE_SCALE[k];
      }
    }
    pos.setArray(a);
    moustache += 1;
  }
}

let recoloured = 0;
for (const material of root3.listMaterials()) {
  const recipe = RECOLOUR[material.getName()];
  const texture = material.getBaseColorTexture();
  if (!recipe || !texture) continue;

  let out;
  if (recipe.gain) {
    /* `linear` is per-channel `a * x + b`, applied before the gamma. */
    out = await sharp(Buffer.from(texture.getImage()))
      .linear(recipe.gain, [0, 0, 0])
      .gamma(recipe.gamma ?? 1)
      .jpeg({ quality: 88 })
      .toBuffer();
  } else {
    const { data, info } = await sharp(Buffer.from(texture.getImage()))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    applyRegions(data, recipe, info.width, info.height);
    out = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 3 },
    })
      .jpeg({ quality: 88 })
      .toBuffer();
  }
  texture.setImage(out).setMimeType("image/jpeg");
  recoloured += 1;
}

await doc3.transform(prune({ propertyTypes: ["Material", "Texture", "Accessor"] }));

/**
 * Trim the tailcoat down to a bomber.
 *
 * The reference jacket stops at the belt; this one has tails to mid-thigh.
 * Triangles below the hip are dropped from the jacket mesh — every vertex of a
 * triangle has to be below the line, so the hem is left where the geometry
 * already had an edge rather than sliced through the middle of faces.
 *
 * Doing it on the BIND POSE is what makes a plain height test safe. This model
 * is bound in a T-pose (stage two), so the arms are horizontal and the cuffs
 * sit at shoulder height; the same cut on a figure with its arms down would
 * take the sleeves off at the wrist along with the tails.
 */
const HIPS_TRIM = "mixamorigHips";
let trimmed = 0;
{
  const hips = root3.listNodes().find((n) => n.getName() === HIPS_TRIM);
  for (const mesh of root3.listMeshes()) {
    if (!/Outfit_Top/i.test(mesh.getName())) continue;
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const idx = prim.getIndices();
      if (!pos || !idx || !hips) continue;
      /* The hip height, read off the node chain rather than assumed. */
      let hipY = 0;
      for (let n = hips; n; n = root3.listNodes().find((p) => p.listChildren().includes(n))) {
        hipY += n.getTranslation()[1];
      }
      const y = (i) => pos.getElement(i, [0, 0, 0])[1];
      const keep = [];
      const src = idx.getArray();
      for (let t = 0; t < src.length; t += 3) {
        if (y(src[t]) < hipY && y(src[t + 1]) < hipY && y(src[t + 2]) < hipY) {
          trimmed += 1;
          continue;
        }
        keep.push(src[t], src[t + 1], src[t + 2]);
      }
      idx.setArray(new Uint32Array(keep));
    }
  }
}

await io.write(OUT, doc3);
console.log(
  `recoloured ${recoloured} base-colour map(s); removed ${hatMeshes} headwear mesh(es); ` +
  `trimmed ${trimmed} coat-tail triangle(s); shrank ${moustache} moustache primitive(s)`
);
console.log(`${OUT} ${kb(OUT)}kB`);
