"use client";

import { motion } from "framer-motion";
import { home } from "@/lib/content";
import { EASE, STAGE, bodyDelay } from "@/lib/motion";

/**
 * What replaced the wordmark.
 *
 * A 250px "shash.ai" told a visitor the domain they had already typed. The
 * ten seconds it occupied are the only ten seconds most visitors give, so
 * they now carry the two things a technical hire is actually scanning for:
 * what he builds, and a number attached to it. The figure behind is the
 * hero; this is the caption.
 */
export default function HomeSection() {
  return (
    <div className="home">
      <div className="home-hero">
        <motion.p
          className="home-positioning"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: STAGE.intro }}
        >
          {home.positioning}
        </motion.p>

        <div className="home-proof">
          {home.proof.map((p, i) => (
            <motion.div
              className="home-proof-item"
              key={p.label}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: STAGE.duration, ease: EASE, delay: bodyDelay(i) }}
            >
              <span className="home-proof-value">{p.value}</span>
              <span className="home-proof-label">{p.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
