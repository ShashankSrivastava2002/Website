import * as THREE from "three";

/**
 * Weighted procedural look-at, propagated down the spine.
 *
 * The figure used to track the cursor with its neck alone, which reads as a
 * mannequin on a swivel. Here one target angle is measured per frame and shared
 * out over four joints. Because the joints form a parent chain the shares ADD
 * as you descend — hips 5%, spine 20% cumulative, chest 50%, head 100% — so the
 * head ends up looking straight at the cursor while everything beneath it has
 * already leaned into the turn.
 *
 * The angle is measured ONCE, against the figure's own frame, and then
 * distributed. That is the part worth being careful about: the obvious
 * alternative is to ask each joint "how far are you off the target?" as you walk
 * down the chain, which turns the whole thing into a feedback loop — every joint
 * measures a target its ancestors have already partly turned toward, so the
 * shares compound instead of summing. Measured, that version put the hips at
 * 107 degrees of yaw for a cursor at the screen edge, gave non-monotonic
 * contributions down the chain, and did not return to zero at screen centre.
 * Open-loop distribution of a single measured angle is both simpler and stable.
 *
 * Each joint carries its own lerp speed, so the head arrives first and the torso
 * settles in behind it. That offset is the whole illusion of mass; the weights
 * alone would give four joints moving in lockstep, which reads as one rigid
 * rotation with extra steps.
 */

/* ------------------------------------------------------------------ */

export type LookJoint = {
  /** Mixamo bone name, without the `mixamorig` prefix. */
  name: string;
  /** Share of the target angle this joint contributes. */
  weight: number;
  /**
   * Response shaping. 1 is linear; higher keeps the joint quiet through the
   * middle of the range and brings it in near the extremes.
   */
  curve: number;
  /** Lerp speed, in units of 1/second. Higher = lighter = arrives sooner. */
  speed: number;
  /** Per-axis limits, in radians. */
  maxYaw: number;
  maxPitch: number;
};

const D = Math.PI / 180;

/**
 * The angle a cursor at the screen edge asks for, used to normalise the
 * response curves below. Measured: with the weights summing to 1, the head
 * reaches 39.8 degrees at ndc.x = 1.
 */
const AIM_REFERENCE = 40 * D;

/**
 * Hips first, head last — the array order is the parent order.
 *
 * THE HIPS TURN, and that is a correction. They were held at 5% with an 8
 * degree limit on the theory that the feet are planted by the clip and any
 * pelvis yaw drags them around. Going frame by frame through the reference
 * recording, that theory is wrong: at t002.0 and t011.4 the pelvis has clearly
 * yawed and both feet have pivoted with it, while at t000.6 and t017.0 the
 * stance is square and symmetric. The lower body turns — it just only does it
 * near the extremes.
 *
 * So the hips carry a real share (0.28) behind a steep curve (2.4). Through the
 * middle of the screen that curve keeps them almost still — at half deflection
 * they contribute 1.5 degrees — and at the edge they reach about 11, which is
 * the "feet turn by some degrees in extreme conditions" the reference shows.
 *
 * The head takes whatever is LEFT rather than a fixed share, so the cumulative
 * total stays exactly 1 and the head still lands on the cursor no matter what
 * the curve below it is doing. Fixing the head at 0.5 would make it overshoot
 * or undershoot as the hips came in and out.
 */
export const LOOK_JOINTS: LookJoint[] = [
  { name: "Hips", weight: 0.28, curve: 2.4, speed: 2.2, maxYaw: 20 * D, maxPitch: 3 * D },
  { name: "Spine", weight: 0.15, curve: 1, speed: 3.5, maxYaw: 20 * D, maxPitch: 12 * D },
  { name: "Spine2", weight: 0.3, curve: 1, speed: 5.5, maxYaw: 22 * D, maxPitch: 18 * D },
  // weight is ignored for the head; it takes the remainder. See applyLookChain.
  { name: "Head", weight: 0, curve: 1, speed: 9.0, maxYaw: 45 * D, maxPitch: 30 * D },
];

export type ResolvedJoint = LookJoint & {
  bone: THREE.Object3D;
  /** Current eased angles, in radians. Lives with the figure, not the module. */
  yaw: number;
  pitch: number;
  /** The bone's own local rotation before the look touched it, so the clip's
      pose can be put back exactly rather than reconstructed by inverting a
      product. See `releaseLookChain`. */
  applied: THREE.Quaternion;
  /** False until the first `applyLookChain`, so release cannot restore junk. */
  held?: boolean;
};

/**
 * The arms, which trail the chest instead of turning rigidly with it.
 *
 * This is the biggest single cause of a look-at chain reading as mechanical.
 * The shoulders are children of `Spine2`, so when the chest yaws 29 degrees the
 * whole arm swings 29 degrees with it, instantly and exactly — a mannequin
 * rotating in one piece. A real arm lags behind the torso and catches up after
 * it stops.
 *
 * The correction is a DERIVATIVE, not an offset: the shoulders are given
 * `-drag * (chest - chestLagged)`, where `chestLagged` is a slower copy of the
 * chest's own angle. While the chest is moving the two differ and the arms
 * hold back; once it settles they converge and the term goes to exactly zero,
 * so the arms end up where the clip put them and nothing is left rotated. A
 * plain negative weight would trail nicely and then leave the arms permanently
 * skewed.
 */
export type ArmTrail = {
  bone: THREE.Object3D;
  /** The bone's local rotation before the trail was applied. */
  applied: THREE.Quaternion;
  held?: boolean;
};

const ARM_BONES = ["LeftShoulder", "RightShoulder"];
/** How much of the chest's unmatched motion the arms hold back. */
const ARM_DRAG = 0.55;
/** Speed of the lagged copy of the chest angle. Slower = more trail. */
const ARM_LAG_SPEED = 3.2;

function findBone(scene: THREE.Object3D, name: string) {
  return (
    scene.getObjectByName(`mixamorig${name}`) ??
    scene.getObjectByName(`mixamorig:${name}`) ??
    scene.getObjectByName(name)
  );
}

export function resolveJoints(scene: THREE.Object3D, joints = LOOK_JOINTS): ResolvedJoint[] {
  return joints.map((j) => {
    const bone = findBone(scene, j.name);
    if (!bone) throw new Error(`look-chain: no bone "${j.name}"`);
    return { ...j, bone, yaw: 0, pitch: 0, applied: new THREE.Quaternion() };
  });
}

export function resolveArms(scene: THREE.Object3D): ArmTrail[] {
  return ARM_BONES.flatMap((n) => {
    const bone = findBone(scene, n);
    return bone ? [{ bone, applied: new THREE.Quaternion() }] : [];
  });
}

/** The bone the target angle is measured from — where the eyes are. */
export function resolveAnchor(scene: THREE.Object3D) {
  const bone = findBone(scene, "Head");
  if (!bone) throw new Error(`look-chain: no Head bone to aim from`);
  return bone;
}

/* ------------------------------------------------------------------ */

const target = new THREE.Vector3();
const anchor = new THREE.Vector3();
const toTarget = new THREE.Vector3();
const rootInverse = new THREE.Matrix4();
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);

/* ---- 1. screen -> a point in front of the MODEL ------------------ */

/**
 * How far the cursor is allowed to swing the aim point, in units of the
 * forward distance. `x / forward` is the tangent of the yaw at the screen edge:
 * 0.90 gives +-42 degrees, 0.40 gives +-22 degrees of pitch.
 */
const AIM_FORWARD = 1;
const AIM_SPREAD_X = 0.9;
const AIM_SPREAD_Y = 0.4;

/**
 * The point the figure aims at: directly in front of ITSELF, displaced by where
 * the cursor is on screen.
 *
 * The obvious construction — unproject the cursor onto a plane in front of the
 * CAMERA and look at that world point — is a true look-at and it is wrong here.
 * It makes the response depend on where the figure happens to be standing, and
 * on the About section the figure is slid 2.15 units into the left column. The
 * whole screen is then off to its right. Measured, the angle it gets asked for:
 *
 *   centred        ndc -1 .. +1  ->  -39  -28    0   +28  +39 deg
 *   About column   ndc -1 .. +1  ->   +2  +25  +47   +57  +59 deg
 *
 * Every cursor position lands on the same side, the range never crosses zero,
 * and at screen centre the figure is already turned 47 degrees. On screen that
 * is a character permanently skewed toward the middle of the page whose pose
 * barely changes between the far left and the far right — which is exactly what
 * it looked like.
 *
 * Building the point in the FIGURE's own frame instead makes the mapping
 * "cursor left, turn left" regardless of where the figure stands, and keeps the
 * range symmetric. It is still a 3D point in front of the model; it is just in
 * front of the MODEL rather than in front of the camera.
 */
const qRoot = new THREE.Quaternion();

export function cursorTarget(
  root: THREE.Object3D,
  anchorBone: THREE.Object3D,
  ndc: { x: number; y: number },
  out = target
) {
  anchor.setFromMatrixPosition(anchorBone.matrixWorld);
  root.getWorldQuaternion(qRoot);
  out
    .set(ndc.x * AIM_SPREAD_X, ndc.y * AIM_SPREAD_Y, AIM_FORWARD)
    .applyQuaternion(qRoot)
    .add(anchor);
  return out;
}

/**
 * Guard against the degenerate case above: if the aim point is closer to the
 * anchor than this, there is no meaningful direction to it and the previous
 * angles are held instead.
 */
const MIN_AIM_DISTANCE = 0.35;

/* ---- 2. that point -> one yaw/pitch, in the figure's frame ------- */

export type LookAngles = { yaw: number; pitch: number };
const angles: LookAngles = { yaw: 0, pitch: 0 };

/**
 * The angle the figure has to turn to face `worldTarget`.
 *
 * Measured from the head, but expressed in the FIGURE's frame rather than the
 * head's — so the number is independent of how the head is currently posed, and
 * feeding it back in next frame cannot chase its own tail. It also means the
 * same value drives two rigs that were bound differently.
 */
export function targetAngles(
  root: THREE.Object3D,
  anchorBone: THREE.Object3D,
  worldTarget: THREE.Vector3,
  out = angles
): LookAngles {
  anchor.setFromMatrixPosition(anchorBone.matrixWorld);
  toTarget.copy(worldTarget).sub(anchor);
  if (toTarget.lengthSq() < MIN_AIM_DISTANCE * MIN_AIM_DISTANCE) return out;

  rootInverse.copy(root.matrixWorld).invert();
  toTarget.transformDirection(rootInverse).normalize();

  out.yaw = Math.atan2(toTarget.x, toTarget.z);
  /* NEGATED, and not as a matter of taste. Measured on both rigs, a POSITIVE
     rotation about a spine bone's local +X tilts the head DOWN (+0.2 rad across
     four joints produced -45.8 degrees of head pitch). `asin` is positive when
     the target is above, so passing it through unchanged would make the figure
     look down at a cursor at the top of the screen. */
  out.pitch = -Math.asin(THREE.MathUtils.clamp(toTarget.y, -1, 1));
  return out;
}

/* ---- 3 & 4. distribute, ease, clamp, apply ----------------------- */

const qDesired = new THREE.Quaternion();
const qScratch = new THREE.Quaternion();
const qScratch2 = new THREE.Quaternion();
const qParent = new THREE.Quaternion();
const qFigure = new THREE.Quaternion();
const qFigureInverse = new THREE.Quaternion();
const clipWorld: THREE.Quaternion[] = [];

/**
 * Take last frame's look back out, restoring the bone to the clip's own pose.
 * Call BEFORE `mixer.update`.
 *
 * This is not belt-and-braces, it is load-bearing. `AnimationMixer` does not
 * write a bone unconditionally: `PropertyMixer.apply` compares the freshly
 * blended value against the last one it wrote and calls `binding.setValue` only
 * if they differ. A pose that is not changing therefore stops being written at
 * all — and a look that multiplies onto "whatever is in the bone" is then
 * multiplying onto its own output from last frame, every frame, without bound.
 *
 * It hides completely while a clip is moving, because a moving clip rewrites
 * the bone each frame and mops the accumulation up. It appears the instant the
 * pose goes still: a dance clamped on its last frame by `clampWhenFinished`, a
 * paused figure, an idle at a turning point. Measured with the clip frozen, the
 * head passed 165 degrees of yaw with the cursor at dead centre.
 *
 * Undoing before the mixer runs is correct either way — if the mixer does write
 * the bone, it overwrites this; if it skips, this has already put the clip pose
 * back.
 */
export function releaseLookChain(joints: ResolvedJoint[], arms: ArmTrail[] = []) {
  /* Normalised for the same reason leg-ik is: repeated quaternion products
     drift off unit length, and `decompose` divides by the scale that drift
     creates. It reaches NaN silently, tens of frames later. */
  for (const j of joints) {
    if (j.held) j.bone.quaternion.copy(j.applied);
  }
  for (const a of arms) {
    if (a.held) a.bone.quaternion.copy(a.applied);
  }
}

/**
 * Frame-rate independent lerp alpha.
 *
 * `MathUtils.lerp(a, b, 0.1)` moves a tenth of the way each FRAME, so the same
 * constant settles twice as fast at 120fps as at 60 and the apparent weight of
 * the torso becomes a property of the monitor. `1 - e^(-speed * dt)` keeps the
 * lerp while making the rate a property of time.
 */
const alpha = (speed: number, dt: number) => 1 - Math.exp(-speed * dt);

/**
 * Advance and apply the chain. Call AFTER `mixer.update`, so the look layers on
 * top of the clip rather than being overwritten by it.
 *
 * @param dt    seconds since the last frame
 * @param gain  0..1 master scale, for fading the look out while the figure dances
 */
/**
 * A joint's share of the target angle, after its response curve.
 *
 * The curve is applied to the angle NORMALISED against `AIM_REFERENCE`, so the
 * shaping is a property of how far across the screen the cursor is rather than
 * of the raw radian value — otherwise the same exponent would behave completely
 * differently at a different field of view.
 */
function share(j: LookJoint, angle: number) {
  if (j.curve === 1) return j.weight;
  const t = Math.min(1, Math.abs(angle) / AIM_REFERENCE);
  return j.weight * Math.pow(t, j.curve - 1);
}

/** Slower copy of the chest angle, per figure, for the arm trail. */
const chestLag = new WeakMap<object, number>();

export function applyLookChain(
  joints: ResolvedJoint[],
  aim: LookAngles,
  dt: number,
  gain = 1,
  arms: ArmTrail[] = [],
  root: THREE.Object3D
) {
  /* Snapshot BEFORE anything moves: each joint needs the world orientation the
     clip gave it, and by the time the loop reaches a joint its ancestors have
     already been rewritten. The local rotation is kept too — that is what
     `releaseLookChain` puts back. */
  root.getWorldQuaternion(qFigure);
  qFigureInverse.copy(qFigure).invert();
  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    j.bone.updateWorldMatrix(true, false);
    j.bone.getWorldQuaternion(clipWorld[i] ?? (clipWorld[i] = new THREE.Quaternion()));
    j.applied.copy(j.bone.quaternion);
    j.held = true;
  }
  let cumulativeYaw = 0;
  let cumulativePitch = 0;

  /* The lower joints take their shaped shares; the head takes the remainder, so
     the chain always sums to the full target angle. */
  let usedYaw = 0;
  let usedPitch = 0;
  for (let i = 0; i < joints.length - 1; i++) {
    usedYaw += share(joints[i], aim.yaw);
    usedPitch += share(joints[i], aim.pitch);
  }

  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    const isHead = i === joints.length - 1;
    const wYaw = isHead ? Math.max(0, 1 - usedYaw) : share(j, aim.yaw);
    const wPitch = isHead ? Math.max(0, 1 - usedPitch) : share(j, aim.pitch);

    const wantYaw = THREE.MathUtils.clamp(aim.yaw * wYaw * gain, -j.maxYaw, j.maxYaw);
    const wantPitch = THREE.MathUtils.clamp(aim.pitch * wPitch * gain, -j.maxPitch, j.maxPitch);

    const a = alpha(j.speed, dt);
    j.yaw = THREE.MathUtils.lerp(j.yaw, wantYaw, a);
    j.pitch = THREE.MathUtils.lerp(j.pitch, wantPitch, a);

    /* Post-multiplying rotates the bone about its OWN local axes, on top of
       whatever the mixer just wrote — which is exactly "rotate around local Y
       and X", without the trap in the obvious spelling of it.

       Deliberately not `bone.rotation.y += yaw`. `rotation` is an Euler triple
       and in the default XYZ order its Y term is applied after its X term, so
       on a bone whose bind pose carries a half turn about X, incrementing
       `rotation.y` turns the bone the other way. That is not hypothetical: on
       the rig this site used until recently, `rotation.y += 0.3` down the chain
       gave +0.3 per joint on one figure and -0.3 at the hips on the other, and
       the two tracked the cursor in opposite directions. A quaternion multiply
       has no ordering surprises.

       Yaw before pitch: yaw is about the vertical, which every joint below
       shares, so applying it first leaves the pitch axis where the body's
       shoulders actually are. */
    cumulativeYaw += j.yaw;
    cumulativePitch += j.pitch;

    /* Build the joint's target from the CUMULATIVE angles in the figure's own
       frame, and set the bone to it, rather than multiplying an increment onto
       whatever the bone currently holds.

       `R(up, yaw) * R(right, pitch)` has no roll term in it, so the chain
       cannot acquire one. The previous spelling — yaw then pitch about each
       BONE's local axes, post-multiplied — did, because a joint's local X is
       already carried around by every yaw above it, so its pitch is partly a
       roll in the figure's frame. Small in the middle of the screen and
       cumulative towards the corners: measured settled, head roll reached
       +4.50 deg at the bottom-right corner and -4.57 at the bottom-left, a
       sideways head tilt with nothing asking for it. */
    qDesired
      .setFromAxisAngle(AXIS_Y, cumulativeYaw)
      .multiply(qScratch.setFromAxisAngle(AXIS_X, cumulativePitch));

    /* Into world space, applied to the pose the clip left, then back into the
       bone's parent frame — which by now already carries every joint above. */
    qDesired.premultiply(qFigure).multiply(qFigureInverse).multiply(clipWorld[i]);
    j.bone.parent!.updateWorldMatrix(true, false);
    j.bone.parent!.getWorldQuaternion(qParent);
    j.bone.quaternion.copy(qParent.invert().multiply(qDesired)).normalize();
  }

  /* Arm follow-through. `chest` is what the chest joint is doing right now;
     `lagged` chases it more slowly, and the arms hold back by the difference. */
  if (arms.length) {
    const chest = joints[joints.length - 2];
    const key = chest.bone;
    const prev = chestLag.get(key) ?? chest.yaw;
    const lagged = THREE.MathUtils.lerp(prev, chest.yaw, alpha(ARM_LAG_SPEED, dt));
    chestLag.set(key, lagged);

    const trail = -(chest.yaw - lagged) * ARM_DRAG;
    qDesired.setFromAxisAngle(AXIS_Y, trail).premultiply(qFigure).multiply(qFigureInverse);
    for (const a of arms) {
      a.bone.updateWorldMatrix(true, false);
      a.bone.getWorldQuaternion(qScratch);
      a.applied.copy(a.bone.quaternion);
      a.held = true;
      a.bone.parent!.updateWorldMatrix(true, false);
      a.bone.parent!.getWorldQuaternion(qParent);
      a.bone.quaternion
        .copy(qParent.invert().multiply(qScratch2.copy(qDesired).multiply(qScratch)))
        .normalize();
    }
  }
}
