"use client";

import Link from "next/link";
import ContactChat from "@/components/contact-chat";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Github, Linkedin, FileText, MessageSquare, ArrowUpRight } from "lucide-react";
import { contact, persona, type Mood } from "@/lib/content";
import { EASE, STAGE, bodyDelay } from "@/lib/motion";
import { SectionIntro } from "./work-section";

const ICONS = {
  mail: Mail,
  github: Github,
  linkedin: Linkedin,
  file: FileText,
} as const;

/** Live clock in the owner's timezone. */
function useLocalTime(timeZone = "Asia/Kolkata") {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const fmt = () =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone,
      }).format(new Date());
    setNow(fmt());
    const id = setInterval(() => setNow(fmt()), 1000 * 20);
    return () => clearInterval(id);
  }, [timeZone]);
  return now;
}

export default function ContactSection({ onMood }: { onMood: (m: Mood) => void }) {
  const time = useLocalTime();

  return (
    <div className="page">
      <SectionIntro index="04" label="CONTACT" text={contact.intro} />

      <div className="contact-grid">
        {/* --------------------------- left --------------------------- */}
        <div className="contact-col scroll-col">
          <motion.div
            className="panel"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: STAGE.duration, ease: EASE, delay: bodyDelay(0) }}
          >
            <div className="panel-head panel-head--flush">
              <span>FIND ME</span>
            </div>
            <ul className="links">
              {contact.links.map((l) => {
                const Icon = ICONS[l.icon as keyof typeof ICONS];
                return (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      target={l.href.startsWith("http") || l.href.endsWith(".pdf") ? "_blank" : undefined}
                      rel="noreferrer"
                      onMouseEnter={() => onMood("listening")}
                      onMouseLeave={() => onMood("idle")}
                    >
                      <span className="link-icon"><Icon size={16} /></span>
                      <span className="link-text">
                        <b>{l.label}</b>
                        <em>{l.value}</em>
                      </span>
                      <ArrowUpRight size={14} className="link-out" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </motion.div>

          <motion.div
            className="panel"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: STAGE.duration, ease: EASE, delay: bodyDelay(2) }}
          >
            <div className="whois">
              <div className="whois-avatar" aria-hidden />
              <div>
                <b>Shashank Srivastava</b>
                <em>AI DEVELOPER · INDIA</em>
              </div>
            </div>

            <div className="availability">
              <span className="dot" />
              Open to opportunities
              <span className="clock">{time ? `${time} IST` : "— IST"}</span>
            </div>

            <div className="panel-head panel-head--flush">
              <span>WHAT I&apos;M GOOD FOR</span>
            </div>
            <ul className="goodfor">
              {contact.goodFor.map((g) => (
                <li key={g.key}>
                  <span>{g.key}</span>
                  {g.text}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* The figure stands here — see .contact-grid. */}
        <div className="contact-gutter" aria-hidden />

        {/* --------------------------- right -------------------------- */}
        <motion.div
          className="panel panel--raised"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: STAGE.duration, ease: EASE, delay: bodyDelay(1) }}
        >
          <div className="msg-head">
            <span className="msg-icon"><MessageSquare size={16} /></span>
            <div>
              <b>Message {persona.name}</b>
              <em>Shashank&apos;s assistant · replies in ~24h</em>
            </div>
          </div>

          <ContactChat onMood={onMood} />

        </motion.div>
      </div>

      {/* Contact is the last stop in the section order, so this is where the
          site's footer belongs. Kept to one line: the checklist's four-column
          link farm would swamp a page that only has five destinations. */}
      <footer className="site-foot">
        <span>© {new Date().getFullYear()} Shashank Srivastava</span>
        <nav aria-label="Site information">
          <a href="/shashank-resume.pdf" target="_blank" rel="noreferrer">
            CV
          </a>
          <Link href="/colophon">Colophon</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
      </footer>
    </div>
  );
}
