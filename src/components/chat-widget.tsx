"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { persona, replies, fallbackReply, suggestions, type Mood } from "@/lib/content";

type Msg = { from: "bot" | "you"; text: string };

/** Simple keyword scan — the reply with the most keyword hits wins. */
function matchReply(input: string) {
  const q = input.toLowerCase();
  let best: (typeof replies)[number] | null = null;
  let bestScore = 0;

  for (const r of replies) {
    const score = r.keys.reduce((n, k) => (q.includes(k) ? n + 1 : n), 0);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best ?? { text: fallbackReply, mood: "thinking" as Mood };
}

/** Types `text` out one character at a time. */
function useTypewriter(text: string, speed = 18) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return shown;
}

export default function ChatWidget({
  onMood,
  returning = false,
}: {
  onMood: (m: Mood) => void;
  returning?: boolean;
}) {
  const SUGGESTIONS = returning ? suggestions.returning : suggestions.first;
  const opener = returning ? persona.greetingReturning : persona.greeting;
  const [log, setLog] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  // The greeting types itself out on first paint; after that the typewriter
  // is driven by whatever reply is `pending`.
  const streaming = useTypewriter(pending ?? opener);
  const isStreaming = streaming.length < (pending ?? opener).length;

  useEffect(() => {
    onMood(isStreaming ? "speaking" : "idle");
  }, [isStreaming, onMood]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [log, streaming]);

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;

    // Move whatever is currently streaming into the log first.
    setLog((prev) => [
      ...prev,
      ...(pending ? [{ from: "bot" as const, text: pending }] : []),
      { from: "you" as const, text: q },
    ]);
    setDraft("");
    setPending(null);
    onMood("thinking");

    const { text, mood } = matchReply(q);
    // A beat of "thinking" before it answers, so the mood change is legible.
    setTimeout(() => {
      setPending(text);
      onMood(mood);
    }, 700);
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <span className="chat-name">{persona.name.toUpperCase()}</span>
        <span className="chat-status" data-busy={isStreaming}>
          {isStreaming ? "speaking" : "listening"}
        </span>
      </div>

      <div className="chat-log" ref={scroller}>
        {log.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.from}`}>
            {m.text}
          </div>
        ))}

        {/* the live, typing message */}
        <div className="chat-msg chat-msg--bot chat-msg--live">
          {streaming}
          <span className="caret" data-on={isStreaming} />
        </div>
      </div>

      <div className="chat-suggestions">
        <AnimatePresence initial={false}>
          {SUGGESTIONS.map((s) => (
            <motion.button
              key={s}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="chip"
              onClick={() => ask(s)}
              onMouseEnter={() => onMood("listening")}
              onMouseLeave={() => onMood(isStreaming ? "speaking" : "idle")}
            >
              <span className="chip-arrow">›</span> {s}
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => onMood("listening")}
          onBlur={() => onMood(isStreaming ? "speaking" : "idle")}
          placeholder={`ask ${persona.name} something…`}
          aria-label={`Ask ${persona.name}`}
        />
        <button type="submit" aria-label="Send" disabled={!draft.trim()}>
          <ArrowRight size={15} />
        </button>
      </form>
    </div>
  );
}
