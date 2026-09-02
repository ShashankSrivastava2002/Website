"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { suspend } from "suspend-react";
import * as THREE from "three";

import Figure from "./figure";
import { MODELS, useCharacter } from "./character";
import { HOME_CYCLE, MORPH_DURATION, type Pose } from "./poses";
import { applyDissolve, makeDissolveUniforms, setDissolveActive } from "./dissolve";
import { Shadow } from "./shadow";
import { Spring } from "./spring";

export type { Pose } from "./poses";

/** Bundled offline HDRI — no CDN fetch, real reflections on the plating. */
const studio = import("@pmndrs/assets/hdri/studio.exr").then((m) => m.default);

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * One height for both figures, one floor for both.
 *
 * The robot stands 1.47 units in his own file and the human 1.41. Scaling each
 * by its own measured stance means the About swap changes identity and nothing
 * else — no constant anywhere reconciles the two afterwards, because there is
 * nothing left to reconcile.
 */
const FIGURE_HEIGHT = 2.5;
const FLOOR_Y = -1.42;

/* ------------------------------------------------------------------ */

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
      timer = setTimeout(() => {
        idx.current += 1;
        setI(idx.current);
        step();
      }, HOME_CYCLE[idx.current % HOME_CYCLE.length].hold * 1000);
    };
    step();
    return () => clearTimeout(timer);
  }, [active]);

  return HOME_CYCLE[i % HOME_CYCLE.length].pose;
}

/**
 * The identity swap.
 *
 * Three things in sequence, not a crossfade: the robot tumbles through a full
 * forward somersault, its mesh is swallowed by blocky noise, and the human
 * resolves back out of that same noise. One progress value drives all of it, so
 * nothing can drift out of sync — and the two dissolve windows OVERLAP, so
 * there is never an empty frame between them.
 */
function Morph({
  target,
  robot,
  human,
}: {
  target: number;
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

    /* Advances at a fixed rate rather than damping toward the target: an
       exponential approach slows as it nears 1, which stretches the tail of the
       dissolve out to nothing. The easing lives in the sub-windows below. */
    if (v.current !== target) {
      const dir = target > v.current ? 1 : -1;
      v.current = clamp01(v.current + (dir * d) / MORPH_DURATION);
      v.current = dir > 0 ? Math.min(v.current, target) : Math.max(v.current, target);
    }
    const m = v.current;

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

    const robotProg = smooth(clamp01(m / 0.7));
    const humanProg = 1 - smooth(clamp01((m - 0.3) / 0.7));
    uRobot.current.uProgress.value = robotProg;
    uHuman.current.uProgress.value = humanProg;

    /* Only pay for transparency while something is actually dissolving. */
    const dissolving = m > 0.001 && m < 0.999;
    if (dissolving !== wasDissolving.current) {
      wasDissolving.current = dissolving;
      if (robot.current) setDissolveActive(robot.current, dissolving);
      if (human.current) setDissolveActive(human.current, dissolving);
    }

    if (robot.current) {
      robot.current.visible = robotProg < 0.999;
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

/**
 * The section-change hop.
 *
 * Sections used to re-pose the figure, which made a change read like a slide
 * deck rather than one continuous character. It launches, spins, and lands
 * instead — on its OWN group, so it composes with the morph rather than
 * fighting it for the same transform.
 */
function Tumble({ gen, target }: { gen: number; target: React.RefObject<THREE.Group> }) {
  const t = useRef(1);
  const last = useRef(gen);
  const DURATION = 0.92;

  useFrame((_, dt) => {
    if (gen !== last.current) {
      last.current = gen;
      t.current = 0;
    }
    const g = target.current;
    if (!g) return;

    if (t.current < 1) t.current = Math.min(1, t.current + Math.min(dt, 0.05) / DURATION);
    const p = t.current;

    if (p >= 1) {
      g.position.y = 0;
      g.rotation.x = 0;
      g.scale.setScalar(1);
      return;
    }

    g.position.y = Math.sin(p * Math.PI) * 0.72;
    // Spin front-loaded so the figure is upright again before it lands.
    g.rotation.x = -smooth(clamp01(p / 0.78)) * Math.PI * 2;

    // Landing squash — without it the arrival reads as a teleport back to zero.
    const land = clamp01((p - 0.82) / 0.18);
    const squash = Math.sin(land * Math.PI) * 0.09;
    g.scale.set(1 + squash * 0.6, 1 - squash, 1 + squash * 0.6);
  });

  return null;
}

/* ------------------------------------------------------------------ */

type SceneProps = {
  pose: Pose;
  paused: boolean;
  morph: number;
  startX: number;
  offsetX: number;
  tumbleGen: number;
  danceGen: number;
};

function Scene({ pose, paused, morph, startX, offsetX, tumbleGen, danceGen }: SceneProps) {
  const robot = useCharacter(MODELS.robot);
  const human = useCharacter(MODELS.human);

  const robotRef = useRef<THREE.Group>(null);
  const humanRef = useRef<THREE.Group>(null);
  const tumbleRef = useRef<THREE.Group>(null);
  const rigRef = useRef<THREE.Group>(null);

  /* About moves the figure into the left column. Setting `offsetX` directly
     teleported the whole rig two units in one frame on every section change; it
     springs there instead. */
  const slide = useRef(new Spring(offsetX, 22, 0.72));
  useFrame((_, dt) => {
    if (rigRef.current) rigRef.current.position.x = slide.current.step(offsetX, Math.min(dt, 0.05));
  });

  return (
    <>
      <ambientLight intensity={0.62} />
      {/* Front key so the chrome catches a highlight rather than only mirroring
          the environment. Held at 1.12: combined with the HDRI, 1.5 drove the
          ball joints past white and the shoulders clipped into flat puffs. */}
      <directionalLight position={[2, 4, 6]} intensity={1.12} castShadow />
      <directionalLight position={[-5, 2, -3]} intensity={0.75} color="#a8d8ff" />
      <pointLight position={[-2.4, 1.2, 3]} intensity={0.8} />
      <pointLight position={[2.6, -0.6, 2.4]} intensity={0.55} color="#cfe6ff" />

      <Environment files={suspend(studio) as string} />

      {/* Framed so the whole figure clears the bottom ticker. At scale 0.72
          and y -0.5 the soles landed at 94% of viewport height and the contact
          shadow was cut in half by the ticker strip; this puts the figure
          between roughly 37% and 89%, with its shadow on the page rather than
          on the edge of it. */}
      <group ref={rigRef} scale={0.78} position={[offsetX, -0.2, 0]}>
        <group ref={tumbleRef}>
          <group ref={robotRef}>
            <Figure
              character={robot}
              pose={pose}
              paused={paused}
              startX={startX}
              danceGen={danceGen}
              height={FIGURE_HEIGHT}
              floorY={FLOOR_Y}
            />
          </group>
          <group ref={humanRef} visible={false}>
            <Figure
              character={human}
              pose={pose}
              paused={paused}
              danceGen={danceGen}
              height={FIGURE_HEIGHT}
              floorY={FLOOR_Y}
            />
          </group>
        </group>

        <Morph target={morph} robot={robotRef} human={humanRef} />
        <Tumble gen={tumbleGen} target={tumbleRef} />

        {/* `far` is the depth ABOVE the plane that the pass samples, and it is
            the setting that decides whether this is a shadow or a grey slab.
            At 1.1 against a figure just under 2 units tall the pass saturated
            and the whole quad came back tinted, so the plane read as a
            translucent rectangle lying across the page with a visible edge and
            a combed, under-resolved border. Sampling the figure's full height
            at twice the resolution, with a blur that no longer has to hide the
            steps, leaves shadow only where a foot actually is. */}
        <Shadow y={-1.46} lift={tumbleRef} />
      </group>

      {/* Bloom held back hard because the page behind it is LIGHT. Bloom is
          additive: on a dark site its falloff disappears into the background,
          but over #e9edf4 it saturates to white and the halo becomes a visible
          pale ellipse behind the figure. Threshold above 1 means only genuinely
          emissive surfaces qualify, not the chrome's speculars. */}
      <EffectComposer multisampling={0}>
        <Bloom intensity={0.28} luminanceThreshold={1.4} luminanceSmoothing={0.1} radius={0.5} mipmapBlur />
      </EffectComposer>
    </>
  );
}

/* ------------------------------------------------------------------ */

export default function Stage({
  pose = "idle",
  paused = false,
  cycleHome = false,
  morph = 0,
  walkIn = false,
  offsetX = 0,
  tumbleGen = 0,
  danceGen = 0,
}: {
  pose?: Pose;
  paused?: boolean;
  cycleHome?: boolean;
  /** 0 = robot, 1 = human. */
  morph?: number;
  walkIn?: boolean;
  offsetX?: number;
  tumbleGen?: number;
  danceGen?: number;
}) {
  const cycled = useHomeCycle(cycleHome && !paused);
  const [arrived, setArrived] = useState(!walkIn);

  useEffect(() => {
    if (!walkIn) return;
    const id = setTimeout(() => setArrived(true), 2600);
    return () => clearTimeout(id);
  }, [walkIn]);

  const active: Pose = !arrived ? "walk" : cycleHome ? cycled : pose;

  return (
    <Canvas
      className="stage-canvas"
      /* Capped below 2. At dpr 2 this is a 4.6-megapixel target carrying MSAA,
         a shadow pass and a bloom chain; 1.6 cuts that by ~36% on a glossy
         silhouette against a flat field, where it is very hard to see. */
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
