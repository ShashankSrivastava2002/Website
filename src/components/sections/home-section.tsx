"use client";

import { motion } from "framer-motion";
import ChatWidget from "@/components/chat-widget";
import { persona, type Mood } from "@/lib/content";

export default function HomeSection({
  onMood,
  returning,
}: {
  onMood: (m: Mood) => void;
  returning: boolean;
}) {
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

      <motion.div
        className="home-chat"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
      >
        <ChatWidget onMood={onMood} returning={returning} />
      </motion.div>
    </div>
  );
}
