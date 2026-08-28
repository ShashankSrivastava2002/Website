"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart, Volume2, VolumeX, Pause, Play, MessageSquareOff, Grid2x2, MoreHorizontal } from "lucide-react";
import { nowPlaying } from "@/lib/content";

/* ------------------------------------------------------------------ */
/* like counter — ticks up slowly, like a live visitor count           */
/* ------------------------------------------------------------------ */

export function LikeCounter({ onLike }: { onLike?: () => void }) {
  const [n, setN] = useState(11174);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      // occasional organic-looking tick
      if (Math.random() < 0.45) {
        setN((v) => v + 1);
        setPop(true);
        setTimeout(() => setPop(false), 260);
      }
    }, 4200);
    return () => clearInterval(id);
  }, []);

  const like = useCallback(() => {
    setN((v) => v + 1);
    setPop(true);
    setTimeout(() => setPop(false), 260);

    onLike?.();
  }, [onLike]);

  // The L key also likes, matching the "press L to like" affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "l" && !/input|textarea/i.test((e.target as HTMLElement)?.tagName ?? "")) {
        like();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [like]);

  return (
    <button className="likes" onClick={like} aria-label="Like — or press the L key">
      <Heart size={13} className="likes-heart" data-pop={pop} />
      <span>{n.toLocaleString("en-US").replace(/,/g, "")}</span>
      {/* The L key already worked but nothing said so. The reference spells the
          shortcut out next to the counter, which is the only way anyone finds
          a keyboard affordance that has no other visible cue. */}
      <em className="likes-hint">
        PRESS <b>L</b> TO LIKE
      </em>

    </button>
  );
}

/* ------------------------------------------------------------------ */
/* now playing                                                         */
/* ------------------------------------------------------------------ */

export function NowPlaying() {
  return (
    <a className="nowplaying" href={nowPlaying.href} target="_blank" rel="noreferrer">
      <span className="np-art" aria-hidden />
      <span className="np-text">
        <span className="np-label">
          <i /> <i /> <i /> LAST JAMMED TO
        </span>
        <b>{nowPlaying.title}</b>
        <em>{nowPlaying.artist}</em>
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* utility cluster                                                     */
/* ------------------------------------------------------------------ */

export function UtilityCluster({
  paused,
  setPaused,
  muted,
  setMuted,
}: {
  paused: boolean;
  setPaused: (v: boolean) => void;
  muted: boolean;
  setMuted: (v: boolean) => void;
}) {
  return (
    <div className="utils">
      <button aria-label="Toggle quality" title="Quality">
        <Grid2x2 size={14} />
      </button>
      <button
        onClick={() => setMuted(!muted)}
        aria-label={muted ? "Unmute" : "Mute"}
        title={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      <button
        onClick={() => setPaused(!paused)}
        aria-label={paused ? "Resume animations" : "Pause animations"}
        title={paused ? "Resume animations" : "Pause animations"}
      >
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <button aria-label="Send feedback" title="Feedback">
        <MessageSquareOff size={14} />
      </button>
      <button aria-label="More" title="More">
        <MoreHorizontal size={14} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* featured idea strip                                                 */
/* ------------------------------------------------------------------ */

