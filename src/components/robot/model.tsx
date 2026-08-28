"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { POSES, type Pose, type Joint } from "./poses";
import { usePointer, easePointer } from "./use-pointer";
import { Spring, JointSpring } from "./spring";
import { MOVES, DANCE_RESET, sampleMove, type DanceSample } from "./dance";
import * as M from "./materials";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Springs a joint toward its pose target, then adds the live offset on top.
 *
 * The pose and the offset need opposite response times. A pose change is a
 * deliberate half-second movement; an offset (cursor tracking, walk swing, the
 * wave) is already smooth and only needs passing straight through. This used to
 * damp their SUM with a single lambda, so whichever job won, the other broke —
 * the head and torso ran at lambda 30+ for the offset's sake, which collapsed
 * every pose change into 83ms. At 12fps that is one frame: the "pop".
 *
 * Keeping them separate also means an offset can no longer be attenuated by the
 * pose filter (the walk swing was losing 15% of its amplitude that way).
 */
function driveJoint(
  obj: THREE.Object3D | null,
  target: Joint | undefined,
  pose: JointSpring,
  dt: number,
  extra?: { x?: number; y?: number; z?: number },
  /**
   * Dance override. The timeline is authored at specific times — a kick that
   * launches in 120ms — so it is written STRAIGHT to the rotation rather than
   * through the pose spring, which has a t90 of ~0.45s and would flatten every
   * accent into mush. `w` crossfades between the two so entering and leaving a
   * move is still smooth. The springs keep running underneath the whole time,
   * so whatever pose was active is already settled when the dance hands back.
   */
  dance?: { j: { x: number; y: number; z: number }; w: number }
) {
  if (!obj || !target) return;
  const px = pose.x.step(target.x ?? 0, dt);
  const py = pose.y.step(target.y ?? 0, dt);
  const pz = pose.z.step(target.z ?? 0, dt);
  const w = dance?.w ?? 0;
  const k = 1 - w;
  obj.rotation.x = px * k + (dance ? dance.j.x * w : 0) + (extra?.x ?? 0) * k;
  obj.rotation.y = py * k + (dance ? dance.j.y * w : 0) + (extra?.y ?? 0) * k;
  obj.rotation.z = pz * k + (dance ? dance.j.z * w : 0) + (extra?.z ?? 0) * k;
}

/**
 * Rectifier with a rounded corner. `Math.max(0, v)` has a velocity
 * discontinuity at zero, which the old pose filter used to hide; passed
 * straight through it shows up as a hitch in the knee at each stride.
 */
function softRect(v: number) {
  const k = 0.18;
  return 0.5 * (v + Math.sqrt(v * v + k * k)) - k / 2;
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
    <group position={[side * 0.315, 0.3, 0]}>
      {/* shoulder ball, and the pivot everything below hangs from */}
      <Ball r={0.105} />
      <group ref={shoulderRef}>
        {/* Upper arm is a LEAF, not a box. In the reference both arm segments
            are big rounded blades with a thin chrome joint between them — the
            mass is the point, and a uniform-width box throws it away. */}
        <group position={[side * 0.035, -0.25, 0]} rotation={[0, 0, side * 0.05]}>
          <mesh material={M.plating} scale={[0.58, 1.2, 0.46]} castShadow>
            <sphereGeometry args={[0.24, 28, 22]} />
          </mesh>
        </group>
        {/* shoulder cap over the top of it */}
        <mesh material={M.platingSoft} position={[side * 0.05, -0.06, 0]} scale={[1, 0.86, 1]} castShadow>
          <sphereGeometry args={[0.16, 22, 18]} />
        </mesh>

        {/* Elbow: visible chrome mechanism, which is what sells the two blades
            as separate articulated parts rather than one lumpy arm. */}
        <group position={[side * 0.05, -0.48, 0]}>
          <Ball r={0.088} />
          <mesh material={M.chromeDark} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.084, 0.026, 12, 24]} />
          </mesh>
          <group ref={elbowRef}>
            {/* forearm blade — the dominant mass of the arm */}
            <group position={[side * 0.075, -0.28, 0]} rotation={[0, 0, side * -0.14]}>
              <mesh material={M.plating} scale={[0.74, 1.6, 0.44]} castShadow>
                <sphereGeometry args={[0.3, 30, 24]} />
              </mesh>
              {/* taper to the wrist */}
              <mesh
                material={M.plating}
                position={[0, -0.4, 0]}
                rotation={[Math.PI, 0, 0]}
                scale={[1, 1, 0.5]}
                castShadow
              >
                <coneGeometry args={[0.19, 0.32, 22]} />
              </mesh>
            </group>
            {/* amber accent stripe on the outer blade */}
            <mesh material={M.amber} position={[side * 0.16, -0.24, 0.02]} rotation={[0, 0, side * -0.14]}>
              <boxGeometry args={[0.008, 0.13, 0.04]} />
            </mesh>

            {/* wrist cuff */}
            <mesh material={M.chromeDark} position={[side * 0.055, -0.58, 0]}>
              <cylinderGeometry args={[0.062, 0.072, 0.055, 16]} />
            </mesh>

            {/* Hand: a small chrome knuckle with three thin curved talons. */}
            <mesh material={M.chromeDark} position={[side * 0.085, -0.7, 0.01]} castShadow>
              <sphereGeometry args={[0.068, 16, 14]} />
            </mesh>
            {[-1, 0, 1].map((f) => (
              <mesh
                key={f}
                material={M.chrome}
                position={[side * 0.085 + f * 0.04, -0.795, 0.014 + Math.abs(f) * -0.012]}
                rotation={[Math.PI - 0.2, 0, f * 0.3]}
                castShadow
              >
                <coneGeometry args={[0.023, 0.2, 9]} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  );
}

/**
 * One leg.
 *
 * The reference shin is a single long WEDGE — wide at the knee, narrowing all
 * the way to the ankle — over a sculpted boot with a pointed toe. Ours used to
 * be a stack of equal-width rounded boxes, which is the classic segmented-tube
 * look and the last big "toy" cue left after the head. A tapered cylinder,
 * squashed front-to-back, gives the wedge in one smooth piece.
 */
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
      <Ball r={0.105} />
      <group ref={hipRef}>
        {/* Thigh is thin exposed chrome hardware. Keeping it slim is what makes
            the shin below it read as a heavy mass rather than more of the same. */}
        <mesh material={M.chrome} position={[0, -0.115, 0]} castShadow>
          <cylinderGeometry args={[0.084, 0.076, 0.19, 20]} />
        </mesh>
        <mesh material={M.chromeDark} position={[0, -0.06, 0]}>
          <torusGeometry args={[0.088, 0.017, 10, 20]} />
        </mesh>

        {/* knee */}
        <group position={[0, -0.235, 0]}>
          <Ball r={0.1} />
          <group ref={kneeRef}>
            {/* The wedge. Wide at the knee and heavy — in the reference this
                single mass is most of the leg, so making it broad matters more
                than making it long. */}
            <group scale={[1, 1, 0.88]}>
              <mesh material={M.plating} position={[0, -0.29, 0.01]} castShadow>
                <cylinderGeometry args={[0.205, 0.115, 0.52, 30]} />
              </mesh>
            </group>
            {/* shallow panel seam down the outer face */}
            <mesh
              material={M.platingSoft}
              position={[side * 0.155, -0.26, 0.03]}
              rotation={[0, 0, side * 0.05]}
            >
              <boxGeometry args={[0.012, 0.28, 0.11]} />
            </mesh>

            {/* Boot: the wedge flares back out into the foot rather than
                sitting on it as a separate block. */}
            <RoundedBox
              args={[0.27, 0.22, 0.3]}
              radius={0.09}
              smoothness={5}
              material={M.plating}
              position={[0, -0.6, 0.0]}
              castShadow
            />
            <RoundedBox
              args={[0.235, 0.16, 0.28]}
              radius={0.07}
              smoothness={5}
              material={M.plating}
              position={[0, -0.645, 0.16]}
              castShadow
            />
            {/* the toe point */}
            <mesh
              material={M.plating}
              position={[0, -0.655, 0.29]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[1, 1, 0.55]}
              castShadow
            >
              <coneGeometry args={[0.112, 0.16, 18]} />
            </mesh>
            {/* pale sole */}
            <mesh material={M.chromeDark} position={[0, -0.707, 0.085]}>
              <boxGeometry args={[0.215, 0.03, 0.45]} />
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
/**
 * The head silhouette, as a lathe profile from chin to crown.
 *
 * The reference head is a SHIELD, not a teardrop: broad and round across the
 * crown, tapering down to a rounded point at the chin. We had it upside down —
 * widest at the jaw and pointed at the top-rear — which is most of why ours
 * read as a toy while theirs reads as a helmet. Radius peaks just above centre
 * and falls away in both directions, faster downward than up.
 */
const HEAD_PROFILE = (() => {
  const prof: [number, number][] = [
    [0.0, -0.46], [0.105, -0.432], [0.192, -0.375], [0.262, -0.30],
    [0.322, -0.205], [0.365, -0.095], [0.392, 0.02], [0.404, 0.13],
    [0.398, 0.235], [0.372, 0.325], [0.322, 0.40], [0.242, 0.455],
    [0.135, 0.492], [0.0, 0.508],
  ];
  return prof.map(([x, y]) => new THREE.Vector2(x, y));
})();

function Head() {
  // The face is asymmetric: a big lens on one side, the chevron on the other.
  // That asymmetry is a large part of why the reference face reads as designed
  // rather than as a symmetric mask.
  const LENS = -1;
  const MARK = 1;

  return (
    // tilted back a little so the crown leads and the chin tucks in
    <group rotation={[-0.12, 0, 0]}>
      {/* Wider than it is tall and flattened front-to-back. The lathe profile
          alone came out egg-shaped; the reference head is a broad shield. */}
      <group scale={[1.16, 0.94, 0.87]}>
        <mesh material={M.plating} castShadow>
          <latheGeometry args={[HEAD_PROFILE, 56]} />
        </mesh>
      </group>

      {/* The lens. In the reference this sits on the FACE, not on the side of
          the skull — a large ringed disc with a bright dome standing proud of
          it. Putting it out on the ear line buried it inside the shell. */}
      <group position={[LENS * 0.17, 0.075, 0.3]} rotation={[0.04, LENS * 0.3, 0]}>
        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={M.platingSoft} castShadow>
            <cylinderGeometry args={[0.185, 0.192, 0.05, 40]} />
          </mesh>
          <mesh material={M.chromeDark} position={[0, 0.028, 0]}>
            <torusGeometry args={[0.15, 0.011, 10, 40]} />
          </mesh>
          <mesh material={M.chromeDark} position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.112, 0.115, 0.032, 32]} />
          </mesh>
          <mesh material={M.chrome} position={[0, 0.055, 0]} castShadow>
            <sphereGeometry args={[0.075, 24, 20]} />
          </mesh>
        </group>
      </group>

      {/* Angular chevron on the opposite cheek. */}
      <group position={[MARK * 0.215, 0.02, 0.315]} rotation={[0.04, MARK * 0.44, MARK * 0.1]}>
        <RoundedBox
          args={[0.17, 0.235, 0.05]}
          radius={0.02}
          smoothness={5}
          material={M.faceGlass}
        />
        <mesh material={M.visor} position={[-0.02, 0.062, 0.032]}>
          <boxGeometry args={[0.1, 0.026, 0.016]} />
        </mesh>
        <mesh material={M.visor} position={[-0.062, -0.008, 0.032]} rotation={[0, 0, 1.32]}>
          <boxGeometry args={[0.12, 0.024, 0.016]} />
        </mesh>
        <mesh material={M.amber} position={[0.012, 0.0, 0.03]}>
          <boxGeometry args={[0.082, 0.022, 0.014]} />
        </mesh>
        <mesh material={M.amber} position={[-0.028, -0.066, 0.03]} rotation={[0, 0, 1.32]}>
          <boxGeometry args={[0.098, 0.02, 0.014]} />
        </mesh>
      </group>

      {/* Small side plates, kept flush so they read as hardware not ears. */}
      {[-1, 1].map((sd) => (
        <group key={`sp${sd}`} position={[sd * 0.44, 0.05, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <mesh material={M.chromeDark}>
            <cylinderGeometry args={[0.062, 0.068, 0.05, 20]} />
          </mesh>
        </group>
      ))}

      {/* Thin rod off one side. */}
      <group position={[MARK * 0.47, 0.06, -0.02]} rotation={[0, 0, MARK * -1.3]}>
        <mesh material={M.chromeDark}>
          <cylinderGeometry args={[0.01, 0.01, 0.18, 10]} />
        </mesh>
      </group>
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
  /** bump on every like — each bump fires the next move in the sequence */
  danceGen = 0,
}: {
  pose?: Pose;
  paused?: boolean;
  homeX?: number;
  startX?: number;
  danceGen?: number;
}) {
  const pointer = usePointer();

  /* Like-reaction state. `idx` walks down MOVES so repeated likes escalate;
     it resets to the top once the visitor has left it alone for a beat. */
  const dance = useRef({ active: false, t: 0, idx: 0, since: 99, gen: danceGen });

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

  /**
   * Pose springs — one per joint, deliberately an order of magnitude softer
   * than the cursor springs above. A pose change is a movement the visitor is
   * meant to watch happen: it accelerates out of the old pose, arrives, and
   * settles just past the mark. Limbs travel furthest so they get the longest
   * arc; the head and chest lead slightly, which is what reads as the rest of
   * the body following them.
   */
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
  /** `lift` and `bob` are pose values too, so they ease like one. */
  const liftS = useRef(new Spring(0, 30, 0.68));
  const bobS = useRef(new Spring(1, 18, 0.9));

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

    /* ---- like reaction ------------------------------------------------- */
    const D = dance.current;
    D.since += d;
    if (danceGen !== D.gen) {
      D.gen = danceGen;
      // Any like inside the reset window advances to the next move; one after
      // a pause starts again from the kick. Gating this on `D.active` was
      // wrong — moves are shorter than the window, so once one finished the
      // counter stalled and every further like replayed the kick.
      D.idx = D.since > DANCE_RESET ? 0 : Math.min(D.idx + 1, MOVES.length - 1);
      D.active = true;
      D.t = 0;
      D.since = 0;
    }

    let dw = 0;
    let ds: DanceSample | null = null;
    if (D.active && !paused) {
      const move = MOVES[D.idx];
      D.t += d;
      if (D.t >= move.dur) {
        D.active = false;
      } else {
        ds = sampleMove(move, D.t);
        // Fade in and out at the ends so the hand-off to the idle pose has no
        // step in it. 90ms is short enough to keep the kick's attack.
        const IN = 0.09;
        const OUT = 0.16;
        dw = Math.min(1, D.t / IN, Math.max(0, move.dur - D.t) / OUT);
      }
    }
    const dj = (k: keyof DanceSample["joints"]) =>
      ds ? { j: ds.joints[k], w: dw } : undefined;

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

    driveJoint(torso.current, p.torso, ps.current.torso, d, {
      y: swing * 0.07 * wk + tY,
      x: tX,
      z: tZ,
    }, dj("torso"));

    /* --- the spiral -------------------------------------------------
       A real turn runs head -> chest -> pelvis -> feet, each rotating less
       than the one above it. The differential between chest and pelvis IS
       the twist; the feet then pivot and take a small step to carry it.   */
    // A standing body shifts its weight from hip to hip. The chest sway alone
    // reads as a metronome; moving the pelvis on its own long period is what
    // makes a stationary figure look like it is standing rather than parked.
    const weightShift = still * Math.sin(t * 0.74 + 0.9) * 0.022 * (1 - wk);

    if (hips.current) {
      hips.current.rotation.y = sp.current.hipsY.step(px0 * 0.07, d);
      hips.current.rotation.z = sp.current.hipsZ.step(-px0 * 0.05 + weightShift, d);
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
    const S = ps.current;
    driveJoint(shoulderL.current, p.shoulderL, S.shoulderL, d, { x: -swing * 0.26 * wk }, dj("shoulderL"));
    driveJoint(shoulderR.current, p.shoulderR, S.shoulderR, d, {
      z: waveSwing,
      x: swing * 0.26 * wk,
    }, dj("shoulderR"));
    driveJoint(elbowL.current, p.elbowL, S.elbowL, d, undefined, dj("elbowL"));
    driveJoint(elbowR.current, p.elbowR, S.elbowR, d, { x: waveSwing * 0.4 }, dj("elbowR"));
    driveJoint(hipL.current, p.hipL, S.hipL, d, { x: swing * 0.4 * wk }, dj("hipL"));
    driveJoint(hipR.current, p.hipR, S.hipR, d, { x: -swing * 0.4 * wk }, dj("hipR"));
    driveJoint(kneeL.current, p.kneeL, S.kneeL, d, { x: softRect(-swing) * 0.34 * wk }, dj("kneeL"));
    driveJoint(kneeR.current, p.kneeR, S.kneeR, d, { x: softRect(swing) * 0.34 * wk }, dj("kneeR"));

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
    driveJoint(head.current, p.head, ps.current.head, d, { x: hX, y: hY, z: hZ }, dj("head"));

    // Breathing bob, plus the double-bounce that comes with the walk cycle.
    // `lift` and `bob` are pose values so they ease; the oscillators ride on
    // top at full amplitude rather than being filtered along with them.
    if (body.current) {
      const bob = bobS.current.step(p.bob, d);
      const breathe = Math.sin(t * 1.5) * 0.022 * bob * still;
      const stride = Math.sin(t * 2.2) * 0.07 * wk;
      const baseLift = liftS.current.step(p.lift, d) + breathe + stride;
      const k = 1 - dw;
      body.current.position.y = ds ? baseLift * k + ds.lift * dw : baseLift;

      // Whole-body pitch is what lets the dive fold FLAT. Bending only at the
      // waist tops out well short of horizontal — the reference clearly rotates
      // the entire figure over its feet, so this rides on the body group.
      body.current.rotation.x = ds ? ds.bodyPitch * dw : 0;
      body.current.rotation.y = ds ? ds.bodyYaw * dw : 0;
      // Weight shift, on a much longer period than the breath and deliberately
      // incommensurate with it, so the idle never settles into a visible loop.
      const sway = Math.sin(t * 0.58) * 0.016 * bob * still;
      body.current.rotation.z = ds ? sway * k + ds.bodyRoll * dw : sway;
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
          {/* ---- chest ----
              The reference torso is a WEDGE: broad across the shoulders and
              tapering to a narrow waist, so the small body throws the head and
              the limb masses into relief. A rounded box of even width reads as
              a fridge by comparison. A squashed, tapered cylinder gives the
              wedge with a soft enough shoulder line to match the plating. */}
          <group scale={[1, 1, 0.72]}>
            <mesh material={M.plating} position={[0, 0.2, 0]} castShadow>
              <cylinderGeometry args={[0.33, 0.185, 0.52, 30]} />
            </mesh>
          </group>
          {/* shoulder yoke across the top */}
          <mesh
            material={M.platingSoft}
            position={[0, 0.42, 0]}
            scale={[1, 0.44, 0.72]}
            castShadow
          >
            <sphereGeometry args={[0.34, 30, 22]} />
          </mesh>
          {/* teal hex chest sigil */}
          <mesh material={M.visor} position={[0, 0.21, 0.208]} rotation={[0, 0, Math.PI / 6]}>
            <torusGeometry args={[0.088, 0.015, 3, 6]} />
          </mesh>

          {/* waist: narrow, so the pelvis ball below reads as a joint */}
          <group scale={[1, 1, 0.78]}>
            <mesh material={M.plating} position={[0, -0.13, 0]} castShadow>
              <cylinderGeometry args={[0.175, 0.15, 0.3, 24]} />
            </mesh>
          </group>


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
