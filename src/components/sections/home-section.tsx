"use client";

import { motion } from "framer-motion";
import { persona } from "@/lib/content";

export default function HomeSection() {
  return (
    <div className="home">
      <motion.h1
        className="wordmark"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      >
        {persona.wordmark}
      </motion.h1>

    </div>
  );
}
