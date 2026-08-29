"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { POSES, type Pose, type Joint } from "./poses";
import { usePointer, easePointer } from "./use-pointer";
import { Spring, JointSpring } from "./spring";
import { driveJoint, softRect } from "./rig";
import { MOVES, DANCE_RESET, sampleMove, type DanceSample } from "./dance";
import {
  Gait,
  makeGait,
  REF_STEP_OVER_LEG,
  BOB_OVER_LEG,
} from "./locomotion";
import * as M from "./materials";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

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
  ankleRef,
  legRef,
}: {
  side: -1 | 1;
  hipRef: React.RefObject<THREE.Group>;
  kneeRef: React.RefObject<THREE.Group>;
  /** the foot's own pivot — see the note on the group below */
  ankleRef: React.RefObject<THREE.Group>;
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

            {/* The ankle.
                There was no joint here at all, so the boot was welded to the
                shin: every degree the knee bent, the sole tipped with it and
                the toe carved through the floor. A foot needs its own pivot
                for the same reason the pelvis needs to be a sibling of the
                chest — without it the motion is not merely wrong, it is not
                expressible.

                Sitting at the shin/boot junction. Child offsets are the old
                ones plus 0.52, so the rest pose is unchanged to the last
                decimal and the measured ROBOT_SOLE (and with it HUMAN_FIT)
                still holds. */}
            <group ref={ankleRef} position={[0, -0.52, 0]}>
              {/* Boot: the wedge flares back out into the foot rather than
                  sitting on it as a separate block. */}
              <RoundedBox
                args={[0.27, 0.22, 0.3]}
                radius={0.09}
                smoothness={5}
                material={M.plating}
                position={[0, -0.08, 0.0]}
                castShadow
              />
              <RoundedBox
                args={[0.235, 0.16, 0.28]}
                radius={0.07}
                smoothness={5}
                material={M.plating}
                position={[0, -0.125, 0.16]}
                castShadow
              />
              {/* the toe point */}
              <mesh
                material={M.plating}
                position={[0, -0.135, 0.29]}
                rotation={[Math.PI / 2, 0, 0]}
                scale={[1, 1, 0.55]}
                castShadow
              >
                <coneGeometry args={[0.112, 0.16, 18]} />
              </mesh>
              {/* pale sole */}
              <mesh material={M.chromeDark} position={[0, -0.187, 0.085]}>
                <boxGeometry args={[0.215, 0.03, 0.45]} />
              </mesh>
            </group>
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

/**
 * Measured off the rig: hip pivot to knee pivot, knee pivot to sole. The stride
 * is the reference's own ratio of step to leg length rather than a chosen
 * number — 0.45 was a guess, and at 0.60 leg-lengths it was a shuffle next to
 * the capture's 1.10.
 *
 * Module scope, NOT inside the component. `useRef(expr)` evaluates `expr` on
 * every render and throws the result away after the first, so building the
 * profile inline ran `makeGait`'s 256-step bisection — about 10k iterations —
 * on every single render of this component. The comment in locomotion.ts
 * claiming it cost that "once, at module load" was only true of where the code
 * deserved to live, not where it was.
 */
const THIGH = 0.235;
const SHIN = 0.52;
const LEG = THIGH + SHIN;
const GAIT_PROFILE = makeGait(THIGH, SHIN, LEG * REF_STEP_OVER_LEG);

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
    /**
     * The shoulders trail the chest — one more level of the same stagger.
     *
     * A softer copy of the torso yaw; the shoulders are driven by the
     * DIFFERENCE between the two, so they arrive after it and settle after it.
     * This was a known gap: every level from head to pelvis had its own
     * stiffness, but the arms were welded to the ribcage, so the upper body
     * turned as a single plate. It is the same idea as an additive clip in
     * `webgl_animation_skinning_additive_blending` — a delta riding on the
     * base, at its own weight — which is why it goes in the additive slot.
     */
    armLag: new Spring(0, 42, 0.78),
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

  /**
   * The walk, fitted to this rig's actual bones.
   *
   *   thigh = hip pivot (leg group, y -0.46) to knee pivot   -> 0.235
   *   shin  = knee pivot to ANKLE pivot (y -0.52)            -> 0.520
   *
   * It is the ankle, not the sole, because the ankle keeps the foot level:
   * everything below it stays vertical and so contributes no horizontal
   * travel. Measuring to the sole instead overstates the pendulum by 39% and
   * puts the skate straight back in.
   */
  const gait = useRef(new Gait(GAIT_PROFILE));
  // Head yaw over pelvis yaw, measured on the capture: the head's own local
  // yaw range is 0.109 rad against a 0.254 rad pelvis. Replaces a 1.15 that
  // swung the head nearly three times as far as the reference does.
  const HEAD_OVER_PELVIS = 0.43;

  /** Walk-in translation. `x` is an offset from homeX; `v` is its speed. */
  const travel = useRef({ x: startX, v: 0 });

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
  const ankleL = useRef<THREE.Group>(null);
  const ankleR = useRef<THREE.Group>(null);
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

    /**
     * Weight of the additive layer (cursor tracking, idle micro-motion).
     *
     * `webgl_animation_skinning_additive_blending` keeps its additive clips
     * playing at their own weight regardless of which base action is running —
     * that is the whole point of the technique. Ours were multiplied by
     * `1 - danceWeight`, so a like froze the head mid-track and the figure
     * stopped looking at you. It stays alive here, just quieter: 0.45 at full
     * dance weight, because something mid-kick genuinely is not tracking you
     * precisely.
     */
    const addGain = 1 - dw * 0.55;

    // one clock: smooth the cursor here rather than in a separate rAF
    easePointer(pointer.current, d, 26);

    // The wave is layered on top of the pose target rather than baked into it,
    // so the arm swings while still easing into position.
    const waveSwing = p.waving && !paused ? -Math.sin(t * 7) * 0.34 : 0;

    /* --- walk cycle ---------------------------------------------------
       See locomotion.ts. Three things replaced here:

         `Math.sin(t * 4.4)` -> a phase this rig owns, advanced by DISTANCE
         travelled, so the feet cannot slide over the ground;

         `p.walking ? 1 : 0`  -> a weight that ramps in over 0.4s and out over
         0.7s, and defers the ramp-out until the next foot plant, which is what
         `synchronizeCrossFade` does in the reference example;

         a symmetric sine     -> curves measured off the Xbot walk capture,
         with an ankle, so the sole stays flat on the floor and the knee never
         locks the way a hand-written one does.                              */
    const wantWalk = !!p.walking && !paused;

    // Walk-in translation. This used to be set once as the group's initial
    // position and then overwritten by the frame loop on the very first frame,
    // so the robot teleported to its mark and marched on the spot for 2.6s.
    const W = travel.current;
    if (wantWalk) {
      const remain = -W.x;
      // Cruise, easing down over the last stretch so it arrives rather than
      // stopping dead. The gait reads this speed, so slowing down shortens
      // the stride by itself.
      // Cruise speed is the reference's own, made dimensionless so it means
      // the same thing on a different-sized figure: the capture covers 2.27 leg
      // lengths a second, and this rig's leg is LEG, so CRUISE = 2.27 * LEG.
      // Cadence then falls out at the reference's 2.07 steps/sec instead of
      // being tuned to hit a stopwatch — 1.25 was set when the stride was 0.45,
      // and against the measured stride it would have strolled in at 1.5
      // steps/sec, well under the capture the curves come from.
      const CRUISE = 2.27 * LEG;
      const sp = Math.min(CRUISE, Math.max(0.25, Math.abs(remain) * 2.8));
      const move = Math.sign(remain) * sp * d;
      W.x = Math.abs(move) >= Math.abs(remain) ? 0 : W.x + move;
      W.v = Math.abs(remain) < 1e-4 ? 0 : sp;
    } else {
      W.x = THREE.MathUtils.damp(W.x, 0, 3, d);
      W.v = 0;
    }

    const G = gait.current;
    G.request(wantWalk);
    const wk = G.update(d, W.v);
    const gl = G.legs();
    const gs = G.secondary();
    const ga = G.arms();
    const gt = G.torso();

    // Contralateral swing: the RIGHT arm goes forward with the LEFT leg. The
    // arms were being driven off the same sine as the legs with only a sign
    // flip, which is the same thing by accident and breaks the moment the leg
    // curve stops being a sine.
    // Pelvis and chest counter-rotate around the spine. This was missing
    // entirely — the hips only ever yawed toward the cursor — and it is the
    // difference between a walk and a pair of legs moving.
    //
    // Straight off the capture, 0.2539 rad range. The 0.17-of-the-hip-difference
    // this replaces was a guess that over-rotated the pelvis by 60%, and being a
    // multiple of the hip it would have scaled with the robot's leg proportions
    // rather than staying the reference's own angle.
    const pelvisYaw = gt.pelvisYaw * wk;

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

    // The chest counter-rotates against the pelvis, a little more than the
    // pelvis turns, so the spine is visibly wound. Cursor tracking sits in the
    // ADDITIVE slot: the figure keeps facing you through a dance.
    driveJoint(
      torso.current,
      p.torso,
      ps.current.torso,
      d,
      { y: gt.chestYaw * wk },
      dj("torso"),
      { x: tX * addGain, y: tY * addGain, z: tZ * addGain }
    );

    /* --- the spiral -------------------------------------------------
       A real turn runs head -> chest -> pelvis -> feet, each rotating less
       than the one above it. The differential between chest and pelvis IS
       the twist; the feet then pivot and take a small step to carry it.   */
    // A standing body shifts its weight from hip to hip. The chest sway alone
    // reads as a metronome; moving the pelvis on its own long period is what
    // makes a stationary figure look like it is standing rather than parked.
    const weightShift = still * Math.sin(t * 0.74 + 0.9) * 0.022 * (1 - wk);

    if (hips.current) {
      hips.current.rotation.y = sp.current.hipsY.step(px0 * 0.07, d) + pelvisYaw;
      // Pelvic drop: the swinging side falls a little, the stance side holds.
      // Real walking has this and it is most of why a walk looks weighted.
      // Amplitude is the capture's measured pelvic list, 0.2018 rad range.
      // The SHAPE stays a sine and the SIGN stays as reviewed: the capture's
      // roll is anti-correlated with this sine (-0.80), but that is the
      // capture's own left/right frame, not evidence this rig lists the wrong
      // way. Only the magnitude was measurable without re-deriving the frame,
      // so only the magnitude changed — it was half the real value.
      const drop = Math.sin(2 * Math.PI * G.phase) * 0.1009 * wk;
      hips.current.rotation.z =
        sp.current.hipsZ.step(-px0 * 0.05 + weightShift, d) + drop;
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
    // What the chest has already done, minus what the shoulders have caught up
    // with. A lag, not a scaled copy: a scaled copy arrives at the same moment.
    const armLag = (tY - sp.current.armLag.step(tY, d)) * addGain;
    // Right arm forward with the left leg, and vice versa.
    // Absolute swing angles from the capture (0.726 rad range), NOT a multiple
    // of this rig's hip. The robot's thigh is short, so it needs a 1.28 rad hip
    // swing to cover the same ground the reference covers in 0.89 — scaling the
    // arms off the hip would have swung them 44% wider than the reference for
    // no reason other than the leg's proportions. An angle is an angle.
    driveJoint(shoulderL.current, p.shoulderL, S.shoulderL, d,
      { x: ga.left.shoulder * wk }, dj("shoulderL"), { x: armLag * 0.55 });
    driveJoint(shoulderR.current, p.shoulderR, S.shoulderR, d, {
      z: waveSwing,
      x: ga.right.shoulder * wk,
    }, dj("shoulderR"), { x: -armLag * 0.55 });
    // The elbow closes a little on the forward swing and opens behind, which
    // is what stops the arms reading as two hanging planks.
    // The `walk` pose holds the elbows at 0.46 rad, near the capture's own
    // 0.626 hold, so only the modulation is added here. The old drive was
    // `max(0, -hip) * 0.9`: rectified, so it sat at exactly zero for half of
    // every cycle and then opened 0.9 rad in the other half. The capture
    // modulates 0.40 rad and never rests.
    driveJoint(elbowL.current, p.elbowL, S.elbowL, d,
      { x: ga.left.elbow * wk }, dj("elbowL"));
    driveJoint(elbowR.current, p.elbowR, S.elbowR, d, {
      x: waveSwing * 0.4 + ga.right.elbow * wk,
    }, dj("elbowR"));

    driveJoint(hipL.current, p.hipL, S.hipL, d, { x: gl.left.hip * wk }, dj("hipL"));
    driveJoint(hipR.current, p.hipR, S.hipR, d, { x: gl.right.hip * wk }, dj("hipR"));
    driveJoint(kneeL.current, p.kneeL, S.kneeL, d, { x: gl.left.knee * wk }, dj("kneeL"));
    driveJoint(kneeR.current, p.kneeR, S.kneeR, d, { x: gl.right.knee * wk }, dj("kneeR"));
    // The ankles have no pose channel — they exist only to keep the sole flat,
    // so they are driven directly and eased back to neutral as the walk fades.
    if (ankleL.current) ankleL.current.rotation.x = gl.left.ankle * wk;
    if (ankleR.current) ankleR.current.rotation.x = gl.right.ankle * wk;

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
    // Additive, not base: the head keeps tracking you mid-dance, at a reduced
    // weight because a figure throwing itself around is not looking at you
    // very precisely.
    //
    // The base channel counter-rotates against the chest. The head is a CHILD
    // of the torso, so its absolute yaw is the sum: the chest is at -1.25
    // pelvisYaw, and +1.15 here leaves the head at -0.10, i.e. very nearly
    // pointing straight ahead while the shoulders swing underneath it. That is
    // what a walking person does, and it is the top of the same head -> chest
    // -> pelvis chain the cursor tracking already uses.
    driveJoint(
      head.current,
      p.head,
      ps.current.head,
      d,
      { y: pelvisYaw * HEAD_OVER_PELVIS },
      dj("head"),
      { x: hX * addGain, y: hY * addGain, z: hZ * addGain }
    );

    // Breathing bob, plus the double-bounce that comes with the walk cycle.
    // `lift` and `bob` are pose values so they ease; the oscillators ride on
    // top at full amplitude rather than being filtered along with them.
    if (body.current) {
      const bob = bobS.current.step(p.bob, d);
      const breathe = Math.sin(t * 1.5) * 0.022 * bob * still;
      // Two rises per stride, highest as the legs pass. Was a bare sine on the
      // global clock, so it had no fixed relationship to where the feet were.
      // 4.87% of leg length, from the capture, against the 9.9% this used to
      // apply. The measured curve agrees with the old analytic one on frequency
      // and phase (correlation +0.92) and disagreed only on size, which is why
      // the walk read as a bounce.
      const stride = gs.bob * LEG * BOB_OVER_LEG * wk;
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
      root.current.position.x =
        homeX + W.x + sp.current.rootX.step(px * 0.22 * still, d);
      root.current.position.y = sp.current.rootPY.step(py * 0.08 * still, d);
    }
  });

  return (
    /* No initial x here. It used to be `position={[startX, 0, 0]}`, which the
       frame loop overwrote on the very first frame — the walk-in was a
       one-frame teleport followed by 2.6s of marching on the spot. `startX`
       now seeds `travel.current.x` and is walked off properly. */
    <group ref={root}>
      <group ref={body}>
        {/*
          Pelvis and legs are a SIBLING of the chest, not a child of it. That
          is what lets the chest twist while the feet stay planted — with the
          legs parented to the torso they can only ever rotate with it, which
          is why the whole body used to swing as one rigid piece.
        */}
        <group ref={hips}>
          <Ball r={0.13} position={[0, -0.36, 0]} />
          <Leg side={-1} hipRef={hipL} kneeRef={kneeL} ankleRef={ankleL} legRef={legL} />
          <Leg side={1} hipRef={hipR} kneeRef={kneeR} ankleRef={ankleR} legRef={legR} />
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
