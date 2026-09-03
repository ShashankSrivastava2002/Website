/**
 * Strip a clip donor down to skeleton and animation.
 *
 * Two of the four glTFs the page fetches are never drawn: Xbot supplies idle,
 * walk, run, agree and headShake, and Michelle supplies SambaDance. Between
 * them that was 5.92 MB of meshes, textures and materials downloaded so the
 * retargeter could read bone transforms off them — more than the two figures
 * the visitor actually sees.
 *
 * They cannot simply have their meshes deleted. `retargetOnto` calls
 * `findSkin(source)` and reads `skeleton.bones` off it, so the source has to
 * keep a SkinnedMesh; and the skeleton's joints are the nodes the animation
 * channels target, so those must survive too. What is genuinely dead is the
 * geometry itself. Each primitive is therefore replaced with a degenerate
 * triangle weighted entirely to joint 0 — enough to keep a skin attached to the
 * skeleton, nothing to draw — and `prune` then collects the orphaned
 * accessors, materials, textures and images.
 *
 * Correctness is not argued, it is tested: `verify-motion.mjs` retargets every
 * clip through both the full donor and the stripped one and compares the
 * resulting tracks value by value.
 *
 * Run: node scripts/bake-motion.mjs
 */
import { NodeIO } from "@gltf-transform/core";
import { prune } from "@gltf-transform/functions";
import fs from "node:fs";

const JOBS = [
  ["public/models/Xbot.glb", "public/models/Xbot.motion.glb"],
  ["public/models/Michelle.glb", "public/models/Michelle.motion.glb"],
];

const io = new NodeIO();

for (const [src, out] of JOBS) {
  const doc = await io.read(src);
  const root = doc.getRoot();
  const buffer = root.listBuffers()[0];

  const stub = (name, type, array) =>
    doc.createAccessor(name).setType(type).setArray(array).setBuffer(buffer);

  let prims = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) prim.setAttribute(semantic, null);
      prim
        .setIndices(null)
        .setMaterial(null)
        .setAttribute("POSITION", stub("stubPos", "VEC3", new Float32Array(9)))
        .setAttribute("JOINTS_0", stub("stubJoints", "VEC4", new Uint16Array(12)))
        .setAttribute("WEIGHTS_0", stub("stubWeights", "VEC4",
          new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])));
      for (const t of prim.listTargets()) prim.removeTarget(t);
      prims += 1;
    }
  }

  await doc.transform(prune());
  await io.write(out, doc);

  const mb = (p) => fs.statSync(p).size / 1048576;
  console.log(
    `${src.padEnd(28)} ${mb(src).toFixed(2)} MB -> ${out} ${mb(out).toFixed(2)} MB ` +
    `(${prims} primitive(s) stubbed, ${(100 * (1 - mb(out) / mb(src))).toFixed(1)}% smaller)`
  );
}
