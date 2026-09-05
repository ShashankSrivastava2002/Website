"use client";

import { motion } from "framer-motion";
import { persona } from "@/lib/content";
import { EASE, STAGE } from "@/lib/motion";

export default function HomeSection() {
  return (
    <div className="home">
      <motion.h1
        className="wordmark"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: EASE, delay: STAGE.intro }}
      >
        {persona.wordmark}
      </motion.h1>

    </div>
  );
}
