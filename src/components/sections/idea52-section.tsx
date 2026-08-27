"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { idea52 } from "@/lib/content";

/** Drifting starfield, drawn on a canvas so it costs almost nothing. */
function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvs = ref.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const stars = Array.from({ length: 130 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.5 + 0.3,
      // slow vertical drift, each star at its own rate
      v: Math.random() * 0.012 + 0.003,
      a: Math.random() * 0.5 + 0.2,
      tw: Math.random() * Math.PI * 2,
    }));

    const resize = () => {
      w = cvs.clientWidth;
      h = cvs.clientHeight;
      cvs.width = w * dpr;
      cvs.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y -= s.v / 60;
        if (s.y < 0) s.y = 1;
        const twinkle = 0.6 + Math.sin(t / 700 + s.tw) * 0.4;
        ctx.globalAlpha = s.a * twinkle;
        ctx.fillStyle = "#cfe6ff";
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="starfield" aria-hidden />;
}

export default function Idea52Section() {
  const [pct, setPct] = useState(0);

  // "GENERATING WORLD" runs to completion and then swaps for the enter button,
  // the way the reference does. Timer-backed so it still finishes if the tab
  // is in the background, where rAF is suspended.
  useEffect(() => {
    const start = performance.now();
    const DURATION = 3600;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      setPct(Math.round((1 - Math.pow(1 - p, 2)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const backstop = setTimeout(() => setPct(100), DURATION + 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
    };
  }, []);

  const dots = useMemo(() => "·".repeat(3), []);

  return (
    <div className="idea52">
      <Starfield />

      <motion.div
        className="idea52-card"
        initial={{ opacity: 0, y: 26, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* L-shaped brackets at each corner of the card */}
        {["tl", "tr", "bl", "br"].map((c) => (
          <span key={c} className={`idea52-corner idea52-corner--${c}`} aria-hidden />
        ))}

        <h2 className="idea52-title">
          IDEA<b>52</b>
        </h2>
        <div className="idea52-rule" />
        <p className="idea52-sub">{idea52.subtitle}</p>
        <p className="idea52-body">{idea52.body}</p>

        <div className="idea52-cols">
          <div>
            <span className="idea52-label">CONTROLS</span>
            <ul className="idea52-controls">
              {idea52.controls.map((c) => (
                <li key={c.key}>
                  <kbd>{c.key}</kbd>
                  <span>{c.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="idea52-label idea52-label--warm">THE GOAL</span>
            <p className="idea52-goal">{idea52.goal}</p>
          </div>
        </div>

        {pct < 100 ? (
          <div className="idea52-loading">
            <div className="idea52-bar">
              <div className="idea52-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span>
              GENERATING WORLD {dots} <b>{String(pct).padStart(3, "0")}</b>
            </span>
          </div>
        ) : (
          <motion.button
            className="idea52-enter"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setPct(0)}
            title="The walkable world isn't built yet — this regenerates the briefing."
          >
            ENTER IDEA52 →
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
