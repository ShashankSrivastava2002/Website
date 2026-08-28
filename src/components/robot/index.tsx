"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree, advance } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { suspend } from "suspend-react";
import * as THREE from "three";

import RobotModel from "./model";
import HumanModel from "./human";
import { HOME_CYCLE, MORPH_DURATION, type Pose } from "./poses";
import { applyDissolve, makeDissolveUniforms } from "./dissolve";
import { Spring } from "./spring";

export type { Pose } from "./poses";

/** Bundled offline HDRI — no CDN fetch, real reflections on the plating. */
const studio = import("@pmndrs/assets/hdri/studio.exr").then((m) => m.default);

/* ------------------------------------------------------------------ */

/** Cycles home through idle → wave → idle → think on a timer. */
function useHomeCycle(active: boolean): Pose {
  const [i, setI] = useState(0);
  const idx = useRef(0);

  useEffect(() => {
    if (!active) {
      idx.current = 0;
      setI(0);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const step = () => {
      const cur = HOME_CYCLE[idx.current % HOME_CYCLE.length];
      timer = setTimeout(() => {
        idx.current += 1;
        setI(idx.current);
        step();
      }, cur.hold * 1000);
    };
    step();
    return () => clearTimeout(timer);
  }, [active]);

  return HOME_CYCLE[i % HOME_CYCLE.length].pose;
}

/* ------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * Fits the human rig onto the robot's.
 *
 * The two figures were modelled independently and do not match. Unfitted, the
 * human's soles sat 0.095 above the robot's and its head anchor 0.25 below —
 * so the swap put a shorter figure at a different height, which is why it read
 * as two objects trading places rather than one figure changing.
 *
 * Scaling by the ratio of the sole→head-anchor spans and then dropping the
 * result lands BOTH anchors at once: sole on sole, head on head. No amount of
 * dissolve sells the transformation without this.
 *
 * The soles are MEASURED, not read off the source — the human's shoes hang off
 * a leg group that is itself offset, which is easy to miss by eye. To re-measure
 * after changing either rig, neutralise the morph's tumble and compare world
 * bounds:
 *
 *   const rig = <the group with scale 0.72>;
 *   rig.children[0].rotation.set(0,0,0); rig.children[0].position.set(0,0,0);
 *   // ...same for children[1], then compare min world Y of each subtree.
 */
const HUMAN_FIT = (() => {
  const ROBOT_SOLE = -1.4533;
  const HUMAN_SOLE = -1.3585;
  const HEAD_ANCHOR = 0.92; // identical in both rigs, by construction
  const scale = (HEAD_ANCHOR - ROBOT_SOLE) / (HEAD_ANCHOR - HUMAN_SOLE);
  return { scale, y: ROBOT_SOLE - HUMAN_SOLE * scale };
})();

/**
 * The identity swap.
 *
 * Frame-by-frame the reference does three things in sequence, not a crossfade:
 *   1. the robot tumbles through a full forward somersault,
 *   2. its mesh is swallowed by blocky chromatic noise (see dissolve.ts),
 *   3. the human resolves back out of that same noise.
 *
 * So the flip is rigid-body motion on the group, and the dissolve is a shader
 * on the materials — the two are driven from one progress value.
 */
function Morph({
  target,
  robot,
  human,
}: {
  target: number; // 0 = robot, 1 = human
  robot: React.RefObject<THREE.Group>;
  human: React.RefObject<THREE.Group>;
}) {
  const v = useRef(0);
  const patched = useRef(false);
  const uRobot = useRef(makeDissolveUniforms());
  const uHuman = useRef(makeDissolveUniforms());

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);

    /* One progress value drives the somersault, both dissolve windows and the
       landing, so nothing can drift out of sync.

       It advances at a fixed rate rather than damping toward the target: an
       exponential approach slows as it nears 1, which stretched the tail of the
       dissolve out to nothing and made a re-trigger mid-flight crawl. The
       easing lives in the sub-windows below, which are already shaped. */
    if (v.current !== target) {
      const dir = target > v.current ? 1 : -1;
      v.current = clamp01(v.current + (dir * d) / MORPH_DURATION);
      v.current = dir > 0 ? Math.min(v.current, target) : Math.max(v.current, target);
    }
    const m = v.current;

    // Patch every material in both rigs once they exist.
    if (!patched.current && robot.current && human.current) {
      for (const [g, u] of [
        [robot.current, uRobot.current] as const,
        [human.current, uHuman.current] as const,
      ]) {
        g.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh && mesh.material) applyDissolve(mesh.material as THREE.Material, u);
        });
      }
      patched.current = true;
    }

    uRobot.current.uTime.value = state.clock.elapsedTime;
    uHuman.current.uTime.value = state.clock.elapsedTime;

    // The two windows OVERLAP: the robot is still coming apart while the human
    // is already reassembling, so there is never an empty frame between them.
    const robotProg = smooth(clamp01(m / 0.7));
    const humanProg = 1 - smooth(clamp01((m - 0.3) / 0.7));
    uRobot.current.uProgress.value = robotProg;
    uHuman.current.uProgress.value = humanProg;

    if (robot.current) {
      robot.current.visible = robotProg < 0.999;
      // Full forward somersault, rising and falling through the tumble.
      const spin = smooth(clamp01(m / 0.6));
      robot.current.rotation.x = -spin * Math.PI * 2;
      robot.current.position.y = Math.sin(spin * Math.PI) * 0.9;
    }

    if (human.current) {
      human.current.visible = humanProg < 0.999;
      const land = smooth(clamp01((m - 0.5) / 0.5));
      human.current.rotation.x = (1 - land) * -0.6;
      human.current.position.y = (1 - land) * 0.5;
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */

/**
 * DEV-ONLY. Hands the renderer and a manual frame-stepper to `window` so the
 * scene can be driven and captured when rAF isn't running (a background tab
 * suspends rAF entirely, which otherwise leaves the canvas blank).
 */
function DebugBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const store = useThree((s) => s);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__r3f_store = { getState: () => store };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__r3f_debug = {
      gl,
      scene,
      camera,
      advance,
      /**
       * Step `n` frames of `dt` seconds.
       *
       * With the default frameloop R3F derives delta from REAL elapsed time,
       * so stepping in a tight loop yields dt~0 and nothing animates. Flipping
       * to 'never' makes advance() take elapsed seconds, which is the only way
       * to drive a deterministic timeline from outside.
       */
      step(n = 60, dt = 1 / 60) {
        const store = (window as any).__r3f_store;
        const setFrameloop = store?.getState?.().setFrameloop;
        setFrameloop?.("never");
        const st = store?.getState?.();
        let elapsed = st?.clock?.elapsedTime ?? 0;
        for (let i = 1; i <= n; i++) {
          elapsed += dt;
          advance(elapsed);
        }
        gl.render(scene, camera);
      },
    };
  }, [gl, scene, camera]);

  return null;
}

function Scene({
  pose,
  paused,
  morph,
  startX,
  offsetX,
}: {
  pose: Pose;
  paused: boolean;
  morph: number;
  startX: number;
  offsetX: number;
}) {
  const robotRef = useRef<THREE.Group>(null);
  const humanRef = useRef<THREE.Group>(null);

  /* The About page moves the figure into the left column. Applying `offsetX`
     to the group directly teleported the whole rig 2.15 units in a single
     frame on every section change — a hard cut in the middle of an otherwise
     animated page. It walks there instead. */
  const rigRef = useRef<THREE.Group>(null);
  const slide = useRef(new Spring(offsetX, 22, 0.72));
  useFrame((_, dt) => {
    if (rigRef.current) {
      rigRef.current.position.x = slide.current.step(offsetX, Math.min(dt, 0.05));
    }
  });

  return (
    <>
      <ambientLight intensity={0.55} />
      {/* strong front-key so the gloss and chrome catch a highlight rather
          than only mirroring the (dark) environment */}
      <directionalLight position={[2, 4, 6]} intensity={1.5} castShadow />
      <directionalLight position={[-5, 2, -3]} intensity={0.9} color="#a8d8ff" />
      <pointLight position={[-2.4, 1.2, 3]} intensity={1.1} color="#ffffff" />
      <pointLight position={[2.6, -0.6, 2.4]} intensity={0.7} color="#cfe6ff" />

      <Environment files={suspend(studio) as string} />

      <group ref={rigRef} scale={0.72} position={[offsetX, -0.62, 0]}>
        <group ref={robotRef}>
          <RobotModel pose={pose} paused={paused} homeX={0} startX={startX} />
        </group>
        {/* Fitted onto the robot's sole and head anchor — see HUMAN_FIT. */}
        <group ref={humanRef} visible={false}>
          <group scale={HUMAN_FIT.scale} position={[0, HUMAN_FIT.y, 0]}>
            <HumanModel paused={paused} />
          </group>
        </group>

        <Morph target={morph} robot={robotRef} human={humanRef} />

        {/* Tight and soft — a wide plane reads as a hard grey horizon band
            rather than a shadow pooled under the feet. */}
        <ContactShadows
          position={[0, -1.46, 0]}
          opacity={0.34}
          scale={2.7}
          blur={4.2}
          far={1.1}
          resolution={512}
          color="#0e1620"
        />
      </group>

      {/* Bloom is what makes the visor and chest read as emissive rather than
          just bright cyan paint. */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.75} luminanceThreshold={1} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function RobotStage({
  pose = "idle",
  paused = false,
  cycleHome = false,
  /** 0 = robot, 1 = human. Drives the About-page morph. */
  morph = 0,
  /** plays the walk-in from off-screen once, on first mount */
  walkIn = false,
  /** shifts the whole rig sideways (About puts it in the left column) */
  offsetX = 0,
}: {
  pose?: Pose;
  paused?: boolean;
  cycleHome?: boolean;
  morph?: number;
  walkIn?: boolean;
  offsetX?: number;
}) {
  const cycled = useHomeCycle(cycleHome && !paused);
  const [arrived, setArrived] = useState(!walkIn);

  // Walk in from stage-left, then hand over to the normal pose logic.
  useEffect(() => {
    if (!walkIn) return;
    const id = setTimeout(() => setArrived(true), 2600);
    return () => clearTimeout(id);
  }, [walkIn]);

  const active: Pose = !arrived ? "walk" : cycleHome ? cycled : pose;

  return (
    <Canvas
      className="robot-canvas"
      dpr={[1, 2]}
      shadows
      camera={{ position: [0, 0.15, 6.2], fov: 34 }}
      // preserveDrawingBuffer lets the debug harness read the canvas back
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
    >
      {/* outside Suspense so it still mounts while the HDRI is loading */}
      <DebugBridge />
      <Suspense fallback={null}>
        <Scene
          pose={active}
          paused={paused}
          morph={morph}
          startX={walkIn ? -2.6 : 0}
          offsetX={offsetX}
        />
      </Suspense>
    </Canvas>
  );
}
