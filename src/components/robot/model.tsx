"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { POSES, type Pose, type Joint } from "./poses";
import { usePointer, easePointer } from "./use-pointer";
import { Spring } from "./spring";
import * as M from "./materials";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const damp = THREE.MathUtils.damp;

/** Eases a group's euler rotation toward a pose's target for that joint. */
function driveJoint(
  obj: THREE.Object3D | null,
  target: Joint | undefined,
  lambda: number,
  dt: number,
  extra?: { x?: number; y?: number; z?: number }
) {
  if (!obj || !target) return;
  const ex = extra?.x ?? 0;
  const ey = extra?.y ?? 0;
  const ez = extra?.z ?? 0;
  obj.rotation.x = damp(obj.rotation.x, (target.x ?? 0) + ex, lambda, dt);
  obj.rotation.y = damp(obj.rotation.y, (target.y ?? 0) + ey, lambda, dt);
  obj.rotation.z = damp(obj.rotation.z, (target.z ?? 0) + ez, lambda, dt);
}

/* ------------------------------------------------------------------ */
/* limb sub-assemblies                                                 */
/* ------------------------------------------------------------------ */

/** Chrome ball joint. */
function Ball({ r = 0.1, ...props }: { r?: number } & JSX.IntrinsicElements["mesh"]) {
  return (
    <mesh material={M.chrome} castShadow {...props}>
      <sphereGeometry args={[r, 24, 24]} />
    </mesh>
  );
}

/**
 * One arm. `side` is -1 for the robot's left, +1 for its right, which mirrors
 * the geometry without duplicating it.
 */
function Arm({
  side,
  shoulderRef,
  elbowRef,
}: {
  side: -1 | 1;
  shoulderRef: React.RefObject<THREE.Group>;
  elbowRef: React.RefObject<THREE.Group>;
}) {
  return (
    <group position={[side * 0.38, 0.28, 0]}>
      {/* shoulder ball, and the pivot everything below hangs from */}
      <Ball r={0.105} />
      <group ref={shoulderRef}>
        {/* upper arm — angular shell tapering down */}
        <RoundedBox
          args={[0.24, 0.5, 0.24]}
          radius={0.1}
          smoothness={5}
          material={M.plating}
          position={[side * 0.045, -0.29, 0]}
          castShadow
        />
        {/* soft shoulder pauldron over the top */}
        <mesh material={M.platingSoft} position={[side * 0.05, -0.05, 0]} castShadow>
          <sphereGeometry args={[0.165, 22, 18]} />
        </mesh>

        {/* elbow */}
        <group position={[side * 0.045, -0.57, 0]}>
          <Ball r={0.085} />
          <group ref={elbowRef}>
            {/* forearm */}
            <group position={[side * 0.07, -0.26, 0]} rotation={[0, 0, side * -0.12]}>
              <mesh material={M.plating} scale={[0.62, 1.5, 0.4]} castShadow>
                <sphereGeometry args={[0.29, 28, 22]} />
              </mesh>
              {/* taper to the wrist */}
              <mesh
                material={M.plating}
                position={[0, -0.36, 0]}
                rotation={[Math.PI, 0, 0]}
                scale={[1, 1, 0.55]}
                castShadow
              >
                <coneGeometry args={[0.175, 0.3, 20]} />
              </mesh>
            </group>
            {/* amber accent stripe on the outer forearm */}
            <mesh
              material={M.amber}
              position={[side * 0.088, -0.2, 0.0]}
              rotation={[0, 0, 0]}
            >
              <boxGeometry args={[0.006, 0.11, 0.035]} />
            </mesh>

            {/* wrist cuff */}
            <mesh material={M.chromeDark} position={[side * 0.05, -0.52, 0]}>
              <cylinderGeometry args={[0.075, 0.085, 0.06, 16]} />
            </mesh>

            {/* Hand: a small chrome knuckle with three thin curved talons. */}
            <mesh material={M.chromeDark} position={[side * 0.09, -0.66, 0.01]} castShadow>
              <sphereGeometry args={[0.062, 16, 14]} />
            </mesh>
            {[-1, 0, 1].map((f) => (
              <mesh
                key={f}
                material={M.chrome}
                position={[side * 0.09 + f * 0.042, -0.75, 0.012 + Math.abs(f) * -0.01]}
                rotation={[Math.PI - 0.16, 0, f * 0.26]}
                castShadow
              >
                <coneGeometry args={[0.019, 0.17, 8]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/** One leg — short and stubby, with a big rounded boot. */
function Leg({
  side,
  hipRef,
  kneeRef,
  legRef,
}: {
  side: -1 | 1;
  hipRef: React.RefObject<THREE.Group>;
  kneeRef: React.RefObject<THREE.Group>;
  /** whole-limb pivot: lets the foot turn and step under a body twist */
  legRef: React.RefObject<THREE.Group>;
}) {
  return (
    <group ref={legRef} position={[side * 0.18, -0.46, 0]}>
      <Ball r={0.1} />
      <group ref={hipRef}>
        {/* Thigh is exposed chrome hardware rather than plating — it's what
            makes the legs read as an articulated figure. */}
        <mesh material={M.chrome} position={[0, -0.14, 0]} castShadow>
          <cylinderGeometry args={[0.105, 0.115, 0.22, 20]} />
        </mesh>
        <Ball r={0.082} position={[0, -0.26, 0]} />
        <RoundedBox
          args={[0.25, 0.22, 0.26]}
          radius={0.1}
          smoothness={5}
          material={M.plating}
          position={[0, -0.31, 0]}
          castShadow
        />

        {/* knee */}
        <group position={[0, -0.38, 0]}>
          <Ball r={0.095} />
          <group ref={kneeRef}>
            {/* shin, tapering forward into the boot */}
            <RoundedBox
              args={[0.26, 0.38, 0.27]}
              radius={0.11}
              smoothness={5}
              material={M.plating}
              position={[0, -0.21, 0.005]}
              castShadow
            />

            {/* Oversized boot — heel block plus a longer toe box. */}
            <RoundedBox
              args={[0.34, 0.3, 0.38]}
              radius={0.13}
              smoothness={5}
              material={M.plating}
              position={[0, -0.42, 0.02]}
              castShadow
            />
            <RoundedBox
              args={[0.31, 0.22, 0.32]}
              radius={0.1}
              smoothness={5}
              material={M.plating}
              position={[0, -0.47, 0.18]}
              castShadow
            />
            {/* sole highlight */}
            <mesh material={M.chromeDark} position={[0, -0.545, 0.09]}>
              <boxGeometry args={[0.21, 0.03, 0.38]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* the head                                                            */
/* ------------------------------------------------------------------ */

/**
 * The head is the character. It is NOT a sphere — the reference profile is a
 * teardrop: round and heavy at the jaw, sweeping up and tapering to a point at
 * the top-rear. A lathed profile gives that in one smooth surface; the whole
 * group is then tilted back so the point leans behind the face.
 */
const HEAD_PROFILE = (() => {
  const pts: THREE.Vector2[] = [];
  const prof: [number, number][] = [
    [0.0, -0.36], [0.15, -0.352], [0.26, -0.315], [0.335, -0.245],
    [0.375, -0.15], [0.388, -0.04], [0.375, 0.07], [0.335, 0.18],
    [0.268, 0.29], [0.17, 0.385], [0.07, 0.45], [0.0, 0.475],
  ];
  for (const [x, y] of prof) pts.push(new THREE.Vector2(x, y));
  return pts;
})();

function Head() {
  return (
    // tilted so the crest sweeps backward rather than straight up
    <group rotation={[-0.2, 0, 0]}>
      <mesh material={M.plating} castShadow>
        <latheGeometry args={[HEAD_PROFILE, 48]} />
      </mesh>

      {/* Face panel: a flat angled plate set into the front of the teardrop.
          It must break the lathe surface (~0.375 at this height) to be seen. */}
      <group rotation={[0.2, 0, 0]} position={[0, -0.05, 0.0]}>
        <RoundedBox
          args={[0.44, 0.34, 0.1]}
          radius={0.045}
          smoothness={5}
          material={M.faceGlass}
          position={[0, 0, 0.335]}
          rotation={[0.12, 0, 0]}
        />

        {/* cyan visor along the top of the panel, with a hooked outer end */}
        <mesh material={M.visor} position={[0, 0.075, 0.392]} rotation={[0.12, 0, 0]}>
          <boxGeometry args={[0.3, 0.032, 0.02]} />
        </mesh>
        {[-1, 1].map((sd) => (
          <mesh
            key={`vh${sd}`}
            material={M.visor}
            position={[sd * 0.163, 0.045, 0.388]}
            rotation={[0.12, 0, sd * 1.15]}
          >
            <boxGeometry args={[0.075, 0.03, 0.02]} />
          </mesh>
        ))}

        {/* amber brackets down the outer edges of the panel */}
        {[-1, 1].map((sd) => (
          <group key={`am${sd}`}>
            <mesh
              material={M.amber}
              position={[sd * 0.175, -0.035, 0.386]}
              rotation={[0.12, 0, sd * 0.1]}
            >
              <boxGeometry args={[0.032, 0.15, 0.02]} />
            </mesh>
            <mesh
              material={M.amber}
              position={[sd * 0.128, -0.115, 0.378]}
              rotation={[0.12, 0, sd * 1.25]}
            >
              <boxGeometry args={[0.03, 0.11, 0.02]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Large concentric side discs — a strong silhouette cue in the ref. */}
      {[-1, 1].map((sd) => (
        <group key={`ear${sd}`} position={[sd * 0.36, -0.05, 0.02]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={M.plating}>
            <cylinderGeometry args={[0.135, 0.135, 0.06, 32]} />
          </mesh>
          <mesh material={M.chromeDark} position={[sd * 0.02, 0, 0]}>
            <cylinderGeometry args={[0.095, 0.095, 0.05, 28]} />
          </mesh>
          <mesh material={M.chrome} position={[sd * 0.035, 0, 0]}>
            <cylinderGeometry args={[0.042, 0.042, 0.04, 20]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* scan rings (contact pose)                                           */
/* ------------------------------------------------------------------ */

function ScanRings({ active }: { active: boolean }) {
  const rings = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    rings.forEach((r, i) => {
      if (!r.current) return;
      // each ring runs the same 0→1 sweep, offset by a third
      const p = ((t * 0.55 + i / rings.length) % 1);
      const s = 0.25 + p * 1.5;
      r.current.scale.set(s, s, s);
      const mat = r.current.material as THREE.Material & { opacity: number };
      mat.opacity = active ? (1 - p) * 0.55 : 0;
      r.current.visible = active;
    });
  });

  return (
    <group position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {rings.map((r, i) => (
        <mesh key={i} ref={r}>
          <torusGeometry args={[0.5, 0.012, 10, 64]} />
          <meshBasicMaterial color="#3fe4d8" transparent opacity={0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* the assembled robot                                                 */
/* ------------------------------------------------------------------ */

export default function RobotModel({
  pose = "idle",
  paused = false,
  /** where the robot should end up standing */
  homeX = 0,
  /** where it starts — the walk-in begins off-screen at a negative x */
  startX = 0,
}: {
  pose?: Pose;
  paused?: boolean;
  homeX?: number;
  startX?: number;
}) {
  const pointer = usePointer();

  /**
   * One spring per tracked axis. Stiffness is staggered so the chain reads as
   * follow-through: the head leads, the torso trails it, the chassis trails
   * both. That lag is the difference between "a rig turning" and "someone
   * looking at you".
   */
  const sp = useRef({
    headY: new Spring(0, 265, 0.58),
    headX: new Spring(0, 230, 0.62),
    headZ: new Spring(0, 165, 0.66),
    torsoY: new Spring(0, 125, 0.68),
    torsoX: new Spring(0, 110, 0.72),
    torsoZ: new Spring(0, 100, 0.72),
    rootY: new Spring(0, 68, 0.78),
    rootX: new Spring(0, 58, 0.82),
    rootPY: new Spring(0, 54, 0.82),
    hipsY: new Spring(0, 70, 0.78),
    hipsZ: new Spring(0, 60, 0.8),
    legLY: new Spring(0, 90, 0.75),
    legRY: new Spring(0, 90, 0.75),
    legLZ: new Spring(0, 80, 0.8),
    legRZ: new Spring(0, 80, 0.8),
  });

  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const shoulderL = useRef<THREE.Group>(null);
  const shoulderR = useRef<THREE.Group>(null);
  const elbowL = useRef<THREE.Group>(null);
  const elbowR = useRef<THREE.Group>(null);
  const hipL = useRef<THREE.Group>(null);
  const hipR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  /** previous eased pointer, for the step impulse */
  const prevPx = useRef(0);
  const stepLift = useRef(0);

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime;
    const p = POSES[pose];
    const still = paused ? 0 : 1;

    // one clock: smooth the cursor here rather than in a separate rAF
    easePointer(pointer.current, d, 26);

    // The wave is layered on top of the pose target rather than baked into it,
    // so the arm swings while still easing into position.
    const waveSwing = p.waving && !paused ? -Math.sin(t * 7) * 0.34 : 0;

    /* --- walk cycle -------------------------------------------------
       Legs swing in antiphase, arms counter-swing against them, and each
       knee only bends on the back half of its stride — without that the
       legs read as a marionette rather than a walk. */
    // The reference doesn't march — it floats forward with the legs swinging
    // loosely underneath. Slower phase, shallower hips, far less knee bend.
    const wk = p.walking && !paused ? 1 : 0;
    const swing = Math.sin(t * 4.4);

    // The reference turns its whole chassis toward the cursor. The rotation is
    // split across three joints so it reads as a body turn with follow-through
    // rather than a single rigid yaw: torso leads, head over-rotates on top.
    // Cursor-driven offsets come from springs; driveJoint follows them closely
    // (high lambda) so it doesn't add a second lag on top.
    const px0 = pointer.current.x * still;
    const py0 = pointer.current.y * still;
    const tY = sp.current.torsoY.step(px0 * 0.42, d);
    const tX = sp.current.torsoX.step(-py0 * 0.18, d);
    const tZ = sp.current.torsoZ.step(px0 * -0.12, d);

    driveJoint(torso.current, p.torso, 30, d, {
      y: swing * 0.07 * wk + tY,
      x: tX,
      z: tZ,
    });

    /* --- the spiral -------------------------------------------------
       A real turn runs head -> chest -> pelvis -> feet, each rotating less
       than the one above it. The differential between chest and pelvis IS
       the twist; the feet then pivot and take a small step to carry it.   */
    if (hips.current) {
      hips.current.rotation.y = sp.current.hipsY.step(px0 * 0.07, d);
      hips.current.rotation.z = sp.current.hipsZ.step(-px0 * 0.05, d);
    }

    // A quick cursor move gives the trailing foot a little lift, so the
    // stance change reads as a step rather than a slide.
    const pxVel = (px0 - prevPx.current) / Math.max(d, 1e-4);
    prevPx.current = px0;
    stepLift.current = Math.max(
      stepLift.current * Math.exp(-6 * d),
      Math.min(Math.abs(pxVel) * 0.02, 0.06)
    );

    if (legL.current) {
      legL.current.rotation.y = sp.current.legLY.step(px0 * 0.42, d);
      legL.current.position.z = sp.current.legLZ.step(px0 * -0.2, d);
      legL.current.position.y = -0.46 + (px0 < 0 ? stepLift.current : 0);
    }
    if (legR.current) {
      legR.current.rotation.y = sp.current.legRY.step(px0 * 0.42, d);
      legR.current.position.z = sp.current.legRZ.step(px0 * 0.2, d);
      legR.current.position.y = -0.46 + (px0 > 0 ? stepLift.current : 0);
    }
    driveJoint(shoulderL.current, p.shoulderL, 8, d, { x: -swing * 0.26 * wk });
    driveJoint(shoulderR.current, p.shoulderR, 8, d, {
      z: waveSwing,
      x: swing * 0.26 * wk,
    });
    driveJoint(elbowL.current, p.elbowL, 8, d);
    driveJoint(elbowR.current, p.elbowR, 8, d, { x: waveSwing * 0.4 });
    driveJoint(hipL.current, p.hipL, 7, d, { x: swing * 0.4 * wk });
    driveJoint(hipR.current, p.hipR, 7, d, { x: -swing * 0.4 * wk });
    driveJoint(kneeL.current, p.kneeL, 7, d, { x: Math.max(0, -swing) * 0.34 * wk });
    driveJoint(kneeR.current, p.kneeR, 7, d, { x: Math.max(0, swing) * 0.34 * wk });

    // Head follows the pose, plus a cursor-tracking offset on top. `pointer`
    // comes from a window listener — see use-pointer.ts for why the canvas's
    // own state.pointer never updates here.
    const px = pointer.current.x;
    const py = pointer.current.y;

    // Layered slow sines (deliberately incommensurate periods so it never
    // visibly loops) keep the head alive between cursor moves.
    const idleYaw =
      still * (Math.sin(t * 0.37) * 0.045 + Math.sin(t * 0.83 + 1.7) * 0.022);
    const idlePitch =
      still * (Math.sin(t * 0.29 + 0.6) * 0.03 + Math.sin(t * 0.71) * 0.015);
    const hY = sp.current.headY.step(px * 0.5 * still + idleYaw, d);
    const hX = sp.current.headX.step(-py * 0.4 * still + idlePitch, d);
    const hZ = sp.current.headZ.step(px * 0.16 * still, d);
    driveJoint(head.current, p.head, 34, d, { x: hX, y: hY, z: hZ });

    // Breathing bob, plus the double-bounce that comes with the walk cycle.
    if (body.current) {
      const breathe = Math.sin(t * 1.5) * 0.022 * p.bob * still;
      const stride = Math.sin(t * 2.2) * 0.07 * wk;
      body.current.position.y = damp(body.current.position.y, p.lift + breathe + stride, 6, d);
      body.current.rotation.z = damp(
        body.current.rotation.z,
        Math.sin(t * 0.9) * 0.012 * p.bob * still,
        3,
        d
      );
    }

    // Whole model turns toward the cursor, leans into it, and walks to its mark.
    if (root.current) {
      root.current.rotation.y = sp.current.rootY.step(px * 0.3 * still, d);
      root.current.position.x = homeX + sp.current.rootX.step(px * 0.22 * still, d);
      root.current.position.y = sp.current.rootPY.step(py * 0.08 * still, d);
    }
  });

  return (
    <group ref={root} position={[startX, 0, 0]}>
      <group ref={body}>
        {/*
          Pelvis and legs are a SIBLING of the chest, not a child of it. That
          is what lets the chest twist while the feet stay planted — with the
          legs parented to the torso they can only ever rotate with it, which
          is why the whole body used to swing as one rigid piece.
        */}
        <group ref={hips}>
          <Ball r={0.13} position={[0, -0.36, 0]} />
          <Leg side={-1} hipRef={hipL} kneeRef={kneeL} legRef={legL} />
          <Leg side={1} hipRef={hipR} kneeRef={kneeR} legRef={legR} />
        </group>

        <group ref={torso}>
          {/* ---- chest ---- */}
          <RoundedBox
            args={[0.6, 0.46, 0.4]}
            radius={0.12}
            smoothness={6}
            material={M.plating}
            position={[0, 0.18, 0]}
            castShadow
          />
          {/* chest bevels so it isn't a plain box */}
          <mesh material={M.platingSoft} position={[0, 0.38, 0.02]} scale={[0.92, 0.5, 0.95]} castShadow>
            <sphereGeometry args={[0.34, 28, 20]} />
          </mesh>
          {/* teal hex chest light */}
          <mesh material={M.visor} position={[0, 0.2, 0.228]} rotation={[0, 0, Math.PI / 6]}>
            <torusGeometry args={[0.1, 0.016, 3, 6]} />
          </mesh>

          {/* abdomen tapering to the waist */}
          <RoundedBox
            args={[0.4, 0.3, 0.32]}
            radius={0.11}
            smoothness={5}
            material={M.plating}
            position={[0, -0.16, 0]}
            castShadow
          />


          {/* ---- neck + head ---- */}
          <mesh material={M.chromeDark} position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.09, 0.11, 0.12, 20]} />
          </mesh>
          <group ref={head} position={[0, 0.92, 0]}>
            <Head />
            <ScanRings active={!!POSES[pose].scanning} />
          </group>

          {/* ---- limbs ---- */}
          <Arm side={-1} shoulderRef={shoulderL} elbowRef={elbowL} />
          <Arm side={1} shoulderRef={shoulderR} elbowRef={elbowR} />

        </group>
      </group>
    </group>
  );
}
