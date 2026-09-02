"use client";

import { about } from "@/content/site";
import { useScramble } from "@/lib/use-scramble";

/**
 * The identity swap, in copy.
 *
 * The figure morphs from robot to human; this side of the page has to change
 * with it or the swap reads as a 3D trick rather than a reveal. The numbers are
 * deliberately the SAME for both identities — that is the point — so each swap
 * re-runs the scramble on them, which sells "one entity, two faces" without
 * inventing two sets of figures.
 */
export function About({ on, human, onSwap }: { on: boolean; human: boolean; onSwap: () => void }) {
  const who = human ? about.human : about.ai;
  const name = useScramble(who.name, 24, on);

  return (
    <section className="section" data-on={on} aria-hidden={!on}>
      <div className="about">
        {/* Left column is empty on purpose: the figure occupies it, and the
            stage slides sideways to meet this space. */}
        <div className="about-figure" aria-hidden />

        <div>
          <p className="mono eyebrow">{human ? "THE HUMAN" : "THE PERSONA"}</p>
          <h2>{name}</h2>
          <p className="mono">{who.role}</p>
          <p className="about-bio">{who.bio}</p>

          <div className="stats">
            {about.stats.map((s) => (
              <div key={s.label}>
                <div className="stat-value">{s.value}</div>
                <div className="mono">{s.label}</div>
              </div>
            ))}
          </div>

          <button className="swap" onClick={onSwap}>
            <i className="swap-dot" />
            {human ? "show the persona" : "show the human"}
          </button>
        </div>
      </div>
    </section>
  );
}
