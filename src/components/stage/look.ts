import * as THREE from "three";
import type { Pointer } from "./use-pointer";

/**
 * Turning to look at the cursor, from the waist up.
 *
 * Two rules, both learned the hard way.
 *
 * THE FEET STAY PLANTED. The chain starts at `Spine`, not `Hips`, and the
 * figure's own group is never rotated or shifted. Hips is the parent of the
 * legs, so a yaw there swings the boots; a yaw on the group swings them too and
 * a sideways shift slides them. On screen that does not read as a character
 * looking at something, it reads as the model being dragged across its own
 * contact shadow. A person tracking something across a room turns from the
 * waist and leaves their feet where they are.
 *
 * THE ROTATION IS APPLIED ABOUT THE FIGURE'S AXES, NOT EACH BONE'S OWN. The two
 * rigs disagree about what a bone's own axes are. Measured on the bind pose,
 * applying `rotation.y += 0.3` to all six joints and reading the world yaw that
 * results at each:
 *
 *   human   +0.3  +0.6  +0.9  +1.2  +1.5  +1.8
 *   robot   -0.3   0.0  +0.3  +0.6  +0.9  +1.2
 *
 * The robot's hips turn the WRONG WAY and his spine spends its whole
 * contribution cancelling that. Converting one rotation into each bone's parent
 * frame is indifferent to how either rig was bound, and both figures then
 * respond identically: head yaw +0.577, chest yaw +0.299, head pitch +0.382.
 */

/** Shares of the total turn, hips-to-head. Each column sums to 1. */
const CHAIN = [
  { name: "Spine", yaw: 0.12, pitch: 0.06, lag: true },
  { name: "Spine1", yaw: 0.16, pitch: 0.1, lag: true },
  { name: "Spine2", yaw: 0.2, pitch: 0.14, lag: true },
  { name: "Neck", yaw: 0.2, pitch: 0.24, lag: false },
  { name: "Head", yaw: 0.32, pitch: 0.46, lag: false },
] as const;

/** Total deflection at full cursor throw, in radians, summed over the chain. */
const YAW = 0.52;
const PITCH = 0.34;

const AXIS_Y = new THREE.Vector3(0, 1, 0);
const AXIS_X = new THREE.Vector3(1, 0, 0);
const qFrame = new THREE.Quaternion();
const qDelta = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const qPitch = new THREE.Quaternion();
const qInv = new THREE.Quaternion();

export type LookChain = { bone: THREE.Object3D; yaw: number; pitch: number; lag: boolean }[];

export function resolveChain(scene: THREE.Object3D): LookChain {
  return CHAIN.map((j) => {
    const bone = scene.getObjectByName(j.name);
    if (!bone) throw new Error(`look: no bone "${j.name}"`);
    return { bone, yaw: j.yaw, pitch: j.pitch, lag: j.lag };
  });
}

/**
 * Orientation of `node` relative to `stop`, from local quaternions only.
 *
 * Deliberately not `getWorldQuaternion`: the ancestors above the figure's own
 * group are the About somersault and the section tumble. Against true world
 * axes the look would fight a rig that is upside down mid-flip; against the
 * figure's own root it rides along with it.
 */
function frameOf(node: THREE.Object3D, stop: THREE.Object3D, out: THREE.Quaternion) {
  out.identity();
  for (let o: THREE.Object3D | null = node; o && o !== stop; o = o.parent) out.premultiply(o.quaternion);
  return out;
}

/**
 * Apply the look. Call AFTER `mixer.update`, so it layers on the clip rather
 * than being overwritten by it.
 *
 * `gain` scales the whole thing down while the dance owns the body — a cursor
 * pulling the spine around mid-choreography reads as the figure being
 * distracted.
 */
export function applyLook(chain: LookChain, root: THREE.Object3D, p: Pointer, gain: number) {
  frameOf(chain[0].bone.parent ?? chain[0].bone, root, qFrame);

  for (const j of chain) {
    const px = j.lag ? p.bx : p.x;
    const py = j.lag ? p.by : p.y;

    qYaw.setFromAxisAngle(AXIS_Y, YAW * gain * j.yaw * px);
    qPitch.setFromAxisAngle(AXIS_X, -PITCH * gain * j.pitch * py);
    qDelta.copy(qYaw).multiply(qPitch);

    // local' = frame^-1 * delta * frame * local
    qInv.copy(qFrame).invert();
    j.bone.quaternion.premultiply(qFrame).premultiply(qDelta).premultiply(qInv);

    // this joint's new orientation is the frame for the joint below it
    qFrame.multiply(j.bone.quaternion);
  }
}
