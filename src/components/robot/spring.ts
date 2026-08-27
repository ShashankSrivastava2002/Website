/**
 * A scalar spring.
 *
 * Exponential damping (THREE.MathUtils.damp) is asymptotic — it approaches the
 * target and never passes it, so the motion has no arrival and reads as
 * mechanical. Stacking two of them (a smoothed input feeding a damped joint)
 * is worse still: the response flattens into a near-linear crawl.
 *
 * A spring accelerates, arrives, overshoots a little and settles. That
 * overshoot is what makes a head turn look like a head turn.
 *
 *   zeta < 1  underdamped — visible overshoot (what we want, ~0.6–0.8)
 *   zeta = 1  critically damped — fastest arrival with no overshoot
 *   zeta > 1  sluggish
 */
export class Spring {
  value: number;
  private v = 0;

  constructor(
    initial = 0,
    /** angular frequency; higher = snappier */
    public stiffness = 90,
    /** damping ratio; below 1 gives overshoot */
    public zeta = 0.7
  ) {
    this.value = initial;
  }

  step(target: number, dt: number) {
    // Sub-step so a long frame can't blow the integrator up.
    const steps = Math.min(4, Math.max(1, Math.ceil(dt / 0.012)));
    const h = dt / steps;
    const c = 2 * this.zeta * Math.sqrt(this.stiffness);

    for (let i = 0; i < steps; i++) {
      const a = this.stiffness * (target - this.value) - c * this.v;
      this.v += a * h;
      this.value += this.v * h;
    }
    return this.value;
  }
}

/** Convenience: a bundle of springs sharing a feel. */
export function springs(n: number, stiffness: number, zeta: number) {
  return Array.from({ length: n }, () => new Spring(0, stiffness, zeta));
}
