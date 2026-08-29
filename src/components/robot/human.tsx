"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { usePointer, easePointer } from "./use-pointer";
import { Spring, JointSpring } from "./spring";
import { driveJoint } from "./rig";
import { POSES, type Pose } from "./poses";
import {
  Gait,
  makeGait,
  REF_STEP_OVER_LEG,
  BOB_OVER_LEG,
} from "./locomotion";

/**
 * A deliberately generic stylised figure — the "human" half of the About
 * morph. It is not modelled on anyone: neutral proportions, no facial
 * features beyond placeholder eyes, no likeness.
 *
 * Rebuilt as an articulated rig.
 *
 * The version before this one had no joints at all: the arms and legs were
 * static geometry emitted from a `.map()`, and the entire animation was three
 * lines of `THREE.MathUtils.damp` on the head, a 2cm bob, and a root yaw. So
 * the About morph swapped a figure that breathed, shifted its weight, held a
 * pose and tracked the cursor for one that stood to attention and did none of
 * those things — the swap read as a change of pose as much as a change of
 * identity, which is the one thing it must not do.
 *
 * The structure follows `webgl_tsl_skinning` in `sample_snippets/`: a real
 * joint chain that a pose can address, rather than a silhouette. It shares the
 * robot's POSES, springs and `driveJoint` so both halves of the morph are
 * doing the same thing at the moment they trade places.
 *
 * Every rest offset below is the old flat one re-expressed through the new
 * pivots, so the figure is geometrically unchanged when every joint is at
 * zero. That matters: HUMAN_FIT in index.tsx is built on a MEASURED sole
 * height, and moving it by a millimetre would put the morph back out of
 * alignment.
 */

function useHumanMaterials() {
  return useMemo(() => {
    // Opaque by default. `setDissolveActive` turns transparency on for the
    // ~1.2s a morph runs and off again after; leaving it on permanently put
    // the whole figure in the sorted transparent pass for no reason.
    const mk = (o: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial(o);
    return {
      skin: mk({ color: "#d9a882", roughness: 0.72, metalness: 0 }),
      hair: mk({ color: "#241d1a", roughness: 0.62, metalness: 0.05 }),
      shirt: mk({ color: "#2f3742", roughness: 0.85, metalness: 0 }),
      jeans: mk({ color: "#8fa6c4", roughness: 0.9, metalness: 0 }),
      shoe: mk({ color: "#f2f4f7", roughness: 0.55, metalness: 0.05 }),
      sole: mk({ color: "#c3c9d2", roughness: 0.6, metalness: 0.1 }),
      eye: mk({ color: "#1a1a1f", roughness: 0.3, metalness: 0 }),
    };
  }, []);
}

/**
 * The robot's poses, retargeted.
 *
 * Same joints, but this figure's arms are shorter and hang closer, so the
 * shoulder abduction that reads as "relaxed" on a robot with blade arms reads
 * as "wings" here. Retargeting a clip between skeletons of different
 * proportions is the ordinary case, not a special one.
 */
const ARM_SPREAD = 0.55;
const LEG_SPREAD = 0.7;

export default function HumanModel({
  paused = false,
  pose = "idle",
}: {
  paused?: boolean;
  pose?: Pose;
}) {
  const pointer = usePointer();
  const M = useHumanMaterials();

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const shoulderL = useRef<THREE.Group>(null);
  const shoulderR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const ankleL = useRef<THREE.Group>(null);
  const ankleR = useRef<THREE.Group>(null);

  /** Cursor springs, staggered head -> chest -> pelvis, as on the robot. */
  const sp = useRef({
    headY: new Spring(0, 250, 0.6),
    headX: new Spring(0, 220, 0.63),
    headZ: new Spring(0, 160, 0.68),
    torsoY: new Spring(0, 120, 0.7),
    torsoX: new Spring(0, 105, 0.74),
    rootY: new Spring(0, 62, 0.8),
    hipsY: new Spring(0, 66, 0.8),
    hipsZ: new Spring(0, 58, 0.82),
    /**
     * The shoulders trail the chest.
     *
     * A softer copy of the torso yaw; the shoulders are then driven by the
     * DIFFERENCE between the two, so they arrive after it and settle after it.
     * Without this level the arms are welded to the ribcage and the whole
     * upper body turns as one plate.
     */
    armLag: new Spring(0, 42, 0.78),
  });

  const ps = useRef({
    torso: new JointSpring(34, 0.66),
    head: new JointSpring(34, 0.66),
    shoulderL: new JointSpring(26, 0.62),
    shoulderR: new JointSpring(26, 0.62),
    elbowL: new JointSpring(30, 0.65),
    elbowR: new JointSpring(30, 0.65),
    hipL: new JointSpring(30, 0.65),
    hipR: new JointSpring(30, 0.65),
    kneeL: new JointSpring(30, 0.65),
    kneeR: new JointSpring(30, 0.65),
  });
  const liftS = useRef(new Spring(0, 30, 0.68));
  const bobS = useRef(new Spring(1, 18, 0.9));

  /**
   * Thigh and shin, measured off the rest offsets below.
   *
   * These were 0.59 and 0.46 — a thigh 28% longer than the shin. Michelle,
   * Xbot and Soldier all put the two within 2% of equal (ratios 0.78, 1.00 and
   * 0.98; Michelle's foot bone sits low, which is what pulls hers down), so an
   * even split is the reference proportion and the old one was simply wrong.
   * The knee moved down by 0.065 and the ankle up by the same amount, which
   * leaves the sole exactly where it was — so `HUMAN_FIT` in index.tsx, which
   * is measured against that sole, is unaffected.
   */
  const THIGH = 0.525;
  const SHIN = 0.525;
  const LEG = THIGH + SHIN;
  const gait = useRef(new Gait(makeGait(THIGH, SHIN, LEG * REF_STEP_OVER_LEG)));
  /** See model.tsx: measured head local yaw over measured pelvis yaw. */
  const HEAD_OVER_PELVIS = 0.43;

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime;
    const p = POSES[pose];
    const still = paused ? 0 : 1;
    easePointer(pointer.current, d, 26);

    const wantWalk = !!p.walking && !paused;
    const G = gait.current;
    G.request(wantWalk);
    const wk = G.update(d, 0);
    const gl = G.legs();
    const gs = G.secondary();
    const ga = G.arms();
    const gt = G.torso();
    const pelvisYaw = gt.pelvisYaw * wk;

    const px = pointer.current.x * still;
    const py = pointer.current.y * still;

    // Layered slow sines on incommensurate periods, so the idle drifts
    // continuously and never visibly loops.
    const idleYaw =
      still * (Math.sin(t * 0.37) * 0.045 + Math.sin(t * 0.83 + 1.7) * 0.022);
    const idlePitch =
      still * (Math.sin(t * 0.29 + 0.6) * 0.03 + Math.sin(t * 0.71) * 0.015);

    const tY = sp.current.torsoY.step(px * 0.34, d);
    const tX = sp.current.torsoX.step(-py * 0.16, d);
    const hY = sp.current.headY.step(px * 0.45 * still + idleYaw, d);
    const hX = sp.current.headX.step(-py * 0.3 * still + idlePitch, d);
    const hZ = sp.current.headZ.step(px * 0.12 * still, d);

    // Shoulders get what the chest has already done, minus what they have
    // caught up with — a lag, not a scaled copy.
    const lag = tY - sp.current.armLag.step(tY, d);

    const S = ps.current;
    driveJoint(torso.current, p.torso, S.torso, d, { y: gt.chestYaw * wk }, undefined, {
      x: tX,
      y: tY,
    });
    // Counter-rotates against the chest, so the head stays pointed forward
    // while the shoulders swing under it — see the note in model.tsx.
    driveJoint(head.current, p.head, S.head, d, { y: pelvisYaw * HEAD_OVER_PELVIS }, undefined, {
      x: hX,
      y: hY,
      z: hZ,
    });

    driveJoint(
      shoulderL.current,
      { ...p.shoulderL, z: (p.shoulderL.z ?? 0) * ARM_SPREAD },
      S.shoulderL,
      d,
      { x: ga.left.shoulder * wk },
      undefined,
      { x: lag * 0.55 }
    );
    driveJoint(
      shoulderR.current,
      { ...p.shoulderR, z: (p.shoulderR.z ?? 0) * ARM_SPREAD },
      S.shoulderR,
      d,
      { x: ga.right.shoulder * wk },
      undefined,
      { x: -lag * 0.55 }
    );
    driveJoint(elbowL.current, p.elbowL, S.elbowL, d, {
      x: ga.left.elbow * wk,
    });
    driveJoint(elbowR.current, p.elbowR, S.elbowR, d, {
      x: ga.right.elbow * wk,
    });

    driveJoint(
      hipL.current,
      { ...p.hipL, z: (p.hipL.z ?? 0) * LEG_SPREAD },
      S.hipL,
      d,
      { x: gl.left.hip * wk }
    );
    driveJoint(
      hipR.current,
      { ...p.hipR, z: (p.hipR.z ?? 0) * LEG_SPREAD },
      S.hipR,
      d,
      { x: gl.right.hip * wk }
    );
    driveJoint(kneeL.current, p.kneeL, S.kneeL, d, { x: gl.left.knee * wk });
    driveJoint(kneeR.current, p.kneeR, S.kneeR, d, { x: gl.right.knee * wk });
    if (ankleL.current) ankleL.current.rotation.x = gl.left.ankle * wk;
    if (ankleR.current) ankleR.current.rotation.x = gl.right.ankle * wk;

    if (hips.current) {
      // Weight shift on a long, deliberately incommensurate period. A standing
      // body moves its weight from hip to hip; without it the figure is parked.
      const weightShift = still * Math.sin(t * 0.74 + 0.9) * 0.02 * (1 - wk);
      const drop = Math.sin(2 * Math.PI * G.phase) * 0.1009 * wk;
      hips.current.rotation.y = sp.current.hipsY.step(px * 0.06, d) + pelvisYaw;
      hips.current.rotation.z =
        sp.current.hipsZ.step(-px * 0.045 + weightShift, d) + drop;
    }

    if (body.current) {
      const bob = bobS.current.step(p.bob, d);
      const breathe = Math.sin(t * 1.5) * 0.022 * bob * still;
      const stride = gs.bob * LEG * BOB_OVER_LEG * wk;
      body.current.position.y = liftS.current.step(p.lift, d) + breathe + stride;
      body.current.rotation.z = Math.sin(t * 0.58) * 0.016 * bob * still;
    }

    if (root.current) {
      root.current.rotation.y = sp.current.rootY.step(px * 0.22, d);
    }
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {/* ============ upper body ============
            Pivots at the waist, so the chest can twist over a pelvis that
            stays put. The pelvis is a SIBLING of it, not a child — the same
            structure the robot needs for the same reason. */}
        <group ref={torso} position={[0, -0.1, 0]}>
          {/* ---------------- head ---------------- */}
          <group ref={head} position={[0, 1.02, 0]}>
            <mesh material={M.skin} scale={[0.86, 1, 0.9]} castShadow>
              <sphereGeometry args={[0.32, 32, 26]} />
            </mesh>
            {/* hair cap + a messy fringe */}
            <mesh material={M.hair} position={[0, 0.07, -0.02]} scale={[0.95, 0.86, 0.98]} castShadow>
              <sphereGeometry args={[0.325, 28, 22]} />
            </mesh>
            {[-0.14, 0, 0.14].map((x, i) => (
              <mesh
                key={i}
                material={M.hair}
                position={[x, 0.26, 0.16]}
                rotation={[0.3, 0, (i - 1) * 0.35]}
                castShadow
              >
                <coneGeometry args={[0.07, 0.18, 8]} />
              </mesh>
            ))}
            {/* placeholder eyes — no likeness intended */}
            {[-1, 1].map((s) => (
              <mesh key={s} material={M.eye} position={[s * 0.11, 0.01, 0.29]}>
                <sphereGeometry args={[0.032, 14, 14]} />
              </mesh>
            ))}
            {/* neck */}
            <mesh material={M.skin} position={[0, -0.31, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.1, 0.14, 18]} />
            </mesh>
          </group>

          {/* ---------------- chest ---------------- */}
          <RoundedBox
            args={[0.54, 0.72, 0.3]}
            radius={0.13}
            smoothness={5}
            material={M.shirt}
            position={[0, 0.34, 0]}
            castShadow
          />

          {/* ---------------- arms ---------------- */}
          {([
            [-1, shoulderL, elbowL],
            [1, shoulderR, elbowR],
          ] as const).map(([s, shoulderRef, elbowRef]) => (
            <group key={s} position={[s * 0.32, 0.56, 0]}>
              <group ref={shoulderRef}>
                {/* sleeve */}
                <RoundedBox
                  args={[0.17, 0.34, 0.18]}
                  radius={0.07}
                  smoothness={4}
                  material={M.shirt}
                  position={[0, -0.17, 0]}
                  castShadow
                />
                <group ref={elbowRef} position={[0, -0.35, 0]}>
                  {/* forearm */}
                  <mesh material={M.skin} position={[0, -0.11, 0]} castShadow>
                    <capsuleGeometry args={[0.062, 0.22, 6, 14]} />
                  </mesh>
                  {/* hand */}
                  <mesh material={M.skin} position={[0, -0.29, 0]} scale={[1, 1.2, 0.7]} castShadow>
                    <sphereGeometry args={[0.075, 16, 14]} />
                  </mesh>
                </group>
              </group>
            </group>
          ))}
        </group>

        {/* ============ pelvis and legs ============ */}
        <group ref={hips} position={[0, -0.16, 0]}>
          {([
            [-1, hipL, kneeL, ankleL],
            [1, hipR, kneeR, ankleR],
          ] as const).map(([s, hipRef, kneeRef, ankleRef]) => (
            <group key={s} position={[s * 0.15, 0, 0]}>
              <group ref={hipRef}>
                {/* thigh */}
                <RoundedBox
                  args={[0.22, 0.56, 0.24]}
                  radius={0.09}
                  smoothness={4}
                  material={M.jeans}
                  position={[0, -0.263, 0]}
                  castShadow
                />
                <group ref={kneeRef} position={[0, -0.525, 0]}>
                  {/* shin */}
                  <RoundedBox
                    args={[0.2, 0.56, 0.22]}
                    radius={0.08}
                    smoothness={4}
                    material={M.jeans}
                    position={[0, -0.263, 0]}
                    castShadow
                  />
                  {/* The ankle. Same reason as the robot's: without it the
                      sole tracks the shin and the shoe pivots about the knee. */}
                  <group ref={ankleRef} position={[0, -0.525, 0]}>
                    <RoundedBox
                      args={[0.23, 0.15, 0.36]}
                      radius={0.07}
                      smoothness={5}
                      material={M.shoe}
                      position={[0, -0.07, 0.07]}
                      castShadow
                    />
                    <mesh material={M.sole} position={[0, -0.14, 0.07]}>
                      <boxGeometry args={[0.235, 0.04, 0.35]} />
                    </mesh>
                  </group>
                </group>
              </group>
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
