"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Mail, Github, Linkedin, FileText, Briefcase, Sparkles,
  MessageSquare, ArrowUpRight, ArrowRight,
} from "lucide-react";
import { contact, persona, type Mood } from "@/lib/content";
import { SectionIntro } from "./work-section";

const ICONS = {
  mail: Mail,
  github: Github,
  linkedin: Linkedin,
  file: FileText,
  briefcase: Briefcase,
  sparkles: Sparkles,
  message: MessageSquare,
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
        <div className="contact-col">
          <motion.div
            className="panel"
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
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
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
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

        {/* --------------------------- right -------------------------- */}
        <motion.div
          className="panel panel--raised"
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        >
          <div className="msg-head">
            <span className="msg-icon"><MessageSquare size={16} /></span>
            <div>
              <b>Message {persona.name}</b>
              <em>Shashank&apos;s assistant · replies in ~24h</em>
            </div>
          </div>

          <p className="msg-bubble">
            Back from the work — I saw you looking. What brings you here?
          </p>

          <ul className="prompts">
            {contact.prompts.map((p) => {
              const Icon = ICONS[p.icon as keyof typeof ICONS];
              return (
                <li key={p.title}>
                  <a
                    href={`mailto:srivastavashashank46@gmail.com?subject=${encodeURIComponent(p.title)}`}
                    onMouseEnter={() => onMood("happy")}
                    onMouseLeave={() => onMood("idle")}
                  >
                    <span className="prompt-icon"><Icon size={16} /></span>
                    <span className="prompt-text">
                      <b>{p.title}</b>
                      <em>{p.sub}</em>
                    </span>
                    <ArrowRight size={15} className="prompt-go" />
                  </a>
                </li>
              );
            })}
          </ul>
        </motion.div>
      </div>
    </div>
  );
}
