"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Send } from "lucide-react";
import { contactFlow, type Mood } from "@/lib/content";

const EMAIL = "srivastavashashank46@gmail.com";

type Line = { from: "bot" | "you"; text: string };
type Step = "intent" | "name" | "email" | "detail" | "done";

/** Loose check — enough to catch a typo, not strict enough to reject a real address. */
const looksLikeEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/**
 * The Contact conversation.
 *
 * Static prompt chips that fired straight into `mailto:` skipped the part that
 * matters — the visitor arrives with something to say and no idea how to open.
 * This asks, in order, what they want, who they are, how to reach them, and
 * what it is about, then hands back a pre-filled draft.
 *
 * There is no server. The final step composes a `mailto:` in the visitor's own
 * client, so nothing is transmitted from this page and nothing is stored.
 */
export default function ContactChat({ onMood }: { onMood: (m: Mood) => void }) {
  const [log, setLog] = useState<Line[]>([{ from: "bot", text: contactFlow.opener }]);
  const [step, setStep] = useState<Step>("intent");
  const [intent, setIntent] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [detail, setDetail] = useState("");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [log, step]);

  useEffect(() => {
    if (step !== "intent" && step !== "done") input.current?.focus();
  }, [step]);

  const say = (from: "bot" | "you", text: string) =>
    setLog((l) => [...l, { from, text }]);

  function pickIntent(id: string, label: string) {
    setIntent(id);
    say("you", label);
    onMood("happy");
    setTimeout(() => {
      say("bot", contactFlow.ack[id]);
      setStep("name");
    }, 480);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;

    if (step === "email" && !looksLikeEmail(v)) {
      setError("That doesn't look like an email address — mind checking it?");
      return;
    }
    setError("");
    say("you", v);
    setDraft("");
    onMood("thinking");

    if (step === "name") {
      setName(v);
      setTimeout(() => {
        say("bot", contactFlow.askEmail(v));
        setStep("email");
        onMood("listening");
      }, 480);
    } else if (step === "email") {
      setEmail(v);
      setTimeout(() => {
        say("bot", contactFlow.askDetail);
        setStep("detail");
        onMood("listening");
      }, 480);
    } else if (step === "detail") {
      setDetail(v);
      setTimeout(() => {
        say("bot", contactFlow.done);
        setStep("done");
        onMood("happy");
      }, 480);
    }
  }

  const mailto = () => {
    const subject = contactFlow.subjects[intent] ?? "Hello";
    const body = `Hi Shashank,\n\n${detail}\n\n— ${name}\n${email}`;
    return `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const placeholder =
    step === "name" ? "your name…" : step === "email" ? "you@company.com" : "a line or two…";

  return (
    <div className="cchat">
      <div className="cchat-log" ref={scroller} aria-live="polite">
        {log.map((l, i) => (
          <div key={i} className={`cchat-msg cchat-msg--${l.from}`}>
            {l.text}
          </div>
        ))}
      </div>

      {step === "intent" && (
        <ul className="cchat-intents">
          {contactFlow.intents.map((o) => (
            <li key={o.id}>
              <button
                onClick={() => pickIntent(o.id, o.label)}
                onMouseEnter={() => onMood("listening")}
                onMouseLeave={() => onMood("idle")}
              >
                <span className="cchat-intent-text">
                  <b>{o.label}</b>
                  <em>{o.sub}</em>
                </span>
                <ArrowRight size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(step === "name" || step === "email" || step === "detail") && (
        <form className="cchat-input" onSubmit={submit}>
          <input
            ref={input}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (error) setError("");
            }}
            type={step === "email" ? "email" : "text"}
            placeholder={placeholder}
            aria-label={placeholder}
            aria-invalid={!!error}
          />
          <button type="submit" aria-label="Reply" disabled={!draft.trim()}>
            <ArrowRight size={15} />
          </button>
        </form>
      )}

      {error && (
        <p className="cchat-error" role="alert">
          {error}
        </p>
      )}

      {step === "done" && (
        <a className="cchat-send" href={mailto()}>
          <Send size={14} />
          Open the draft
        </a>
      )}
    </div>
  );
}
