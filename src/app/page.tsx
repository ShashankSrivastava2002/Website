"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, FileText } from "lucide-react";

import BootPreloader from "@/components/boot-preloader";
import HomeSection from "@/components/sections/home-section";
import WorkSection from "@/components/sections/work-section";
import Idea52Section from "@/components/sections/idea52-section";
import AboutSection from "@/components/sections/about-section";
import ContactSection from "@/components/sections/contact-section";
import {
  LikeCounter,
  NowPlaying,
  UtilityCluster,
  FeaturedIdea,
} from "@/components/floating-ui";
import { persona, sections, type Section, type Mood } from "@/lib/content";
import type { Pose } from "@/components/robot/poses";

// WebGL only ever runs in the browser.
const RobotStage = dynamic(() => import("@/components/robot"), { ssr: false });

const fade = {
  initial: { opacity: 0, y: 18, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(6px)" },
  transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const },
};

/** Which pose the robot holds on each section. Home runs its own cycle. */
const SECTION_POSE: Record<Section, Pose> = {
  home: "idle",
  work: "work",
  idea52: "idle",
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

  // The robot hides behind the Idea52 starfield, which is its own dark world.
  const showRobot = section !== "idea52";

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
        data-hidden={!showRobot}
        data-boot={booting}
        data-front={section === "about"}
        aria-hidden
      >
        <RobotStage
          pose={SECTION_POSE[section]}
          cycleHome={!booting && section === "home"}
          paused={paused}
          morph={section === "about" && human ? 1 : 0}
          offsetX={section === "about" ? -2.15 : 0}
          walkIn
        />
      </div>

      {/* ------------------------------ chrome ------------------------------ */}
      <header className="topbar">
        <div className="brand">
          <h2>{persona.owner}</h2>
          <p>{persona.role}</p>
        </div>

        <LikeCounter />

        <nav className="nav" aria-label="Sections">
          <span className="nav-icon" aria-hidden>
            <MessageCircle size={15} />
          </span>
          <span className="nav-icon nav-icon--plain" aria-hidden>
            <FileText size={14} />
          </span>
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
      <main className="stage">
        {/* Overlapping crossfade: the outgoing and incoming sections share a
            grid cell. `mode="wait"` would stall forever in a hidden tab, since
            the exit animation never gets a frame. */}
        <AnimatePresence>
          <motion.div key={section} {...fade} className="stage-inner">
            {section === "home" && (
              <HomeSection onMood={handleMood} returning={returning} />
            )}
            {section === "work" && <WorkSection />}
            {section === "idea52" && <Idea52Section />}
            {section === "about" && (
              <AboutSection human={human} gen={morphGen} onFlip={flip} />
            )}
            {section === "contact" && <ContactSection onMood={handleMood} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* --------------------------- floating UI --------------------------- */}
      {section === "home" && <FeaturedIdea onOpen={() => setSection("idea52")} />}
      <NowPlaying />
      <UtilityCluster
        paused={paused}
        setPaused={setPaused}
        muted={muted}
        setMuted={setMuted}
      />
    </div>
  );
}
