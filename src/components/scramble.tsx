"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "0123456789";

/**
 * Rolls through random digits before settling on `value`. Used for the About
 * stats and the like counter, so numbers always arrive with a bit of noise
 * rather than just appearing.
 *
 * `value` may carry a prefix/suffix ("20M+", "500K+"); only the leading digits
 * scramble, everything else is preserved.
 */
export default function Scramble({
  value,
  duration = 900,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const match = value.match(/^(\d+)(.*)$/);
  const digits = match ? match[1] : "";
  const suffix = match ? match[2] : value;

  const [shown, setShown] = useState(digits);
  const raf = useRef(0);

  useEffect(() => {
    if (!digits) return;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // Digits lock in left-to-right as the sweep progresses.
      const locked = Math.floor(p * digits.length * 1.15);
      let out = "";
      for (let i = 0; i < digits.length; i++) {
        out +=
          i < locked
            ? digits[i]
            : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setShown(out);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setShown(digits);
    };

    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [digits, duration]);

  return (
    <span className={className}>
      {shown}
      {suffix}
    </span>
  );
}
