"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { EASE } from "@/lib/motion";
import Diagram from "@/components/diagrams";
import RichText from "@/components/rich-text";

/**
 * The depth behind a card: a full-viewport case study, shared by Experience
 * and Lab so the two still read as one system.
 *
 * Portalled to <body> on purpose. Every section mounts inside `.stage-inner`,
 * whose entrance animation leaves `filter: blur(0px)` behind — and any filter
 * other than `none` makes an element the containing block for position:fixed.
 * Rendered in place, this "full-viewport" layer would be sized and clipped to
 * the stage. The section attribute is carried across so the per-section
 * accent still resolves out here.
 */

export type CaseStudy = {
  /** Mono id shown in the pill, e.g. PROJ_JED. */
  pill: string;
  /** Optional second pill, for a short label the copy carries (FLAGSHIP). */
  badge?: string;
  title: string;
  meta: string[];
  diagram?: string;
  diagramAlt?: string;
  glance: [string, ReactNode][];
  stack?: string[];
  body: ReactNode;
};

export default function CaseStudyDialog({
  items,
  open,
  section,
  onClose,
  onStep,
}: {
  items: CaseStudy[];
  /** Index of the open item, or null when closed. */
  open: number | null;
  section: string;
  onClose: () => void;
  onStep: (next: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  /* Closing does NOT go through an AnimatePresence exit. A framer exit only
     finishes if it gets animation frames; when it does not, the layer stays
     mounted at z-modal and swallows every click on the page underneath. The
     boot preloader hit the same trap. So: the moment it closes, a CSS state
     makes it transparent AND click-through at once, and a plain timer
     unmounts it — neither depends on rAF. */
  const [shown, setShown] = useState<number | null>(open);
  const [closing, setClosing] = useState(false);
  const shownRef = useRef<number | null>(open);

  useEffect(() => {
    if (open !== null) {
      shownRef.current = open;
      setShown(open);
      setClosing(false);
      return;
    }
    if (shownRef.current === null) return;
    setClosing(true);
    const t = window.setTimeout(() => {
      shownRef.current = null;
      setShown(null);
      setClosing(false);
    }, 320);
    return () => window.clearTimeout(t);
  }, [open]);

  const isOpen = open !== null;
  const item = shown !== null ? items[shown] : null;

  // Remember what had focus, move it into the dialog, and give it back on close.
  useEffect(() => {
    if (!isOpen) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => returnTo.current?.focus({ preventScroll: true });
  }, [isOpen]);

  // Every item starts at its top, not wherever the previous one was scrolled.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    if (!isOpen || open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        onStep((open + 1) % items.length);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        onStep((open - 1 + items.length) % items.length);
      } else if (e.key === "Tab" && panelRef.current) {
        // Keep keyboard focus inside the dialog while it is open.
        const f = panelRef.current.querySelectorAll<HTMLElement>(
          'button, a[href], [tabindex]:not([tabindex="-1"])'
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, open, items.length, onClose, onStep]);

  if (!mounted || !item || shown === null) return null;

  const pad = (n: number) => String(n).padStart(2, "0");
  const at = shown;
  const next = items[(at + 1) % items.length];

  return createPortal(
    <div className="cs" data-section={section} data-closing={closing || undefined}>
      <div
        className="cs-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cs-title"
        tabIndex={-1}
      >
        <header className="cs-bar">
          <button type="button" className="cs-btn" onClick={onClose}>
            <ArrowLeft size={14} aria-hidden /> back
          </button>
          <nav className="cs-pager" aria-label="Case studies">
            <button
              type="button"
              className="cs-btn cs-btn--icon"
              onClick={() => onStep((at - 1 + items.length) % items.length)}
              aria-label="Previous"
            >
              <ArrowLeft size={14} aria-hidden />
            </button>
            <span className="cs-count" aria-live="polite">
              {pad(at + 1)} / {pad(items.length)}
            </span>
            <button
              type="button"
              className="cs-btn cs-btn--icon"
              onClick={() => onStep((at + 1) % items.length)}
              aria-label="Next"
            >
              <ArrowRight size={14} aria-hidden />
            </button>
          </nav>
        </header>

        <div className="cs-scroll" ref={scrollRef}>
          <motion.article
            key={item.pill}
            className="cs-doc"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="cs-head">
              <div className="cs-pills">
                <span className="cs-pill">{item.pill}</span>
                {item.badge && <span className="cs-pill cs-pill--quiet">{item.badge}</span>}
              </div>
              <h2 id="cs-title" className="cs-title">
                {item.title}
              </h2>
              <p className="cs-meta">{item.meta.join("  ·  ")}</p>
            </div>

            <div className="cs-grid">
              <div className="cs-main">
                {item.diagram && (
                  <figure className="cs-hero">
                    <Diagram id={item.diagram} alt={item.diagramAlt ?? ""} />
                  </figure>
                )}
                {item.body}
              </div>

              <aside className="cs-side">
                <section className="cs-card">
                  <h3 className="cs-label">At a glance</h3>
                  <dl className="cs-glance">
                    {item.glance.map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{v}</dd>
                      </div>
                    ))}
                  </dl>
                </section>

                {item.stack && item.stack.length > 0 && (
                  <section className="cs-card">
                    <h3 className="cs-label">Stack</h3>
                    <div className="cs-chips">
                      {item.stack.map((t) => (
                        <span className="wcard-chip" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {items.length > 1 && (
                  <button
                    type="button"
                    className="cs-next"
                    onClick={() => onStep((at + 1) % items.length)}
                  >
                    <span className="cs-label">Next</span>
                    <span className="cs-next-title">{next.title}</span>
                    <ArrowRight size={16} className="cs-next-arrow" aria-hidden />
                  </button>
                )}
              </aside>
            </div>
          </motion.article>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ------------------------------------------------------------------ */
/* Body blocks.                                                        */
/*                                                                     */
/* The reason the old detail column read as documentation was that     */
/* every section looked the same. These are deliberately different     */
/* surfaces — a lead, a ruled passage, a tinted callout, a numbered     */
/* card, a closing panel — so a case study has rhythm.                 */
/* ------------------------------------------------------------------ */

/** The opening sentence, set large. */
export function CsLead({ text }: { text: string }) {
  return (
    <p className="cs-lead">
      <RichText text={text} />
    </p>
  );
}

type Tone = "rule" | "callout" | "card" | "impact";

export function CsSection({
  n,
  label,
  tone = "rule",
  warn,
  children,
}: {
  n?: string;
  label: string;
  tone?: Tone;
  warn?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={`cs-sec cs-sec--${tone}`} data-warn={warn || undefined}>
      <h3 className="cs-label">
        <i aria-hidden />
        {n ? `${n} · ${label}` : label}
      </h3>
      {children}
    </section>
  );
}

/** A numbered list with accent numerals — lives inside a card section. */
export function CsNumbered({
  items,
}: {
  items: { text: string; inferred?: boolean }[];
}) {
  return (
    <ol className="cs-list">
      {items.map((it, i) => (
        <li key={i}>
          <span className="cs-num" aria-hidden>
            {String(i + 1).padStart(2, "0")}
          </span>
          <span>
            <RichText text={it.text} />
            {it.inferred && (
              <abbr className="inferred" title="Inferred from the nature of the work — confirm before relying on it">
                †
              </abbr>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Short phrases as pills. */
export function CsChips({ items }: { items: string[] }) {
  return (
    <div className="cs-pillrow">
      {items.map((t) => (
        <span className="cs-phrase" key={t}>
          {t}
        </span>
      ))}
    </div>
  );
}

export function CsProse({ text }: { text: string }) {
  return (
    <p className="cs-prose">
      <RichText text={text} />
    </p>
  );
}
