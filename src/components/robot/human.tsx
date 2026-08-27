"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { usePointer, easePointer } from "./use-pointer";

/**
 * A deliberately generic stylised figure — the "human" half of the About
 * morph. It is not modelled on anyone: neutral proportions, no facial
 * features beyond placeholder eyes, no likeness.
 */

function useHumanMaterials() {
  return useMemo(() => {
    const mk = (o: THREE.MeshStandardMaterialParameters) =>
      new THREE.MeshStandardMaterial({ transparent: true, ...o });
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

export default function HumanModel({ paused = false }: { paused?: boolean }) {
  const pointer = usePointer();
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const M = useHumanMaterials();

  useFrame((state, dt) => {
    const d = Math.min(dt, 0.05);
    const t = state.clock.elapsedTime;
    const still = paused ? 0 : 1;
    const damp = THREE.MathUtils.damp;
    easePointer(pointer.current, d);

    if (head.current) {
      head.current.rotation.y = damp(head.current.rotation.y, pointer.current.x * 0.45 * still, 5, d);
      head.current.rotation.x = damp(head.current.rotation.x, -pointer.current.y * 0.24 * still, 5, d);
    }
    if (body.current) {
      body.current.position.y = damp(
        body.current.position.y,
        Math.sin(t * 1.4) * 0.02 * still,
        4,
        d
      );
    }
    if (root.current) {
      root.current.rotation.y = damp(root.current.rotation.y, pointer.current.x * 0.2 * still, 3, d);
    }
  });

  return (
    <group ref={root}>
      <group ref={body}>
        {/* ---------------- head ---------------- */}
        <group ref={head} position={[0, 0.92, 0]}>
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

        {/* ---------------- torso ---------------- */}
        <RoundedBox
          args={[0.54, 0.72, 0.3]}
          radius={0.13}
          smoothness={5}
          material={M.shirt}
          position={[0, 0.24, 0]}
          castShadow
        />

        {/* ---------------- arms ---------------- */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.32, 0.46, 0]} rotation={[0, 0, s * 0.16]}>
            {/* sleeve */}
            <RoundedBox
              args={[0.17, 0.34, 0.18]}
              radius={0.07}
              smoothness={4}
              material={M.shirt}
              position={[0, -0.17, 0]}
              castShadow
            />
            {/* forearm */}
            <mesh material={M.skin} position={[0, -0.46, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.22, 6, 14]} />
            </mesh>
            {/* hand */}
            <mesh material={M.skin} position={[0, -0.64, 0]} scale={[1, 1.2, 0.7]} castShadow>
              <sphereGeometry args={[0.075, 16, 14]} />
            </mesh>
          </group>
        ))}

        {/* ---------------- legs ---------------- */}
        {[-1, 1].map((s) => (
          <group key={s} position={[s * 0.15, -0.16, 0]}>
            <RoundedBox
              args={[0.22, 0.62, 0.24]}
              radius={0.09}
              smoothness={4}
              material={M.jeans}
              position={[0, -0.3, 0]}
              castShadow
            />
            <RoundedBox
              args={[0.2, 0.5, 0.22]}
              radius={0.08}
              smoothness={4}
              material={M.jeans}
              position={[0, -0.82, 0]}
              castShadow
            />
            {/* shoe */}
            <RoundedBox
              args={[0.23, 0.15, 0.36]}
              radius={0.07}
              smoothness={5}
              material={M.shoe}
              position={[0, -1.12, 0.07]}
              castShadow
            />
            <mesh material={M.sole} position={[0, -1.19, 0.07]}>
              <boxGeometry args={[0.235, 0.04, 0.35]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}
