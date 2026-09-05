import * as THREE from "three";

/**
 * The identity-swap dissolve.
 *
 * The reference doesn't scatter rigid pieces — the mesh gets swallowed by
 * blocky chromatic noise and then resolves back out of it, which is a shader
 * effect (the site is credited as Three.js + GLSL). We patch whatever material
 * a mesh already has via `onBeforeCompile`, so the plating keeps its clearcoat
 * and the human keeps its fabric shading; the dissolve rides on top.
 *
 * `uProgress` 0 = solid, 1 = fully voxelised and gone.
 */

export type DissolveUniforms = {
  uProgress: { value: number };
  uTime: { value: number };
};

/** Each rig needs its OWN uniforms — sharing one set means only one of the
 *  two can be mid-dissolve at a time, which leaves a blank frame between them. */
export function makeDissolveUniforms(): DissolveUniforms {
  return { uProgress: { value: 0 }, uTime: { value: 0 } };
}

const VERT_HEAD = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  varying float vNoise;

  // cheap 3D hash -> 0..1
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
`;

const VERT_BODY = /* glsl */ `
  // Quantise the vertex into blocks so the mesh breaks into cubes rather than
  // melting. Block size grows as the dissolve runs.
  float blocks = mix(46.0, 11.0, uProgress);
  vec3 cell = floor(position * blocks) / blocks;
  float n = hash31(cell + floor(uTime * 3.0) * 0.017);
  vNoise = n;

  // Each block leaves at its own moment, so the mesh comes apart unevenly.
  float local = clamp((uProgress * 1.6) - n * 0.6, 0.0, 1.0);

  vec3 quantised = cell + (blocks > 0.0 ? 0.5 / blocks : 0.0);
  vec3 p = mix(position, quantised, local);
  // push the freed blocks out along the normal
  p += normal * local * local * 0.3 * (0.4 + n);
  transformed = p;
`;

const FRAG_HEAD = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  varying float vNoise;
`;

/**
 * Signal tearing on the diffuse texture, taken from the reference's human.
 *
 * The dissolve above breaks the GEOMETRY apart; this corrupts the IMAGE on
 * what is left, which is the half we were missing. Rows of the texture shear
 * sideways, the red and blue channels split, and the worst-torn rows flash
 * violet — the vocabulary of a dropped video frame rather than of a fade.
 *
 * Strength is derived from uProgress rather than carried on its own uniform:
 * the tearing IS the identity swap, so a hump that peaks halfway through the
 * dissolve is exactly the right coupling and there is nothing to keep in sync
 * from the frame loop.
 *
 * Replaces three's own <map_fragment>, so it has to declare
 * sampledDiffuseColor and fold it into diffuseColor itself, exactly as the
 * stock chunk does. The branch is on a uniform, so it is coherent across the
 * whole draw and costs nothing while the swap is idle — which matters, because
 * the glitch path is three texture fetches instead of one.
 */
const MAP_GLITCH = /* glsl */ `
#ifdef USE_MAP
  float gGlitch = sin(clamp(uProgress, 0.0, 1.0) * 3.14159265);
  vec4 sampledDiffuseColor;

  if (gGlitch > 0.001) {
    vec2 guv = vMapUv;
    float row  = floor(guv.y * 42.0);
    float rnd  = fract(sin(row * 91.17 + floor(uTime * 28.0)) * 43758.5453);
    float rnd2 = fract(sin(row * 37.71 + floor(uTime * 17.0)) * 24634.633);

    // whole rows shear sideways; occasionally the frame jumps vertically
    guv.x += (rnd  - 0.5) * 0.26 * gGlitch * step(0.62, rnd);
    guv.y += (rnd2 - 0.5) * 0.04 * gGlitch * step(0.88, rnd2);

    // red and blue sampled either side of green — a channel misregistration
    float ca = (0.008 + 0.05 * rnd) * gGlitch;
    vec4 mid = texture2D(map, guv);
    sampledDiffuseColor = vec4(
      texture2D(map, guv + vec2(ca, 0.0)).r,
      mid.g,
      texture2D(map, guv - vec2(ca, 0.0)).b,
      mid.a
    );

    // violet ghost on the rows that tore worst
    sampledDiffuseColor.rgb += vec3(0.5, 0.1, 0.7) * gGlitch * step(0.93, rnd);
  } else {
    sampledDiffuseColor = texture2D(map, vMapUv);
  }

  #ifdef DECODE_VIDEO_TEXTURE
    sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
  #endif
  diffuseColor *= sampledDiffuseColor;
#endif
`;

const FRAG_BODY = /* glsl */ `
  float local = clamp((uProgress * 1.6) - vNoise * 0.6, 0.0, 1.0);

  // Prismatic tint: the reference's blocks are rainbow, not monochrome. It
  // rides as a BAND at the dissolve front: flooding the whole surface loses
  // the material underneath and just reads as noise.
  //
  // The band has to be narrow RELATIVE TO THE NOISE SPREAD, which is the part
  // that is easy to get wrong: local varies by 0.6 across the mesh (the vNoise
  // term), so a band 0.3 wide catches half the blocks at once and the whole
  // robot goes rainbow -- which is exactly what it was doing. Keeping the band
  // well under that spread is what leaves the plating visible underneath.
  vec3 tint = 0.5 + 0.5 * cos(6.2831 * (vNoise + vec3(0.0, 0.33, 0.67)));
  float edge = smoothstep(0.0, 0.07, local) * (1.0 - smoothstep(0.10, 0.30, local));

  // ...and the band needs a global window on top of the per-block one. As
  // uProgress falls toward 0 the spread of local collapses, so nearly every
  // block ends up inside the band at the same moment and the whole figure
  // flashes rainbow just as it finishes resolving. Ramping the tint in with
  // the dissolve is what keeps it an effect at the front rather than a coat
  // of paint over a mesh that is already solid.
  // ("active" is a reserved word in GLSL ES -- it compiles fine as JS and
  //  fails only at shader link time, where the mesh silently stops drawing
  //  while still casting a shadow.)
  float runIn = smoothstep(0.06, 0.34, uProgress);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, tint, edge * 0.85 * runIn);

  // blocks fade out once they've travelled
  gl_FragColor.a *= 1.0 - smoothstep(0.55, 1.0, local);
  if (gl_FragColor.a < 0.01) discard;
`;

/** Patch a material once with the given uniform set. Safe to call repeatedly. */
export function applyDissolve(mat: THREE.Material, u: DissolveUniforms) {
  const m = mat as THREE.Material & {
    __dissolvePatched?: boolean;
    onBeforeCompile: (shader: THREE.WebGLProgramParametersWithUniforms) => void;
  };
  if (m.__dissolvePatched) return;
  m.__dissolvePatched = true;

  const prev = m.onBeforeCompile?.bind(m);

  m.onBeforeCompile = (shader) => {
    prev?.(shader);
    shader.uniforms.uProgress = u.uProgress;
    shader.uniforms.uTime = u.uTime;

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERT_HEAD}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERT_BODY}`);

    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${FRAG_HEAD}`)
      .replace("#include <map_fragment>", MAP_GLITCH)
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>\n${FRAG_BODY}`
      );
  };

  // NOT `transparent = true` here. Patching set it permanently on every
  // material, so all 90 meshes rendered in the sorted transparent pass for the
  // whole session even though the dissolve is idle almost all of the time —
  // no early-z, and depth ordering left to chance. The shader discards fully
  // faded fragments on its own, so opaque is correct while uProgress is 0;
  // `setDissolveActive` flips it only for the ~1.2s a morph is actually running.
  m.needsUpdate = true;
}

/**
 * Toggle transparency for a whole rig. Call with `true` when a dissolve starts
 * and `false` once it has settled at either end.
 */
export function setDissolveActive(root: THREE.Object3D, active: boolean) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      /* Some materials are transparent because that is what they ARE, not
         because a dissolve is running — the spectacle lenses. Forcing the flag
         on every material in the rig turned those opaque the moment a morph
         settled, which reads as frosted glass with the eyes painted out. */
      if (mat.userData?.alwaysTransparent) continue;
      if (mat.transparent !== active) {
        mat.transparent = active;
        mat.needsUpdate = true;
      }
    }
  });
}
