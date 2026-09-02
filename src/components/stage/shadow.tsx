"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * The pool of shadow under the figure.
 *
 * Written by hand rather than using drei's `ContactShadows`, which on a light
 * page renders a visible rectangle. Its depth pass writes
 *
 *     rgb   = ucolor * fragCoordZ * 2.0
 *     alpha = 1.0 - fragCoordZ
 *
 * so fragments far from the plane come out BRIGHT and TRANSPARENT — and the two
 * blur passes that follow are not premultiplied, so that brightness bleeds into
 * every neighbouring texel that does have alpha. The result is a pale wash
 * covering the whole quad, with the plane's own edge visible as a trapezoid
 * lying across the page. Widening the depth range makes it worse, because more
 * of the figure lands in the bright end of it.
 *
 * A radial falloff has none of that: alpha reaches zero at the inscribed
 * circle, well inside the geometry, so the quad's edge can never show, there is
 * no render target, no blur pass and no second camera. It costs one draw call
 * and is exact.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    /* Squashed along Z because a standing figure's contact patch is wider than
       it is deep — a circle reads as a ball's shadow, not a person's. */
    vec2 p = (vUv - 0.5) * vec2(1.0, 1.42);
    float d = length(p) * 2.0;

    // Zero at the inscribed circle: the corners of the quad are never drawn.
    float a = 1.0 - smoothstep(0.0, 1.0, d);
    a = pow(a, 2.1);

    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`;

export function Shadow({
  y,
  size = 3.1,
  opacity = 0.42,
  color = "#0e1620",
  lift,
}: {
  y: number;
  size?: number;
  opacity?: number;
  color?: string;
  /** Group whose height off the floor softens the shadow, if any. */
  lift?: React.RefObject<THREE.Object3D>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);

  /* A figure mid-somersault is a metre off the floor, and a shadow that stays
     hard underneath it pins it back down. Fading and spreading it with height
     is what makes the hop read as leaving the ground. */
  useFrame(() => {
    if (!lift?.current || !mat.current || !mesh.current) return;
    const h = Math.max(0, lift.current.position.y);
    const t = Math.min(1, h / 0.9);
    mat.current.uniforms.uOpacity.value = opacity * (1 - t * 0.72);
    mesh.current.scale.setScalar(1 + t * 0.38);
  });

  return (
    <mesh ref={mesh} rotation-x={-Math.PI / 2} position={[0, y, 0]} renderOrder={-1}>
      <planeGeometry args={[size, size]} />
      <shaderMaterial
        ref={mat}
        transparent
        depthWrite={false}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
        }}
      />
    </mesh>
  );
}
