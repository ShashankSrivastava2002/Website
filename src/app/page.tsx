"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, FileText } from "lucide-react";

import BootPreloader from "@/components/boot-preloader";
import BottomTicker from "@/components/bottom-ticker";
import ChatWidget from "@/components/chat-widget";
import HeartBurst from "@/components/heart-burst";
import HomeSection from "@/components/sections/home-section";
import WorkSection from "@/components/sections/work-section";
import AboutSection from "@/components/sections/about-section";
import ContactSection from "@/components/sections/contact-section";
import { LikeCounter, NowPlaying, UtilityCluster } from "@/components/floating-ui";
import { persona, sections, type Section, type Mood } from "@/lib/content";
import { sectionFade } from "@/lib/motion";
import type { Pose } from "@/components/robot/poses";

// WebGL only ever runs in the browser.
const RobotStage = dynamic(() => import("@/components/robot"), { ssr: false });

/** Which pose the robot holds on each section. Home runs its own cycle. */
const SECTION_POSE: Record<Section, Pose> = {
  home: "idle",
  work: "work",
  about: "idle",
  contact: "bow",
};

export default function Page() {
  const [booting, setBooting] = useState(true);
  const [bootExiting, setBootExiting] = useState(false);
  const [section, setSection] = useState<Section>("home");
  const [mood, setMood] = useState<Mood>("idle");
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [returning, setReturning] = useState(false);

  // Skip the boot sequence on repeat visits within a session.
  useEffect(() => {
    if (sessionStorage.getItem("booted")) setBooting(false);
    if (localStorage.getItem("seen")) setReturning(true);
    localStorage.setItem("seen", "1");
  }, []);

  const finishBoot = useCallback(() => {
    sessionStorage.setItem("booted", "true");
    // The fade-out is a CSS transition and the unmount is on a timer, so the
    // layer always clears — an AnimatePresence exit would stall in a hidden
    // tab, where rAF is suspended, and trap the visitor on the preloader.
    setBootExiting(true);
    setTimeout(() => setBooting(false), 520);
  }, []);

  /* Ambient CSS animation (the grain layer, the ticker, the badge float)
     keeps compositing in a background tab — Chrome throttles it but does not
     stop it. The stylesheet pauses all three off this attribute. */
  useEffect(() => {
    const sync = () => {
      document.body.dataset.away = String(document.visibilityState === "hidden");
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // The tab title reflects the robot's mood, the way the reference does.
  useEffect(() => {
    document.title =
      mood === "idle"
        ? "SHASH·AI — Shashank Srivastava"
        : `SHASH·AI — Shashank Srivastava · ${mood}`;
  }, [mood]);

  useEffect(() => {
    if (section === "work") setMood("thinking");
    else if (section === "about") setMood("bashful");
    else if (section === "contact") setMood("listening");
    else setMood("idle");
  }, [section]);

  const handleMood = useCallback((m: Mood) => setMood(m), []);

  /* Every section change launches one tumble. Counting changes rather than
     watching `section` means re-selecting the current tab does nothing, which
     is what you want — the figure should not hop when nothing moved. */
  const [tumbleGen, setTumbleGen] = useState(0);

  /* Every like bumps this; the robot walks down its move list, so rapid likes
     escalate from a kick to the full dive. See robot/dance.ts. */
  const [danceGen, setDanceGen] = useState(0);
  const onLike = useCallback(() => setDanceGen((g) => g + 1), []);
  const firstSection = useRef(true);
  useEffect(() => {
    if (firstSection.current) {
      firstSection.current = false;
      return;
    }
    setTumbleGen((g) => g + 1);
  }, [section]);

  /** Topbar chat icon: go home, then put the caret in the ask box. */
  const jumpToChat = useCallback(() => {
    setSection("home");
    // one tick so the home section has mounted before we reach for its input
    setTimeout(() => {
      document.querySelector<HTMLInputElement>(".chat-input input")?.focus();
    }, 60);
  }, []);

  // The About page flips between the robot and the human figure. The state
  // lives here because both the 3D stage and the copy need to stay in sync.
  const [human, setHuman] = useState(false);
  const [morphGen, setMorphGen] = useState(0);

  // Landing on About plays the reveal on its own after a short beat; after
  // that it's on the visitor, via the figure's hit area.
  useEffect(() => {
    if (section !== "about") {
      setHuman(false);
      return;
    }
    const id = setTimeout(() => {
      setHuman(true);
      setMorphGen((g) => g + 1);
    }, 800);
    return () => clearTimeout(id);
  }, [section]);

  /** The identity flip is triggered by clicking the figure, not on a timer. */
  const flip = useCallback(() => {
    setHuman((v) => !v);
    setMorphGen((g) => g + 1);
  }, []);

  return (
    <div data-section={section}>
      {booting && (
        <div className="boot-layer" data-exiting={bootExiting}>
          <BootPreloader onDone={finishBoot} />
        </div>
      )}

      {/* -------------------- the robot, behind everything -------------------- */}
      <div
        className="robot-layer"
        data-boot={booting}
        data-front={section === "about"}
        aria-hidden
      >
        <RobotStage
          pose={SECTION_POSE[section]}
          cycleHome={!booting && section === "home"}
          paused={paused}
          morph={section === "about" && human ? 1 : 0}
          /* -2.15 landed the figure at x=280px in a 1470px viewport, 112px
             left of the About figure column's own centre (392px) — its shoe
             sat on the TAP TO REVEAL pill and the 99% ACC badge. At 34° fov
             and z=6.2 one world unit is 212px, so -1.62 centres it in the
             column; it also brings the figure under the heart emitter, which
             sits at 50% - 330px = 405px. */
          offsetX={section === "about" ? -1.62 : 0}
          tumbleGen={tumbleGen}
          danceGen={danceGen}
          walkIn
        />
      </div>

      {/* ------------------------------ chrome ------------------------------ */}
      <header className="topbar">
        <div className="brand">
          <h2>{persona.owner}</h2>
          <p>{persona.role}</p>
        </div>

        <LikeCounter onLike={onLike} />

        <nav className="nav" aria-label="Sections">
          {/* These two were <span aria-hidden> styled to look exactly like
              buttons — a chat bubble and a document icon that did nothing when
              clicked. They now do the obvious thing each one promises. */}
          <button
            className="nav-icon"
            onClick={jumpToChat}
            aria-label="Ask the assistant a question"
            title="Ask a question"
          >
            <MessageCircle size={15} />
          </button>
          <a
            className="nav-icon nav-icon--plain"
            href="/shashank-resume.pdf"
            target="_blank"
            rel="noreferrer"
            aria-label="Open CV as a PDF in a new tab"
            title="CV (PDF)"
          >
            <FileText size={14} />
          </a>
          {sections.map((s) => (
            <button
              key={s}
              className="nav-item"
              data-active={section === s}
              onClick={() => setSection(s)}
            >
              {s.toUpperCase()}
              {section === s && (
                <motion.span
                  layoutId="nav-pill"
                  className="nav-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* ------------------------------ pages ------------------------------ */}
      <main className="stage" id="main">
        {/* Overlapping crossfade: the outgoing and incoming sections share a
            grid cell. `mode="wait"` would stall forever in a hidden tab, since
            the exit animation never gets a frame. */}
        <AnimatePresence>
          <motion.div key={section} {...sectionFade} className="stage-inner">
            {section === "home" && <HomeSection />}
            {section === "work" && <WorkSection />}
            {section === "about" && (
              <AboutSection human={human} gen={morphGen} onFlip={flip} />
            )}
            {section === "contact" && <ContactSection onMood={handleMood} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --------------------------- floating UI --------------------------- */}
      {/* Love shots leave the FIGURE in a V, not the counter — see heart-burst.
          On About the robot is offset into the left column, so the emitter
          follows it. */}
      <HeartBurst gen={danceGen} offset={section === "about" ? -330 : 0} />

      {/* The chat follows the visitor instead of living only on Home — it is
          the persona, and having it disappear the moment you click Work made
          the rest of the site feel like a different product. Its prompts
          change per section (see sectionSuggestions). */}
      <aside className="chat-dock" data-section={section}>
        <ChatWidget onMood={handleMood} returning={returning} section={section} />
      </aside>

      <NowPlaying />
      <BottomTicker />
      <UtilityCluster
        paused={paused}
        setPaused={setPaused}
        muted={muted}
        setMuted={setMuted}
      />
    </div>
  );
}
