"use client";

import { Volume2, VolumeX, Pause, Play, MessageSquareOff, Grid2x2, MoreHorizontal } from "lucide-react";
import { nowPlaying } from "@/lib/content";

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

/* Not rendered anywhere at the moment. It sat bottom-left, on top of the
   first column of every inner page; it is staged here, styled and wired,
   until there is a corner for it. See the note in page.tsx. */
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

