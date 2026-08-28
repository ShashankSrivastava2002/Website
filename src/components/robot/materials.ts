import * as THREE from "three";

/**
 * Shared materials for the robot. Defined once and reused across every mesh so
 * the whole model stays consistent and we aren't allocating per-frame.
 */

/** Glossy black plating — the main shell. Clearcoat gives the wet-looking gloss. */
export const plating = new THREE.MeshPhysicalMaterial({
  color: "#0a0c10",
  // Lower roughness and a harder clearcoat: the reference plating throws long,
  // thin, bright specular streaks, which is most of what reads as "expensive
  // black". A broader, softer highlight makes the same geometry look like
  // matte plastic.
  metalness: 0.66,
  roughness: 0.1,
  clearcoat: 1,
  clearcoatRoughness: 0.03,
  envMapIntensity: 1.85,
});

/** Slightly lighter plating for panels that should read as separate parts. */
export const platingSoft = new THREE.MeshPhysicalMaterial({
  color: "#171b21",
  metalness: 0.55,
  roughness: 0.24,
  clearcoat: 0.8,
  clearcoatRoughness: 0.12,
  envMapIntensity: 1.2,
});

/**
 * Exposed ball joints and struts. A perfect mirror (metalness 1, roughness ~0)
 * just reflects the dark surroundings and reads as black against black
 * plating — backing off the metalness and lifting the base colour is what
 * actually makes these read as bright chrome next to the shell.
 */
export const chrome = new THREE.MeshStandardMaterial({
  color: "#e8ecf3",
  metalness: 0.82,
  roughness: 0.24,
  envMapIntensity: 2.4,
});

/** Darker chrome for smaller hardware. */
export const chromeDark = new THREE.MeshStandardMaterial({
  color: "#aab3c0",
  metalness: 0.8,
  roughness: 0.3,
  envMapIntensity: 2,
});

/** The cyan visor bar and chest hex. */
export const visor = new THREE.MeshStandardMaterial({
  color: "#3fe4d8",
  emissive: "#3fe4d8",
  emissiveIntensity: 3.2,
  toneMapped: false,
});

/** Amber angular accents flanking the visor. */
export const amber = new THREE.MeshStandardMaterial({
  color: "#ff5e05",
  emissive: "#e64a00",
  emissiveIntensity: 1.5,
  toneMapped: false,
});

/**
 * The face screen. Deliberately MATTE — against the wet-gloss shell the
 * contrast is what makes it read as a mask rather than more bodywork. A
 * glossy near-black here is invisible next to glossy near-black plating.
 */
export const faceGlass = new THREE.MeshPhysicalMaterial({
  color: "#06080d",
  metalness: 0.18,
  roughness: 0.34,
  clearcoat: 0.85,
  clearcoatRoughness: 0.22,
  envMapIntensity: 0.7,
});

export const ALL_MATERIALS = [
  plating,
  platingSoft,
  chrome,
  chromeDark,
  visor,
  amber,
  faceGlass,
];
