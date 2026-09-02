"use client";

import { useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";

type Pop = { id: number; x: number; y: number; size: number; delay: number };

/**
 * A burst of hearts over the figure on every like.
 *
 * Keyed off a generation counter rather than a boolean, so likes in quick
 * succession stack instead of restarting one animation — the same reason the
 * dance takes a `danceGen`.
 */
export function Hearts({ gen, offsetX = 0 }: { gen: number; offsetX?: number }) {
  const [pops, setPops] = useState<Pop[]>([]);
  const seen = useRef(gen);

  useEffect(() => {
    if (gen === seen.current) return;
    seen.current = gen;

    const cx = window.innerWidth / 2 + offsetX;
    const cy = window.innerHeight * 0.42;
    const batch: Pop[] = Array.from({ length: 5 }, (_, i) => ({
      id: gen * 100 + i,
      x: cx + (Math.random() - 0.5) * 150,
      y: cy + (Math.random() - 0.5) * 60,
      size: 12 + Math.random() * 14,
      delay: i * 70,
    }));

    setPops((p) => [...p, ...batch]);
    const id = setTimeout(
      () => setPops((p) => p.filter((x) => !batch.some((b) => b.id === x.id))),
      1900
    );
    return () => clearTimeout(id);
  }, [gen, offsetX]);

  return (
    <div className="hearts" aria-hidden>
      {pops.map((p) => (
        <Heart
          key={p.id}
          className="heart"
          size={p.size}
          fill="currentColor"
          style={{ left: p.x, top: p.y, animationDelay: `${p.delay}ms` }}
        />
      ))}
    </div>
  );
}
