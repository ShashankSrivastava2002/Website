/**
 * One clock for the section change.
 *
 * The old behaviour crossfaded the whole section as a single block in 0.55s,
 * so every element arrived at once and the change read as a dissolve. The
 * reference stages it instead: the outgoing section blurs AND desaturates on
 * its way out — the desaturation is what makes it read as leaving rather than
 * merely fading — then the intro line lands alone, and the body follows behind
 * it. These numbers live here so the four sections stay in step; scattering
 * them across the files is how they drifted before.
 */

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Slower and flatter on the way out, so the exit reads as a recede. */
export const EASE_OUT = [0.4, 0, 0.6, 1] as const;

export const STAGE = {
  /** The intro line goes first, and is briefly alone on the stage. */
  intro: 0.05,
  /** The body waits until the intro has essentially landed. */
  body: 0.42,
  /** Per-item stagger within the body. */
  step: 0.07,
  /** How long a single element takes to arrive. */
  duration: 0.7,
} as const;

/** Delay for the i-th body element (0-indexed). */
export const bodyDelay = (i: number) => STAGE.body + STAGE.step * i;

/**
 * Applied to the section wrapper. Incoming is deliberately quick and blur-free
 * — the wrapper just uncovers the stage, and the children below do the actual
 * staging. Outgoing carries the blur and the desaturation.
 */
export const sectionFade = {
  initial: { opacity: 0, filter: "blur(5px) saturate(0.7)" },
  animate: {
    opacity: 1,
    filter: "blur(0px) saturate(1)",
    transition: { duration: 0.45, ease: EASE },
  },
  exit: {
    opacity: 0,
    filter: "blur(10px) saturate(0.3)",
    transition: { duration: 0.75, ease: EASE_OUT },
  },
};
