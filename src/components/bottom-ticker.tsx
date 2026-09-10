"use client";

import { work } from "@/lib/content";

/** Every technology named across the companies, in order, once each. */
const TICKER_STACK = Array.from(
  new Set(work.companies.flatMap((c) => c.stack))
);

/**
 * The strip pinned along the bottom of every screen.
 *
 * The reference runs one of these continuously under the whole site. Ours
 * carries the stack rather than client logos — those would have to be invented,
 * and a portfolio that lists brands it hasn't worked with is worse than one
 * that lists none.
 *
 * Duplicated once and translated by exactly -50% so the loop is seamless; the
 * copy is aria-hidden so a screen reader reads the list a single time.
 */
export default function BottomTicker() {
  return (
    <div className="ticker" aria-label="Stack">
      <div className="ticker-track">
        {[0, 1].map((dup) => (
          <div className="ticker-row" key={dup} aria-hidden={dup === 1}>
            {/* The stack lives per company now; the ticker wants one flat,
                de-duplicated run across both. */}
            {TICKER_STACK.map((s) => (
              <span key={s + dup}>
                {s}
                <i aria-hidden>•</i>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
