"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@*+=-";

/**
 * Resolve text out of noise, one character at a time.
 *
 * Runs on a single interval rather than a timer per character: a 40-character
 * headline would otherwise schedule forty timeouts that all have to be torn
 * down if the value changes mid-flight, and missing one leaves a headline that
 * keeps scrambling after it has been replaced.
 */
export function useScramble(text: string, speed = 28, active = true) {
  const [out, setOut] = useState(active ? "" : text);
  const raf = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!active) {
      setOut(text);
      return;
    }
    let frame = 0;
    clearInterval(raf.current);
    raf.current = setInterval(() => {
      frame += 1;
      const settled = Math.floor(frame / 2);
      if (settled > text.length) {
        setOut(text);
        clearInterval(raf.current);
        return;
      }
      setOut(
        text
          .split("")
          .map((ch, i) => {
            if (i < settled || ch === " ") return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );
    }, speed);
    return () => clearInterval(raf.current);
  }, [text, speed, active]);

  return out;
}
