"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EASE } from "@/lib/motion";

export type MDItem = {
  id: string;
  /** What shows in the rail. */
  rail: ReactNode;
  /** What opens in the detail column. */
  detail: ReactNode;
  /** Announced as the tab's name. */
  label: string;
};

/**
 * The interaction model Work and Lab share.
 *
 * Master-detail rather than an accordion, because the brief is specific: the
 * rail must not move and the page must not grow — only the detail column
 * scrolls. An accordion fails both.
 *
 * The narrow layout *is* an accordion, and gets there without duplicating the
 * detail into the DOM twice: the rail buttons and the single detail node are
 * siblings, so a flex `order` computed from the active index drops the detail
 * directly beneath the open row. Above the breakpoint the container becomes a
 * grid with explicit placement, where order is ignored and the same node lands
 * in column two.
 *
 * The rail is a real tablist: roving tabindex, arrow keys, aria-selected.
 */
export default function MasterDetail({
  items,
  label,
  railHead,
  onChange,
}: {
  items: MDItem[];
  label: string;
  /** Label shown above the rail; the count is added from `items`. */
  railHead?: string;
  onChange?: (id: string) => void;
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  const detailRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  const index = Math.max(0, items.findIndex((i) => i.id === active));

  const select = useCallback(
    (id: string) => {
      setActive(id);
      onChange?.(id);
    },
    [onChange]
  );

  /* Scroll position resets to the top on every switch — otherwise you land
     halfway down the new company because the last one was scrolled. */
  useEffect(() => {
    const el = detailRef.current;
    if (el) el.scrollTop = 0;
  }, [active]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const map: Record<string, number> = {
        ArrowDown: 1,
        ArrowRight: 1,
        ArrowUp: -1,
        ArrowLeft: -1,
      };
      const step = map[e.key];
      if (step) {
        e.preventDefault();
        const next = (index + step + items.length) % items.length;
        select(items[next].id);
        railRef.current
          ?.querySelectorAll<HTMLButtonElement>("[role='tab']")
          [next]?.focus();
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        select(items[0].id);
      }
      if (e.key === "End") {
        e.preventDefault();
        select(items[items.length - 1].id);
      }
    },
    [index, items, select]
  );

  const current = items[index];

  return (
    <div className="md">
      <div className="md-rail" role="tablist" aria-label={label} aria-orientation="vertical" ref={railRef}>
        {/* order:-1 keeps the head above the first tab once the narrow branch
            turns the rail into `display: contents` and order takes over. */}
        {railHead && (
          <div className="md-rail-head" style={{ order: -1 }} aria-hidden>
            <span>{railHead}</span>
            <b>{String(items.length).padStart(2, "0")}</b>
          </div>
        )}
        {items.map((it, i) => (
          <button
            key={it.id}
            role="tab"
            id={`md-tab-${it.id}`}
            aria-selected={it.id === active}
            aria-controls={`md-panel-${it.id}`}
            tabIndex={it.id === active ? 0 : -1}
            className="md-tab"
            data-active={it.id === active}
            style={{ order: i * 2 }}
            onClick={() => select(it.id)}
            onKeyDown={onKeyDown}
          >
            {it.rail}
          </button>
        ))}
      </div>

      <div
        className="md-detail scroll-col"
        ref={detailRef}
        role="tabpanel"
        id={`md-panel-${current?.id}`}
        aria-labelledby={`md-tab-${current?.id}`}
        tabIndex={0}
        style={{ order: index * 2 + 1 }}
      >
        {/* mode="wait" would stall in a hidden tab, as elsewhere on this site */}
        <AnimatePresence>
          <motion.div
            key={current?.id}
            className="md-detail-inner"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.42, ease: EASE }}
          >
            {current?.detail}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Areas arrive in sequence so the eye lands on 01 first. */
export function Staggered({ i, children }: { i: number; children: ReactNode }) {
  return (
    <motion.section
      className="md-block"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay: 0.08 + i * 0.09 }}
    >
      {children}
    </motion.section>
  );
}
