"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { MessageCircle, FileText, Github } from "lucide-react";

import BootPreloader from "@/components/boot-preloader";
import BottomTicker from "@/components/bottom-ticker";
import ChatWidget from "@/components/chat-widget";
import HeartBurst from "@/components/heart-burst";
import HomeSection from "@/components/sections/home-section";
import WorkSection from "@/components/sections/work-section";
import LabSection from "@/components/sections/lab-section";
import AboutSection from "@/components/sections/about-section";
import ContactSection from "@/components/sections/contact-section";
import { LikeCounter, NowPlaying, UtilityCluster } from "@/components/floating-ui";
import { persona, sections, sectionLabels, contact, type Section, type Mood } from "@/lib/content";
import { sectionFade } from "@/lib/motion";
import type { Pose } from "@/components/robot/poses";

// WebGL only ever runs in the browser.
const RobotStage = dynamic(() => import("@/components/robot"), { ssr: false });

/**
 * Where the figure stands, in world units. One unit is ~216px at this camera
 * (34 fov, z 6.2).
 *
 * Home pushes it right of centre: the hero copy now occupies the left half
 * where a wordmark used to, and at 0 the figure's head landed across the
 * proof numbers. About pulls it left into its own column — see .about-grid.
 */
const FIGURE_X: Record<Section, number> = {
  /* Centred. It sat right of centre to clear the hero copy that used to
     occupy the left half; with that gone there is nothing to clear. */
  home: 0,
  work: 0,
  /* Lab has no gutter — its cards want the width — so the figure goes left,
     under the tracks panel, where the column is empty below y470. At 0 it
     stood behind the first card and the blurb was reading through chrome. */
  lab: -2.2,
  about: -1.62,
  contact: 0,
};

/** Which pose the robot holds on each section. Home runs its own cycle. */
const SECTION_POSE: Record<Section, Pose> = {
  home: "idle",
  work: "work",
  lab: "work",
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
    if (section === "work" || section === "lab") setMood("thinking");
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
  /** Pulled from the contact links so there is one source of truth for it. */
  const githubHref = contact.links.find((l) => l.icon === "github")?.href;

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
    /* The section choreography — blur, desaturate, stagger — is framer-motion,
       which does not read prefers-reduced-motion on its own. `reducedMotion="user"`
       makes it drop transforms and opacity animations for anyone who has asked
       the OS for stillness, which the CSS animations already respected. */
    <MotionConfig reducedMotion="user">
    <div data-section={section}>
      {booting && (
        <div className="boot-layer" data-exiting={bootExiting}>
          <BootPreloader onDone={finishBoot} />
        </div>
      )}

      {/* -------------------- the robot, behind everything -------------------- */}
      {/* Experience and Lab are dense reading surfaces now — a master-detail
          rail plus long-form body copy, with no empty column left for the
          figure to stand in. Behind text it was a legibility problem, not
          depth, so it steps off for those two and keeps Home, About and
          Contact where it has room. */}
      <div
        className="robot-layer"
        data-boot={booting}
        data-front={section === "about"}
        data-hidden={section === "work" || section === "lab"}
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
          offsetX={FIGURE_X[section]}
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

      </header>

      {/* The nav runs down the right gutter rather than across the top. The
          stage is capped at 1240px inside a wider viewport, so there was
          already a ~100px margin the old horizontal pill never used — moving
          into it clears the top of the page entirely and, incidentally, gives
          the labels room to say EXPERIENCE where a pill could only fit WORK.
          Both label lengths are in the DOM so the narrow breakpoint can swap
          to the short form without JavaScript. */}
      <nav className="nav" aria-label="Sections">
        {sections.map((s, i) => (
          <button
            key={s}
            className="nav-item"
            data-active={section === s}
            aria-current={section === s ? "page" : undefined}
            onClick={() => setSection(s)}
          >
            <span className="nav-index">{String(i + 1).padStart(2, "0")}</span>
            <span className="nav-label">{sectionLabels[s]}</span>
            <span className="nav-label nav-label--short">{s.toUpperCase()}</span>
            {section === s && (
              <motion.span
                layoutId="nav-pill"
                className="nav-pill"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
          </button>
        ))}

        <span className="nav-rule" aria-hidden />

        {/* CV and the repo are what a recruiter reaches for first, and both
            used to be several clicks deep on Contact. */}
        <div className="nav-utils">
          <button
            className="nav-icon"
            onClick={jumpToChat}
            aria-label="Ask the assistant a question"
            title="Ask a question"
          >
            <MessageCircle size={14} />
          </button>
          <a
            className="nav-icon"
            href="/shashank-resume.pdf"
            target="_blank"
            rel="noreferrer"
            aria-label="Open CV as a PDF in a new tab"
            title="CV (PDF)"
          >
            <FileText size={13} />
          </a>
          {githubHref && (
            <a
              className="nav-icon"
              href={githubHref}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub profile"
              title="GitHub"
            >
              <Github size={13} />
            </a>
          )}
        </div>
      </nav>

      {/* ------------------------------ pages ------------------------------ */}
      <main className="stage" id="main">
        {/* Overlapping crossfade: the outgoing and incoming sections share a
            grid cell. `mode="wait"` would stall forever in a hidden tab, since
            the exit animation never gets a frame. */}
        <AnimatePresence>
          <motion.div key={section} {...sectionFade} className="stage-inner">
            {section === "home" && <HomeSection />}
            {section === "work" && <WorkSection />}
            {section === "lab" && <LabSection />}
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
      <HeartBurst gen={danceGen} offset={Math.round(FIGURE_X[section] * 216)} />

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
    </MotionConfig>
  );
}
