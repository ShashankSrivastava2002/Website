"use client";

import { useEffect, useRef, useState } from "react";

import { motion } from "framer-motion";
import { about, persona } from "@/lib/content";
import { SectionIntro } from "./work-section";
import Scramble from "@/components/scramble";
import { MORPH_DURATION } from "@/components/robot/poses";

/** Corrupted characters used while the headline swaps identity. */
const NOISE = "▚▞█▓▒░/\\<>_|#%&@";

/**
 * Glitches `text` into place: for the first stretch of the transition the
 * characters are replaced with noise, then they resolve left-to-right.
 */
function GlitchText({ text, trigger }: { text: string; trigger: number }) {
  const [shown, setShown] = useState(text);
  const raf = useRef(0);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 620;

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      const locked = Math.floor(p * text.length * 1.3);
      let out = "";
      for (let i = 0; i < text.length; i++) {
        if (i < locked || text[i] === " ") out += text[i];
        else out += NOISE[Math.floor(Math.random() * NOISE.length)];
      }
      setShown(out);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setShown(text);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [text, trigger]);

  return <>{shown}</>;
}

/**
 * `human` and `gen` are owned by the page, because the 3D stage morphs at the
 * same moment this copy does — they have to flip off one clock, not two.
 */
export default function AboutSection({
  human,
  gen,
  onFlip,
}: {
  human: boolean;
  gen: number;
  onFlip: () => void;
}) {
  const identity = human ? about.human : about.ai;

  return (
    <div className="page">
      <SectionIntro index="03" label="ABOUT" text={about.intro} />

      <div className="about-grid">
        {/* ----------------------- badges ----------------------- */}
        {/* The figure itself is the 3D stage behind this column — the robot
            dissolves into the human model there. Only the badges live here. */}
        <div className="about-figure">
          {/* The 3D figure renders in the layer behind this column; this is the
              hit area that triggers the identity flip. */}
          <button
            className="figure-hit"
            onClick={onFlip}
            aria-label={human ? "Switch back to the robot" : "Switch to the human"}
          >
            <span className="figure-hint">
              {human ? "TAP TO RETURN" : "TAP TO REVEAL"}
            </span>
          </button>

          <div className="badges" aria-hidden>
            {about.badges.map((b, i) => (
              <span
                key={b.label}
                className="badge"
                style={
                  {
                    "--i": i,
                    "--x": `${b.x}%`,
                    "--y": `${b.y}%`,
                    "--tint": b.tint,
                  } as React.CSSProperties
                }
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>

        {/* --------------------------- copy --------------------------- */}
        <motion.div
          className="about-card"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          <h2 className="about-mark" data-human={human}>
            <GlitchText text={identity.name} trigger={gen} />
          </h2>
          <p className="about-role">{identity.role}</p>
          <p className="about-bio">{identity.bio}</p>

          <div className="panel-head panel-head--flush">
            <span>BY THE NUMBERS</span>
            <b>{String(about.stats.length).padStart(2, "0")}</b>
          </div>

          <div className="stats">
            {about.stats.map((s, i) => (
              <div className="stat" key={s.label}>
                <span className="stat-value">
                  {/* keying on `gen` restarts the scramble on every morph */}
                  {/* Timed off the 3D swap's own duration so the figures land
                      as the figure resolves, rather than on their own clock. */}
                  <Scramble
                    key={gen}
                    value={s.value}
                    duration={MORPH_DURATION * 1000 * (0.72 + i * 0.09)}
                  />
                </span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="manifesto">
            <span className="manifesto-label">MANIFESTO</span>
            <p>{about.manifesto}</p>
          </div>

          <footer className="about-foot">
            <span>APPLIED AI · PRODUCTION SCALE</span>
            <span>© {new Date().getFullYear()} SHASHANK SRIVASTAVA</span>
          </footer>
        </motion.div>
      </div>

      <div className="marquee" aria-label="Career trajectory">
        <div className="marquee-label">TRAJECTORY</div>
        <div className="marquee-track">
          {[0, 1].map((dup) => (
            <div className="marquee-row" key={dup} aria-hidden={dup === 1}>
              {about.trajectory.map((t) => (
                <span key={t.org + dup}>
                  <b>{t.year}</b> {t.org}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
