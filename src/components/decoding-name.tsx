"use client";

import { useEffect, useRef } from "react";

import { persona } from "@/lib/content";

/**
 * The name resolving out of noise, then the tagline arriving under it.
 *
 * The name is never written in this file. It is read off the heading's own
 * `aria-label`, which is also what a screen reader announces — so the visible
 * decode and the accessible name can never drift apart, and the copy stays in
 * content.ts where the rest of it lives.
 *
 * The characters are driven imperatively off one rAF loop rather than through
 * React state. At ~22 glyph swaps a second across twenty spans, re-rendering
 * the tree for each frame would be a lot of work to produce what is, in the
 * end, a `textContent` assignment.
 */

/* Two pools, and the difference between them is the whole effect.
 *
 * The first is a seed: digits and characters with no linguistic content, so
 * the opening frames read as a random value rather than as words. Digits are
 * listed twice so the pool leans numeric — an all-letter scramble starts
 * looking like language far too early.
 *
 * The second is narrowed to the target's own alphabet and case, so the last
 * few frames of every character are already *a* plausible letter before they
 * become the *right* one. That step is what makes it read as tuning rather
 * than as a slot machine stopping. */
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const DIGITS = "0123456789";
const MARKS = ".,:;'-·";

const SEED = DIGITS + DIGITS + UPPER + LOWER;

/** The pool a character settles through, matched to what it is becoming. */
function settlePool(ch: string) {
  if (ch >= "A" && ch <= "Z") return UPPER;
  if (ch >= "a" && ch <= "z") return LOWER;
  if (ch >= "0" && ch <= "9") return DIGITS;
  return MARKS;
}

/** Per-character timings. Whole run is ~1s for a twenty-character name. */
const STAGGER = 38; // ms between one character starting and the next
const MIN_RESOLVE = 190; // shortest a single character spends unresolved
const JITTER = 170; // randomised extra on top, per character
const SWAP = 45; // ms a single noise glyph is held before it changes
const SETTLE = 0.62; // fraction of a character's run after which noise → letters

/* Once per session. Coming back to Home from Experience should not replay it;
   the same trick the schematics use for their draw-on. */
let played = false;

export default function DecodingName({ start = true }: { start?: boolean }) {
  const nameRef = useRef<HTMLHeadingElement>(null);
  const tagRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const host = nameRef.current;
    const tag = tagRef.current;
    if (!host || !tag || !start) return;

    const text = host.getAttribute("aria-label") ?? "";
    if (!text) return;

    // Build one span per character. The heading is empty until this runs, so
    // there is no flash of the plain name before the effect takes over.
    host.textContent = "";
    // Array.from, not a spread: the tsconfig target predates downlevel
    // iteration, and this still splits on code points rather than UTF-16
    // units, so an accented or non-Latin name stays intact.
    const chars = Array.from(text).map((ch) => {
      const el = document.createElement("span");
      const space = ch === " ";
      el.className = space ? "char space" : "char";
      el.textContent = space ? " " : "";
      host.appendChild(el);
      return { el, ch, space };
    });

    /* Lock every slot to the width of the letter it will become, measured in
       the resolved style. Proportional type means a noise glyph is rarely the
       same width as its target, so without this the name shoves itself
       sideways for the whole run — an `i` turning into a `w` drags everything
       to its right. Measured once, in one layout pass, and released again in
       finish() so the finished name is laid out naturally and a measurement
       taken before the webfont landed can never persist. */
    for (const c of chars) {
      if (c.space) continue;
      c.el.className = "char decoded";
      c.el.textContent = c.ch;
    }
    const widths = chars.map((c) => (c.space ? 0 : c.el.offsetWidth));
    chars.forEach((c, i) => {
      if (c.space) return;
      c.el.style.width = `${widths[i]}px`;
      c.el.className = "char";
      c.el.textContent = "";
    });

    const finish = () => {
      for (const { el, ch, space } of chars) {
        el.textContent = space ? " " : ch;
        el.className = space ? "char space decoded" : "char decoded";
        el.style.width = "";
      }
      tag.classList.add("visible");
      played = true;
    };

    /* Anyone who has asked the OS for stillness gets the name, not the
       decode. Same for a repeat visit within the session. */
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still || played) {
      finish();
      return;
    }

    // Spaces never decode; they are already themselves.
    const plan = chars.map((c, i) => ({
      ...c,
      at: i * STAGGER,
      dur: c.space ? 0 : MIN_RESOLVE + Math.random() * JITTER,
    }));
    const total = Math.max(...plan.map((p) => p.at + p.dur));

    let raf = 0;
    const t0 = performance.now();
    let lastSwap = -Infinity;

    const tick = (now: number) => {
      const elapsed = now - t0;
      // One shared beat, so the glyphs churn together instead of each
      // character flickering on its own clock — much calmer to look at.
      const swap = elapsed - lastSwap >= SWAP;
      if (swap) lastSwap = elapsed;

      for (const p of plan) {
        if (p.space) continue;
        const local = elapsed - p.at;

        if (local < 0) continue; // not its turn yet — stays blank
        if (local >= p.dur) {
          if (p.el.className !== "char decoded") {
            p.el.textContent = p.ch;
            p.el.className = "char decoded";
          }
          continue;
        }
        if (p.el.className === "char") p.el.className = "char decoding";
        if (!swap) continue;

        // Late in a character's run the pool narrows to the target's own
        // alphabet, so it is recognisably the right kind of character — and
        // the right case — before it is the correct one.
        const pool = local / p.dur < SETTLE ? SEED : settlePool(p.ch);
        p.el.textContent = pool[Math.floor(Math.random() * pool.length)];
      }

      if (elapsed < total) raf = requestAnimationFrame(tick);
      else finish();
    };

    raf = requestAnimationFrame(tick);

    /* rAF stops in a background tab, so a visitor who opens the site in a
       new tab and switches away can come back to a half-decoded name that
       never finishes. Wall-clock backstop, generous enough that it never
       fires on a foreground run. */
    const backstop = window.setTimeout(() => {
      cancelAnimationFrame(raf);
      finish();
    }, total + 1200);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(backstop);
    };
  }, [start]);

  return (
    <header className="hero">
      {/* aria-label is the source of truth for both the decode and the
          accessible name; it also stops a screen reader reading the noise. */}
      <h1
        className="name"
        id="animated-name"
        aria-label={persona.owner}
        ref={nameRef}
      />
      <p className="tagline" id="animated-tagline" ref={tagRef}>
        {persona.role}
      </p>
    </header>
  );
}
