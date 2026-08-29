"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { suspend } from "suspend-react";
import * as THREE from "three";

import Figure from "./figure";
import { useCharacters } from "./characters";
import { HOME_CYCLE, MORPH_DURATION, type Pose } from "./poses";
import { applyDissolve, makeDissolveUniforms, setDissolveActive } from "./dissolve";
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
 * How big the figures are, and where the floor is.
 *
 * One height for both. Soldier stands 1.81 units in his own file and Michelle
 * 1.65 — a 10% difference that, left alone, would make the About morph read as
 * the figure shrinking rather than changing. `Figure` scales each by its own
 * measured bind-pose bounding box, so both arrive at exactly FIGURE_HEIGHT with
 * their soles on FLOOR_Y and the morph becomes an identity swap and nothing
 * else.
 *
 * This replaces HUMAN_FIT, which existed because the two procedural rigs were
 * modelled independently and had to be reconciled after the fact with a scale
 * and an offset measured off their soles and head anchors. Deriving both
 * numbers from each model's own extents removes the reconciliation instead of
 * doing it more carefully — there is nothing left to get 2% wrong.
 *
 * FLOOR_Y sits just above the ContactShadows plane at -1.46.
 */
const FIGURE_HEIGHT = 2.5;
const FLOOR_Y = -1.42;

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
  const wasDissolving = useRef(false);

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

    /* Only pay for transparency while something is actually dissolving. At rest
       (m pinned at 0 or 1) both rigs go back to the opaque pass. */
    const dissolving = m > 0.001 && m < 0.999;
    if (dissolving !== wasDissolving.current) {
      wasDissolving.current = dissolving;
      if (robot.current) setDissolveActive(robot.current, dissolving);
      if (human.current) setDissolveActive(human.current, dissolving);
    }

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
 * The section-change tumble.
 *
 * At ~28s in the reference recording the character does not crossfade between
 * section poses — it launches, rotates through the air, and lands in the new
 * one. Ours simply re-posed, which is why section changes felt like a slide
 * deck rather than one continuous character.
 *
 * `gen` bumps on every section change; each bump starts a fresh arc. The whole
 * thing is one normalised 0..1 sweep so the hop, the spin and the landing
 * squash cannot drift apart, and it runs on the rig's OWN group so it composes
 * with the cursor spring and the walk without fighting either.
 */
function Tumble({ gen, target }: { gen: number; target: React.RefObject<THREE.Group> }) {
  const t = useRef(1); // 1 = settled; a new gen resets it to 0
  const last = useRef(gen);
  const DURATION = 0.92;

  useFrame((_, dt) => {
    if (gen !== last.current) {
      last.current = gen;
      t.current = 0;
    }
    if (!target.current) return;

    if (t.current < 1) {
      t.current = Math.min(1, t.current + Math.min(dt, 0.05) / DURATION);
    }
    const p = t.current;
    const g = target.current;

    if (p >= 1) {
      g.position.y = 0;
      g.rotation.x = 0;
      g.scale.setScalar(1);
      return;
    }

    // A single hop: up fast, down slower, with the spin front-loaded so the
    // figure is already upright before it lands.
    const arc = Math.sin(p * Math.PI);
    g.position.y = arc * 0.72;
    g.rotation.x = -smooth(clamp01(p / 0.78)) * Math.PI * 2;

    // Landing squash — a short compression on touchdown, which is what stops
    // the arrival reading as the model simply being teleported back to zero.
    const land = clamp01((p - 0.82) / 0.18);
    const squash = Math.sin(land * Math.PI) * 0.09;
    g.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
  });

  return null;
}

/* ------------------------------------------------------------------ */

function Scene({
  pose,
  paused,
  morph,
  startX,
  offsetX,
  tumbleGen,
  danceGen,
}: {
  pose: Pose;
  paused: boolean;
  morph: number;
  startX: number;
  offsetX: number;
  tumbleGen: number;
  danceGen: number;
}) {
  const chars = useCharacters();
  const robotRef = useRef<THREE.Group>(null);
  const humanRef = useRef<THREE.Group>(null);
  /* Its own group: Morph already owns robotRef's rotation and position for the
     somersault, so the tumble needs a separate transform or the two overwrite
     each other every frame. Nesting composes them instead. */
  const tumbleRef = useRef<THREE.Group>(null);

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
      <ambientLight intensity={0.62} />
      {/* Front-key so the gloss and chrome catch a highlight rather than only
          mirroring the environment.

          Pulled back from 1.5: combined with the HDRI it drove the chrome ball
          joints past white, so the shoulders and hips clipped into flat puffs
          with no form in them. A little more ambient and a little less key
          keeps the same contrast without losing the highlight roll-off, which
          is the part that makes chrome read as metal rather than as paint. */}
      <directionalLight position={[2, 4, 6]} intensity={1.12} castShadow />
      <directionalLight position={[-5, 2, -3]} intensity={0.75} color="#a8d8ff" />
      <pointLight position={[-2.4, 1.2, 3]} intensity={0.8} color="#ffffff" />
      <pointLight position={[2.6, -0.6, 2.4]} intensity={0.55} color="#cfe6ff" />

      <Environment files={suspend(studio) as string} />

      {/* Raised from -0.62: the bottom ticker now occupies the last ~30px of
          the viewport and the boots were crowding it. */}
      <group ref={rigRef} scale={0.72} position={[offsetX, -0.5, 0]}>
        <group ref={tumbleRef}>
          <group ref={robotRef}>
            <Figure
              character={chars.soldier}
              pose={pose}
              paused={paused}
              startX={startX}
              danceGen={danceGen}
              height={FIGURE_HEIGHT}
              floorY={FLOOR_Y}
            />
          </group>
          {/* No fit constants any more: both figures are scaled by their own
              measured bind-pose extents to the SAME height with their soles on
              the SAME floor, so the two land on each other by construction.
              HUMAN_FIT existed because the old pair were modelled independently
              and had to be reconciled after the fact. */}
          <group ref={humanRef} visible={false}>
            <Figure
              character={chars.michelle}
              pose={pose}
              paused={paused}
              height={FIGURE_HEIGHT}
              floorY={FLOOR_Y}
            />
          </group>
        </group>

        <Morph target={morph} robot={robotRef} human={humanRef} />
        <Tumble gen={tumbleGen} target={tumbleRef} />

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
          just bright cyan paint.

          It has to be held back hard here because the page behind it is LIGHT.
          Bloom is additive, so on a dark site its falloff disappears into the
          background, but over #e9edf4 it saturates to white and the halo turns
          into a visible pale ellipse floating behind the figure. The threshold
          is above 1 so only genuinely emissive surfaces (visor, chest sigil)
          qualify and the chrome's specular highlights do not; the tighter
          radius keeps what is left close to the source instead of spreading
          into a smudge. */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.4}
          luminanceThreshold={1.15}
          luminanceSmoothing={0.12}
          radius={0.55}
          mipmapBlur
        />
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
  /** bump to launch a section-change tumble */
  tumbleGen = 0,
  /** bump on every like — fires the next dance move */
  danceGen = 0,
}: {
  pose?: Pose;
  paused?: boolean;
  cycleHome?: boolean;
  morph?: number;
  walkIn?: boolean;
  offsetX?: number;
  tumbleGen?: number;
  danceGen?: number;
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
      /* Capped below 2. At dpr 2 this is a 4.6-megapixel target carrying MSAA,
         a shadow pass and a bloom chain; 1.6 cuts that by ~36% and the figure
         is a glossy black silhouette on a flat field, where the difference is
         very hard to see. Retina still gets sub-pixel detail. */
      dpr={[1, 1.6]}
      shadows
      camera={{ position: [0, 0.15, 6.2], fov: 34 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <Scene
          pose={active}
          paused={paused}
          morph={morph}
          startX={walkIn ? -2.6 : 0}
          offsetX={offsetX}
          tumbleGen={tumbleGen}
          danceGen={danceGen}
        />
      </Suspense>
    </Canvas>
  );
}
