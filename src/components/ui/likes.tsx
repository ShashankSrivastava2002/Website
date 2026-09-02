"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";

/**
 * The like counter, and the L key.
 *
 * The keyboard shortcut is the only way most people would ever find this, so
 * the affordance is spelled out next to the number rather than left to be
 * discovered.
 */
export function Likes({ onLike }: { onLike?: () => void }) {
  const [n, setN] = useState(11177);
  const [pop, setPop] = useState(false);

  const like = useCallback(() => {
    setN((v) => v + 1);
    setPop(true);
    setTimeout(() => setPop(false), 260);
    onLike?.();
  }, [onLike]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "l" || e.metaKey || e.ctrlKey || e.altKey) return;
      // Don't steal the key from someone typing a message.
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (/input|textarea/i.test(tag)) return;
      like();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [like]);

  return (
    <button className="likes" onClick={like} aria-label="Like — or press the L key">
      <Heart size={13} className="likes-heart" data-pop={pop} fill="currentColor" />
      <span>{n}</span>
      <em className="likes-hint">
        PRESS <b>L</b> TO LIKE
      </em>
    </button>
  );
}
