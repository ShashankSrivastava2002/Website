"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { Home } from "@/components/sections/home";
import { Work } from "@/components/sections/work";
import { About } from "@/components/sections/about";
import { Contact } from "@/components/sections/contact";
import { Likes } from "@/components/ui/likes";
import { Hearts } from "@/components/ui/hearts";
import { Ticker } from "@/components/ui/ticker";
import { persona, sections, type Mood, type Section } from "@/content/site";
import type { Pose } from "@/components/stage";

/* The stage is client-only and pulls in three, drei and a postprocessing chain.
   Server-rendering it would mean shipping all of that twice and reconciling a
   canvas that cannot exist on the server, so it loads on the client alone and
   the page is fully readable before it arrives. */
const Stage = dynamic(() => import("@/components/stage"), { ssr: false });

/** What the figure does on each section. */
const SECTION_POSE: Record<Section, Pose> = {
  home: "idle",
  work: "think",
  about: "idle",
  contact: "wave",
};

/** How far the figure slides out of centre so a section can use the space. */
const SECTION_OFFSET: Record<Section, number> = {
  home: 0,
  work: 2.3,
  about: -2.15,
  contact: 2.1,
};

export default function Page() {
  const [section, setSection] = useState<Section>("home");
  const [mood, setMood] = useState<Mood>("idle");
  const [human, setHuman] = useState(false);

  /* Generation counters rather than booleans. A boolean cannot express "again",
     so a second like during a dance, or re-selecting the current tab, would
     either restart something mid-flight or do nothing at all. Counting the
     events lets each consumer decide. */
  const [tumbleGen, setTumbleGen] = useState(0);
  const [danceGen, setDanceGen] = useState(0);
  const onLike = useCallback(() => setDanceGen((g) => g + 1), []);

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setTumbleGen((g) => g + 1);
  }, [section]);

  // Landing on About plays the reveal by itself; after that it's on the visitor.
  useEffect(() => {
    if (section !== "about") {
      setHuman(false);
      return;
    }
    const id = setTimeout(() => setHuman(true), 1400);
    return () => clearTimeout(id);
  }, [section]);

  const pose: Pose = mood === "thinking" ? "think" : SECTION_POSE[section];

  return (
    <>
      <div className="stage">
        <Stage
          pose={pose}
          cycleHome={section === "home"}
          morph={section === "about" && human ? 1 : 0}
          walkIn
          offsetX={SECTION_OFFSET[section]}
          tumbleGen={tumbleGen}
          danceGen={danceGen}
        />
      </div>

      <Hearts gen={danceGen} offsetX={SECTION_OFFSET[section] * 145} />

      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="brand-name">{persona.owner}</div>
            <div className="mono brand-role">{persona.role}</div>
          </div>

          <Likes onLike={onLike} />

          <nav className="nav">
            {sections.map((s) => (
              <button key={s} data-on={section === s} onClick={() => setSection(s)}>
                {s}
              </button>
            ))}
          </nav>
        </header>

        <main className="view">
          <Home on={section === "home"} onMood={setMood} />
          <Work on={section === "work"} />
          <About on={section === "about"} human={human} onSwap={() => setHuman((h) => !h)} />
          <Contact on={section === "contact"} />
        </main>

        <Ticker />
      </div>
    </>
  );
}
