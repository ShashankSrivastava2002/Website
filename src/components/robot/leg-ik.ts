import * as THREE from "three";

/**
 * Foot IK, and the weight shift it makes possible.
 *
 * Rotating the pelvis does not make the legs do anything. Both legs hang off
 * `Hips`, so a hip yaw turns the entire lower body as one rigid piece — the
 * feet swing with it, nothing bends, nothing takes weight. Turning the hips
 * harder just slides the figure around on its own shadow. That is the wall the
 * previous versions of this kept hitting: there is no amount of hip rotation
 * that reads as "the legs moved".
 *
 * What makes legs move is a DISAGREEMENT between the pelvis and the feet. Pin
 * the feet where the clip put them, then move the pelvis somewhere else, and
 * the knees and hips have to bend to span the difference. That difference is
 * the whole effect, and resolving it is what two-bone IK is for.
 *
 * So each frame:
 *
 *   1. capture where the clip put each foot, in world space
 *   2. let the look chain yaw the pelvis, and shift it sideways toward the cursor
 *   3. solve each leg back onto its captured foot
 *
 * The feet are not pinned rigidly — `pivot` lets them follow a fraction of the
 * pelvis yaw, so at the extremes they turn a few degrees rather than staying
 * welded to the floor, which is what the reference recording does.
 */

/* ------------------------------------------------------------------ */

export type Leg = {
  upLeg: THREE.Object3D;
  leg: THREE.Object3D;
  foot: THREE.Object3D;
  /** Captured from the clip each frame, before anything is moved. */
  footPos: THREE.Vector3;
  footQuat: THREE.Quaternion;
  /** Deltas this module applied, so they can be taken back out. */
  appliedUpLeg: THREE.Quaternion;
  appliedLeg: THREE.Quaternion;
  appliedFoot: THREE.Quaternion;
};

export type Legs = {
  hips: THREE.Object3D;
  left: Leg;
  right: Leg;
  /** Lateral pelvis offset applied last frame, in the hips' parent space. */
  appliedShift: THREE.Vector3;
  /** Midpoint of the two captured feet — the point the stance pivots about. */
  centre: THREE.Vector3;
};

function findBone(scene: THREE.Object3D, name: string) {
  const b =
    scene.getObjectByName(`mixamorig${name}`) ??
    scene.getObjectByName(`mixamorig:${name}`) ??
    scene.getObjectByName(name);
  if (!b) throw new Error(`leg-ik: no bone "${name}"`);
  return b;
}

const leg = (scene: THREE.Object3D, side: "Left" | "Right"): Leg => ({
  upLeg: findBone(scene, `${side}UpLeg`),
  leg: findBone(scene, `${side}Leg`),
  foot: findBone(scene, `${side}Foot`),
  footPos: new THREE.Vector3(),
  footQuat: new THREE.Quaternion(),
  appliedUpLeg: new THREE.Quaternion(),
  appliedLeg: new THREE.Quaternion(),
  appliedFoot: new THREE.Quaternion(),
});

export function resolveLegs(scene: THREE.Object3D): Legs {
  return {
    hips: findBone(scene, "Hips"),
    left: leg(scene, "Left"),
    right: leg(scene, "Right"),
    appliedShift: new THREE.Vector3(),
    centre: new THREE.Vector3(),
  };
}

/* ------------------------------------------------------------------ */

const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vC = new THREE.Vector3();
/* `vTarget` is the aim point and NOTHING inside the solver may write to it.
   It was briefly shared with the solver's own scratch, so `vT.copy(target)`
   aliased and the first `.sub()` turned the target into a direction — the feet
   drifted 1.6 units instead of staying pinned. Separate vectors, on purpose. */
const vTarget = new THREE.Vector3();
const vAt = new THREE.Vector3();
const vAc = new THREE.Vector3();
const axis0 = new THREE.Vector3();
const axis1 = new THREE.Vector3();
const qDelta = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const qWorld = new THREE.Quaternion();
const qUndo = new THREE.Quaternion();
const mParent = new THREE.Matrix4();
const qPivotScratch = new THREE.Quaternion();
const qFootTarget = new THREE.Quaternion();
const qBefore = new THREE.Quaternion();
const qLeft = new THREE.Quaternion();
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const EPS = 1e-5;

const worldPos = (o: THREE.Object3D, out: THREE.Vector3) =>
  out.setFromMatrixPosition(o.matrixWorld);

/* Every accumulation below is normalised, and that is not defensive tidying.
   A quaternion built by repeated `premultiply` drifts off unit length by a few
   ulps per operation; `Matrix4.compose` turns a non-unit quaternion into a
   matrix with a scale that is not 1, and `decompose` — which `getWorldQuaternion`
   calls — divides by that scale. Left alone the drift compounds every frame
   until the scale collapses and the division produces NaN. Measured on the
   human rig: the captured foot world quaternion was clean for 32 frames and
   NaN on the 33rd, with the cursor sitting still at screen centre the whole
   time, and the NaN then spread to every bone below the ankle. */

/**
 * Rotate a bone about a WORLD axis, on top of whatever it already holds.
 *
 * The delta is a LEFT multiplier — `local' = (parent^-1 * delta * parent) *
 * local` — so `store` accumulates on the left too, and `releaseLegs` has to undo
 * it with `premultiply`, not `multiply`. Getting that side wrong does not throw;
 * it leaves a residue that the next frame builds on.
 */
function rotateWorld(bone: THREE.Object3D, axis: THREE.Vector3, angle: number, store?: THREE.Quaternion) {
  if (!isFinite(angle) || Math.abs(angle) < 1e-6) return;
  qDelta.setFromAxisAngle(axis, angle);
  bone.parent!.getWorldQuaternion(qParent);
  qWorld.copy(qParent).invert();
  qLeft.copy(qWorld).multiply(qDelta).multiply(qParent);
  bone.quaternion.premultiply(qLeft).normalize();
  if (store) store.premultiply(qLeft).normalize();
  bone.updateMatrixWorld(true);
}

const angleBetween = (a: THREE.Vector3, b: THREE.Vector3) =>
  Math.acos(THREE.MathUtils.clamp(a.dot(b) / (a.length() * b.length() || 1), -1, 1));

/**
 * Analytic two-bone IK: put `foot` on `target` by bending the knee.
 *
 * Law of cosines for the knee angle, then a single swing that aims the whole
 * limb at the target. The bend plane is taken from the limb's CURRENT pose, so
 * the knee keeps bending the way the clip was already bending it — no pole
 * vector to get wrong, and no chance of the knee inverting on a straight leg
 * because a near-straight limb barely needs bending in the first place.
 */
function solveTwoBone(l: Leg, target: THREE.Vector3) {
  worldPos(l.upLeg, vA);
  worldPos(l.leg, vB);
  worldPos(l.foot, vC);

  const lab = vA.distanceTo(vB);
  const lcb = vB.distanceTo(vC);
  if (lab < EPS || lcb < EPS) return;

  // Never ask for a fully straight or over-extended leg: at full extension the
  // knee axis is undefined and the joint snaps.
  const lat = THREE.MathUtils.clamp(vA.distanceTo(target), EPS, lab + lcb - EPS * 10);

  const ab = vB.clone().sub(vA);          // hip  -> knee
  const ac = vAc.copy(vC).sub(vA);        // hip  -> ankle
  const at = vAt.copy(target).sub(vA);    // hip  -> target
  const ba = vA.clone().sub(vB);          // knee -> hip
  const bc = vC.clone().sub(vB);          // knee -> ankle

  const ac_ab_0 = angleBetween(ac, ab);
  const ba_bc_0 = angleBetween(ba, bc);

  const ac_ab_1 = Math.acos(
    THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1)
  );
  const ba_bc_1 = Math.acos(
    THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1)
  );

  // Bend plane of the limb as it stands. Falls back to the target plane if the
  // leg is dead straight and the cross product degenerates.
  axis0.copy(ac).cross(ab);
  if (axis0.lengthSq() < EPS) axis0.copy(ac).cross(at);
  if (axis0.lengthSq() < EPS) return;
  axis0.normalize();

  rotateWorld(l.upLeg, axis0, ac_ab_1 - ac_ab_0, l.appliedUpLeg);
  rotateWorld(l.leg, axis0, ba_bc_1 - ba_bc_0, l.appliedLeg);

  // Now swing the whole limb so the foot lands on the target.
  worldPos(l.upLeg, vA);
  worldPos(l.foot, vC);
  vAc.copy(vC).sub(vA);
  vAt.copy(target).sub(vA);
  axis1.copy(vAc).cross(vAt);
  if (axis1.lengthSq() > EPS) {
    axis1.normalize();
    rotateWorld(l.upLeg, axis1, angleBetween(vAc, vAt), l.appliedUpLeg);
  }
}

/* ------------------------------------------------------------------ */

/**
 * Hand the legs back to the clip. Call BEFORE `mixer.update`, for the same
 * reason `releaseLookChain` exists: `AnimationMixer` skips writing a bone whose
 * value has not changed, so anything layered on top compounds without bound the
 * moment the pose goes still.
 */
export function releaseLegs(legs: Legs) {
  legs.hips.position.sub(legs.appliedShift);
  legs.appliedShift.set(0, 0, 0);

  for (const l of [legs.left, legs.right]) {
    for (const [bone, applied] of [
      [l.upLeg, l.appliedUpLeg],
      [l.leg, l.appliedLeg],
      [l.foot, l.appliedFoot],
    ] as const) {
      qUndo.copy(applied).invert();
      bone.quaternion.premultiply(qUndo).normalize();
      applied.identity();
    }
  }
}

/**
 * Record where the clip put the feet. Call AFTER `mixer.update` and BEFORE the
 * pelvis is moved — these are the positions the legs will be solved back onto.
 */
export function captureLegs(legs: Legs, root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  for (const l of [legs.left, legs.right]) {
    worldPos(l.foot, l.footPos);
    l.foot.getWorldQuaternion(l.footQuat);
  }
  legs.centre.copy(legs.left.footPos).add(legs.right.footPos).multiplyScalar(0.5);
}

/**
 * Shift the pelvis sideways, toward whichever side the cursor is on.
 *
 * This is the weight shift, and it is the reason the legs end up doing
 * something: with the feet pinned, moving the pelvis 6cm to one side forces one
 * leg to straighten and the other to bend. Rotating the pelvis alone never
 * produces that, because the feet come along for the ride.
 *
 * `amount` is -1..1. The offset is built in the FIGURE's frame and converted
 * into the hips' parent space, which is where the units are strange: the hips
 * hang off a node carrying the model's centimetre conversion, so a world offset
 * has to go through the parent's inverse rather than being added raw.
 */
export function shiftHips(legs: Legs, root: THREE.Object3D, amount: number, distance: number) {
  const hips = legs.hips;
  const parent = hips.parent!;
  parent.updateMatrixWorld(true);

  worldPos(hips, vA);
  vB.set(amount * distance, 0, 0).applyQuaternion(root.getWorldQuaternion(qWorld));
  vC.copy(vA).add(vB);

  mParent.copy(parent.matrixWorld).invert();
  vA.applyMatrix4(mParent);
  vC.applyMatrix4(mParent);

  legs.appliedShift.copy(vC).sub(vA);
  hips.position.add(legs.appliedShift);
  hips.updateMatrixWorld(true);
}

/**
 * Put the feet back where the clip had them, letting them pivot by `pivot`
 * radians about the stance centre so they follow a little of the turn.
 *
 * Call AFTER the look chain and `shiftHips`.
 */
export function solveLegs(legs: Legs, root: THREE.Object3D, pivot: number) {
  root.updateMatrixWorld(true);

  qPivotScratch.setFromAxisAngle(AXIS_Y, pivot);
  const qPivot = qPivotScratch;

  for (const l of [legs.left, legs.right]) {
    // target = captured foot, rotated about the stance centre by `pivot`
    vTarget.copy(l.footPos).sub(legs.centre).applyQuaternion(qPivot).add(legs.centre);
    solveTwoBone(l, vTarget);

    /* The foot's own orientation, restored. Without this the ankle inherits
       every rotation the IK put into the thigh and shin and the sole ends up
       pointing off into the air. */
    qFootTarget.copy(qPivot).multiply(l.footQuat);
    l.foot.parent!.getWorldQuaternion(qParent);
    qParent.invert();
    qBefore.copy(l.foot.quaternion).invert();
    l.foot.quaternion.copy(qParent).multiply(qFootTarget);
    // left multiplier: new * old^-1, matching rotateWorld and releaseLegs
    l.foot.quaternion.normalize();
    l.appliedFoot.copy(l.foot.quaternion).multiply(qBefore).premultiply(l.appliedFoot).normalize();
    l.foot.updateMatrixWorld(true);
  }
}
