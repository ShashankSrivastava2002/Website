"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { bootLines } from "@/lib/content";

export default function BootPreloader({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0);
  const done = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 2600;
    let raf = 0;

    const finish = () => {
      if (done.current) return;
      done.current = true;
      setPct(100);
      setTimeout(onDone, 420);
    };

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION);
      // ease-out so the counter decelerates into 100
      setPct(Math.round((1 - Math.pow(1 - p, 2.2)) * 100));
      if (p < 1) raf = requestAnimationFrame(tick);
      else finish();
    };

    raf = requestAnimationFrame(tick);

    // rAF is suspended entirely in a background tab, so the sequence above
    // would never complete if the page opens unfocused. Timers still fire, so
    // this guarantees the boot always ends.
    const backstop = setTimeout(finish, DURATION + 300);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
    };
  }, [onDone]);

  // Which boot line is showing: divide the run into equal slices.
  const step = Math.min(bootLines.length - 1, Math.floor((pct / 100) * bootLines.length));

  return (
    <div className="boot">
      <div className="boot-inner">
        <div className="boot-bar">
          <motion.div
            className="boot-bar-fill"
            style={{ width: `${pct}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        <div className="boot-meta">
          <span className="boot-pct">{String(pct).padStart(3, "0")}</span>
          <span className="boot-line">{bootLines[step]}</span>
        </div>
      </div>
    </div>
  );
}
