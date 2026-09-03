import * as THREE from "three";

/**
 * Hair and spectacles for the human figure.
 *
 * Built in code rather than baked into the glTF because both are derived from
 * the head that is already there. The hair is a shell lifted off the model's
 * own scalp, so it fits that skull exactly and would fit a different one too;
 * the spectacles are placed off the eye bones, so they land on the eyes rather
 * than on a position measured once and hard-coded.
 *
 * Both are attached to the HEAD BONE, not to the scene. That is what makes them
 * free: a child of a bone inherits the bone's world matrix, so they follow the
 * skinned head through every clip and through the look chain without being
 * skinned themselves and without anything updating them per frame.
 *
 * Called from `prepare` in characters.ts, on the cloned display scene, while it
 * is still in its bind pose — which matters, because a glTF skinned mesh stores
 * its vertices in the same space the bones are posed in, so the raw geometry
 * IS the bind-pose position and no skinning has to be evaluated to read it.
 */

const HAIR_COLOUR = "#141013";
const FRAME_COLOUR = "#1b1d22";

/** Lift of the hair shell off the scalp, as a fraction of head height. */
const HAIR_THICKNESS = 0.098;
/**
 * Where the hairline sits between the eyes and the crown. 0 would put hair down
 * to the eyebrows, 1 would leave a bald man with a fringe at the very top.
 */
const HAIRLINE = 0.42;

function findBone(scene: THREE.Object3D, name: string) {
  return (
    scene.getObjectByName(`mixamorig${name}`) ??
    scene.getObjectByName(`mixamorig:${name}`) ??
    scene.getObjectByName(name)
  );
}

/**
 * A shell over the top of the head, from `HAIRLINE` up.
 *
 * The scalp is selected by height, then a triangle is kept only if ALL THREE of
 * its vertices are in the selection. Keeping triangles with any vertex in it
 * would drag a fringe of stretched faces down over the forehead and ears, since
 * those triangles reach back to vertices that were deliberately excluded.
 *
 * Each kept vertex is pushed out along its own normal, which is what turns a
 * surface lying exactly on the skull into a layer sitting above it. A uniform
 * scale about the head centre is the obvious alternative and is wrong: it moves
 * the crown much further than the sides, so the hair floats at the top and
 * intersects the skull at the temples.
 *
 * Both sides are drawn (`DoubleSide`) because the shell is an open surface —
 * from below, at the hairline, you would otherwise see straight through it.
 */
function shellPatch(
  source: THREE.Mesh,
  bone: THREE.Object3D,
  wanted: (position: THREE.Vector3, normal: THREE.Vector3) => boolean,
  lift: number,
  material: THREE.Material,
  name: string
) {
  const geometry = source.geometry;
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const index = geometry.index;
  if (!position || !normal || !index) return null;

  const keep = new Uint8Array(position.count);
  {
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      p.fromBufferAttribute(position, i);
      n.fromBufferAttribute(normal, i);
      if (wanted(p, n)) keep[i] = 1;
    }
  }

  const remap = new Int32Array(position.count).fill(-1);
  const verts: number[] = [];
  const norms: number[] = [];
  const tris: number[] = [];
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  /* Into the bone's frame, so the mesh can simply be parented to it. */
  const toHead = new THREE.Matrix4().copy(bone.matrixWorld).invert();
  const toHeadNormal = new THREE.Matrix3().setFromMatrix4(toHead);

  const add = (i: number) => {
    if (remap[i] !== -1) return remap[i];
    v.fromBufferAttribute(position, i);
    n.fromBufferAttribute(normal, i).normalize();
    v.addScaledVector(n, lift).applyMatrix4(toHead);
    n.applyMatrix3(toHeadNormal).normalize();
    const id = verts.length / 3;
    verts.push(v.x, v.y, v.z);
    norms.push(n.x, n.y, n.z);
    remap[i] = id;
    return id;
  };

  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t);
    const b = index.getX(t + 1);
    const c = index.getX(t + 2);
    if (!keep[a] || !keep[b] || !keep[c]) continue;
    tris.push(add(a), add(b), add(c));
  }
  if (!tris.length) return null;

  const patch = new THREE.BufferGeometry();
  patch.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  patch.setAttribute("normal", new THREE.Float32BufferAttribute(norms, 3));
  patch.setIndex(tris);

  const mesh = new THREE.Mesh(patch, material);
  mesh.name = name;
  return mesh;
}

/** The hair shell: everything above the hairline, lifted off the scalp. */
function makeHair(head: THREE.SkinnedMesh, headBone: THREE.Object3D, eyeY: number) {
  const box = new THREE.Box3().setFromBufferAttribute(
    head.geometry.attributes.position as THREE.BufferAttribute
  );
  const cut = eyeY + (box.max.y - eyeY) * HAIRLINE;
  return shellPatch(
    head,
    headBone,
    (p) => p.y >= cut,
    (box.max.y - box.min.y) * HAIR_THICKNESS,
    new THREE.MeshStandardMaterial({
      color: HAIR_COLOUR,
      roughness: 0.62,
      metalness: 0.05,
      side: THREE.DoubleSide,
      name: "Hair",
    }),
    "Hair"
  );
}

/**
 * Spectacles, sized and placed off the two eye bones.
 *
 * Everything here is a multiple of the eye separation, so the frames fit
 * whatever head they are given rather than a head they were measured on once.
 * The lenses are rounded rectangles rather than circles — a torus reads as
 * joke glasses at this scale — swept as a tube along a rounded-rect curve.
 *
 * The lens fill is a real mesh with low opacity rather than nothing, because
 * empty frames over a dark face lose the glasses entirely at small sizes; a
 * faint fill gives the specular hit that says "there is glass here".
 */
function makeSpectacles(headBone: THREE.Object3D, left: THREE.Vector3, right: THREE.Vector3) {
  const group = new THREE.Group();
  group.name = "Spectacles";

  const span = left.distanceTo(right);
  /* Wide and shallow with a small corner radius: the reference frames are
     rectangular, and a rounder lens reads as a different person. */
  const lensW = span * 0.98;
  const lensH = span * 0.58;
  const radius = span * 0.05;
  const corner = span * 0.11;

  const frame = new THREE.MeshStandardMaterial({
    color: FRAME_COLOUR,
    roughness: 0.34,
    metalness: 0.45,
    name: "SpectacleFrame",
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#9fb4c8",
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.14,
    transmission: 0,
    name: "SpectacleLens",
  });
  /* Opted out of the dissolve's transparency toggle — see setDissolveActive. */
  glass.userData.alwaysTransparent = true;

  const rounded = (w: number, h: number, r: number) => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -h / 2);
    s.lineTo(w / 2 - r, -h / 2);
    s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    s.lineTo(w / 2, h / 2 - r);
    s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    s.lineTo(-w / 2 + r, h / 2);
    s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    s.lineTo(-w / 2, -h / 2 + r);
    s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return s;
  };

  const forward = span * 0.42;
  for (const side of [-1, 1]) {
    const centre = new THREE.Vector3(side * span * 0.5, 0, forward);

    const path = new THREE.CatmullRomCurve3(
      rounded(lensW, lensH, corner)
        .getSpacedPoints(48)
        .map((p) => new THREE.Vector3(p.x + centre.x, p.y, centre.z)),
      true
    );
    const rim = new THREE.Mesh(new THREE.TubeGeometry(path, 72, radius, 8, true), frame);
    group.add(rim);

    const fill = new THREE.Mesh(new THREE.ShapeGeometry(rounded(lensW, lensH, corner)), glass);
    fill.position.copy(centre);
    group.add(fill);
  }

  /* Bridge across the nose, and a temple down each side to the ear. */
  const bridge = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.7, radius * 0.7, span * 0.5, 8),
    frame
  );
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, lensH * 0.16, forward);
  group.add(bridge);

  for (const side of [-1, 1]) {
    const temple = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, span * 1.5, 8),
      frame
    );
    temple.rotation.x = Math.PI / 2;
    temple.position.set(side * (span * 0.5 + lensW * 0.42), lensH * 0.2, forward - span * 0.75);
    group.add(temple);
  }

  const mid = left.clone().add(right).multiplyScalar(0.5);
  group.position.copy(mid.applyMatrix4(new THREE.Matrix4().copy(headBone.matrixWorld).invert()));
  return group;
}

/**
 * Add hair and spectacles to `scene`, if it has the bones to hang them on.
 *
 * Returns quietly when it does not — the robot has no eye bones and no scalp,
 * and calling this on every figure is simpler than remembering which one it is
 * for.
 */
export function addFeatures(scene: THREE.Object3D) {
  const headBone = findBone(scene, "Head");
  const leftEye = findBone(scene, "LeftEye");
  const rightEye = findBone(scene, "RightEye");
  if (!headBone || !leftEye || !rightEye) return scene;

  scene.updateMatrixWorld(true);

  let head: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && /head/i.test(m.name)) head = m;
  });

  const l = new THREE.Vector3().setFromMatrixPosition(leftEye.matrixWorld);
  const r = new THREE.Vector3().setFromMatrixPosition(rightEye.matrixWorld);

  if (head) {
    const hair = makeHair(head, headBone, (l.y + r.y) / 2);
    if (hair) headBone.add(hair);
  }
  headBone.add(makeSpectacles(headBone, l, r));

  /* `prepare` has already run and does not see these, so they get the same
     treatment here. Frustum culling off for the same reason it is off for the
     skinned meshes: these hang off a BONE, so their bounding sphere is the
     rest-pose one and says nothing about where the head actually is. */
  headBone.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
  });

  return scene;
}

/* ------------------------------------------------------------------ */

/**
 * The robot's face and body detail.
 *
 * Y Bot is a Mixamo mannequin: two materials, no face, nothing on the chest.
 * The reference bot is the opposite — its whole character is in a handful of
 * small, bright details on an otherwise black shell: a mint visor across the
 * brow, a disc over each ear, a mint sigil on the chest, and a few amber marks.
 * Those are what the eye reads at the size this renders at; the plating behind
 * them is just dark.
 *
 * The VISOR is a shell patch, the same construction as the hair, and that is
 * the point of doing it this way: a bar modelled as its own primitive has to be
 * bent to match the skull and will float somewhere or sink in somewhere,
 * whereas a patch lifted off the head's own surface follows whatever curve the
 * head actually has. It is selected by height and by facing — a vertex is in
 * the visor if it sits in the brow band AND its normal points forwards — so it
 * wraps around the temples exactly as far as the head does and stops.
 *
 * Everything else is a primitive, placed off the measured head and chest
 * extents rather than off numbers typed in: the discs sit on the head's own
 * half-width, the sigil on the front of the chest.
 *
 * Emissive materials are `toneMapped: false` with intensity well above 1, which
 * is what gets them over the bloom threshold in index.tsx (1.15) while the
 * chrome's specular highlights stay under it. That threshold is why the visor
 * reads as lit rather than as bright paint.
 */

const VISOR_COLOUR = "#3fe4d8";
const AMBER_COLOUR = "#ff7a1a";

/** Where the visor band sits within the head's height, bottom and top. */
const VISOR_BAND: [number, number] = [0.52, 0.66];
/** How far forward a face has to point to be part of the visor. */
const VISOR_FACING = 0.22;

function emissive(colour: string, intensity: number) {
  return new THREE.MeshStandardMaterial({
    color: colour,
    emissive: colour,
    emissiveIntensity: intensity,
    toneMapped: false,
    name: `RobotGlow ${colour}`,
  });
}

/** A ring lying in the XY plane, for the ear discs and the chest sigil. */
function ring(radius: number, tube: number, sides: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, sides), material);
}

export function addRobotFeatures(scene: THREE.Object3D) {
  const headBone = findBone(scene, "Head");
  const chestBone = findBone(scene, "Spine2");
  if (!headBone || !chestBone) return scene;

  scene.updateMatrixWorld(true);

  /* The shell to cut the visor out of: the outer plating, not the joints. */
  let shell: THREE.SkinnedMesh | null = null;
  scene.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    if (!shell || m.geometry.attributes.position.count > shell.geometry.attributes.position.count) {
      shell = m;
    }
  });
  if (!shell) return scene;
  const plating = shell as THREE.SkinnedMesh;

  /* Head extents, measured off the vertices the head bone actually drives, so
     the neck and shoulders cannot drag the box down. */
  const headBox = new THREE.Box3();
  {
    const skeleton = plating.skeleton;
    const headIndex = skeleton.bones.findIndex((b) => b === headBone);
    const position = plating.geometry.attributes.position;
    const joints = plating.geometry.attributes.skinIndex;
    const weights = plating.geometry.attributes.skinWeight;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      let w = 0;
      for (let k = 0; k < 4; k += 1) {
        if (joints.getComponent(i, k) === headIndex) w += weights.getComponent(i, k);
      }
      if (w > 0.6) headBox.expandByPoint(v.fromBufferAttribute(position, i).clone());
    }
  }
  if (headBox.isEmpty()) return scene;

  const headSize = new THREE.Vector3();
  headBox.getSize(headSize);
  const lift = headSize.y * 0.012;

  const visorMaterial = emissive(VISOR_COLOUR, 3.2);
  const amberMaterial = emissive(AMBER_COLOUR, 2.0);

  /* Bind-pose world into the head bone's own frame. Doing this with the bone's
     inverse matrix rather than by subtracting the head BOX's corner: the box is
     the shape of the head, the bone is the origin everything hangs off, and
     they are 7.5cm apart here. Subtracting the box put the ear discs and the
     amber marks down at the jaw instead of on the visor line. */
  const toHead = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
  const local = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y, z).applyMatrix4(toHead);

  const lo = headBox.min.y + headSize.y * VISOR_BAND[0];
  const hi = headBox.min.y + headSize.y * VISOR_BAND[1];
  const visor = shellPatch(
    plating,
    headBone,
    (p, n) => p.y >= lo && p.y <= hi && n.z > VISOR_FACING,
    lift,
    visorMaterial,
    "Visor"
  );
  if (visor) headBone.add(visor);

  /* Amber brackets at each end of the visor band, where it wraps the temple. */
  const bandY = (lo + hi) / 2;
  for (const side of [-1, 1]) {
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(headSize.x * 0.035, (hi - lo) * 0.8, headSize.z * 0.035),
      amberMaterial
    );
    bracket.position.copy(local(side * headSize.x * 0.30, bandY, headBox.max.z * 0.82));
    headBone.add(bracket);
  }

  /* A disc over each ear: a chrome plate with a bright ring standing off it. */
  const discRadius = headSize.y * 0.125;
  const chrome = new THREE.MeshStandardMaterial({
    color: "#e8ecf3",
    metalness: 0.82,
    roughness: 0.24,
    name: "RobotChrome",
  });
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(discRadius, discRadius * 0.92, headSize.x * 0.06, 20),
      chrome
    );
    plate.rotation.z = Math.PI / 2;
    ear.add(plate);
    const glow = ring(discRadius * 0.52, discRadius * 0.075, 20, visorMaterial);
    glow.rotation.y = Math.PI / 2;
    glow.position.x = side * headSize.x * 0.04;
    ear.add(glow);
    ear.position.copy(local(side * (headSize.x / 2 - headSize.x * 0.04), bandY, headBox.max.z * 0.06));
    ear.name = "Ear";
    headBone.add(ear);
  }

  /* The chest sigil, on the front of the plating the chest bone drives. */
  const chestBox = new THREE.Box3();
  {
    const skeleton = plating.skeleton;
    const chestIndex = skeleton.bones.findIndex((b) => b === chestBone);
    const position = plating.geometry.attributes.position;
    const joints = plating.geometry.attributes.skinIndex;
    const weights = plating.geometry.attributes.skinWeight;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 1) {
      let w = 0;
      for (let k = 0; k < 4; k += 1) {
        if (joints.getComponent(i, k) === chestIndex) w += weights.getComponent(i, k);
      }
      if (w > 0.6) chestBox.expandByPoint(v.fromBufferAttribute(position, i).clone());
    }
  }
  if (!chestBox.isEmpty()) {
    const chestSize = new THREE.Vector3();
    chestBox.getSize(chestSize);
    const radius = chestSize.x * 0.2;
    const sigil = ring(radius, chestSize.x * 0.024, 6, visorMaterial);
    sigil.rotation.z = Math.PI / 6;

    /* Depth is PROBED, not guessed from the bounding box. The chest is a curved
       plate: a flat ring placed at `max.z` has its centre standing proud and
       its lower edge buried, because the surface falls away below the sternum.
       Measured with the box, two thirds of the hexagon vanished into the torso.
       Taking the front-most vertex anywhere the ring will actually cover, and
       clearing THAT, is the difference between a sigil and a chevron. */
    const midY = chestBox.min.y + chestSize.y * 0.34;
    let front = chestBox.max.z;
    {
      const position = plating.geometry.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < position.count; i += 1) {
        v.fromBufferAttribute(position, i);
        if (Math.abs(v.y - midY) > radius * 1.2) continue;
        if (Math.abs(v.x) > radius * 1.2) continue;
        if (v.z > front) front = v.z;
      }
    }
    const centre = new THREE.Vector3(0, midY, front + chestSize.z * 0.04);
    sigil.position.copy(centre.applyMatrix4(new THREE.Matrix4().copy(chestBone.matrixWorld).invert()));
    sigil.name = "ChestSigil";
    chestBone.add(sigil);
  }

  /* One amber mark on each forearm, which is where the reference puts its only
     warm accent below the head. */
  for (const side of ["Left", "Right"] as const) {
    const forearm = findBone(scene, `${side}ForeArm`);
    const hand = findBone(scene, `${side}Hand`);
    if (!forearm || !hand) continue;
    const length = new THREE.Vector3()
      .setFromMatrixPosition(hand.matrixWorld)
      .distanceTo(new THREE.Vector3().setFromMatrixPosition(forearm.matrixWorld));
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(length * 0.34, length * 0.055, length * 0.055),
      amberMaterial
    );
    /* Placed in the figure's frame, then taken into the bone's — the arm bones
       run along their own local axis and that axis is not the same one on both
       sides. */
    const world = new THREE.Vector3()
      .setFromMatrixPosition(forearm.matrixWorld)
      .lerp(new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld), 0.55);
    world.z += length * 0.12;
    mark.position.copy(world.applyMatrix4(new THREE.Matrix4().copy(forearm.matrixWorld).invert()));
    mark.quaternion.copy(forearm.getWorldQuaternion(new THREE.Quaternion()).invert());
    mark.name = "ForearmMark";
    forearm.add(mark);
  }

  scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
  });

  return scene;
}
