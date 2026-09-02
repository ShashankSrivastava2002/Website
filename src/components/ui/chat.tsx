"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";

import { fallbackReply, replies, type Mood } from "@/content/site";

/**
 * The persona, answering questions.
 *
 * Matching is a keyword scan, not a model — every reply is written by hand in
 * `content/site.ts`. That is a deliberate limit: a portfolio that invents facts
 * about the person whose portfolio it is fails in the one way it cannot afford
 * to, so it only ever says things that were typed on purpose.
 */
function matchReply(q: string) {
  const text = q.toLowerCase();
  let best: (typeof replies)[number] | null = null;
  let bestScore = 0;

  for (const r of replies) {
    const score = r.keys.reduce((n, k) => (text.includes(k) ? n + k.length : n), 0);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return best ?? { text: fallbackReply, mood: "thinking" as Mood };
}

/** Reveal a line one character at a time, then hold. */
function useTypewriter(text: string, cps = 42) {
  const [out, setOut] = useState("");
  useEffect(() => {
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps]);
  return out;
}

export function Chat({
  greeting,
  suggestions,
  onMood,
}: {
  greeting: string;
  suggestions: string[];
  onMood?: (m: Mood) => void;
}) {
  const [line, setLine] = useState(greeting);
  const [draft, setDraft] = useState("");
  const shown = useTypewriter(line);
  const input = useRef<HTMLInputElement>(null);

  const ask = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      const r = matchReply(q);
      setLine(r.text);
      onMood?.(r.mood);
      setDraft("");
    },
    [onMood]
  );

  return (
    <div className="chat">
      <p className="mono">SHASH SPEAKING</p>
      <p className="chat-line">
        {shown}
        {shown.length < line.length && <i className="caret" />}
      </p>

      <div className="chips">
        {suggestions.map((s) => (
          <button key={s} className="chip" onClick={() => ask(s)}>
            {s}
          </button>
        ))}
      </div>

      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
      >
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ask shash something…"
          aria-label="Ask a question"
        />
        <button type="submit" aria-label="Send">
          <ArrowRight size={14} />
        </button>
      </form>
    </div>
  );
}
