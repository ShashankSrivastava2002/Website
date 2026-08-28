"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

/**
 * The love shots.
 *
 * Measured from `ref_images/like_dancw.mov` by isolating the pink pixels and
 * fitting each heart's path. Eight clean tracks split into two tight groups:
 *
 *   right-going  dx/dy -0.342 -0.406 -0.401 -0.381   => +18.9° .. +22.1°
 *   left-going   dx/dy +0.343 +0.367 +0.291 +0.392   => -16.2° .. -21.4°
 *
 * So they do not scatter — they fire in a symmetric **V of about ±20° from
 * vertical**, and the fitted lines converge at (1456, 699) in a 2630×1610
 * frame, which is the robot's horizontal centre at chest height. They leave
 * from the FIGURE, not from the counter in the header.
 */

const ANGLE = 20; // degrees from vertical, per the fit
const RISE = 430; // px travelled before it fades out

type Shot = { id: number; dx: number; dy: number; s: number; r: number; d: number };

export default function HeartBurst({ gen, offset = 0 }: { gen: number; offset?: number }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const seq = useRef(0);
  const side = useRef(1);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // Alternate arms so a rapid burst builds both sides of the V evenly
    // rather than landing at random.
    const arm = (side.current *= -1);
    const spread = ANGLE + (Math.random() * 6 - 3);
    const rad = (spread * Math.PI) / 180;
    const rise = RISE * (0.82 + Math.random() * 0.36);

    const id = (seq.current += 1);
    const shot: Shot = {
      id,
      dx: Math.tan(rad) * rise * arm,
      dy: -rise,
      s: 0.75 + Math.random() * 0.5,
      r: arm * (12 + Math.random() * 26),
      d: 1500 + Math.random() * 350,
    };
    setShots((h) => [...h, shot]);
    const t = setTimeout(() => setShots((h) => h.filter((x) => x.id !== id)), shot.d + 60);
    return () => clearTimeout(t);
  }, [gen]);

  return (
    <div className="hearts" style={{ ["--hx-offset" as string]: `${offset}px` }} aria-hidden>
      {shots.map((h) => (
        <Heart
          key={h.id}
          size={20}
          className="heart-shot"
          style={
            {
              "--dx": `${h.dx}px`,
              "--dy": `${h.dy}px`,
              "--s": h.s,
              "--r": `${h.r}deg`,
              animationDuration: `${h.d}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
