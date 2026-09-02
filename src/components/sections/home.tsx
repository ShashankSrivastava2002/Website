"use client";

import { Chat } from "@/components/ui/chat";
import { persona, suggestions, type Mood } from "@/content/site";

/**
 * The wordmark sits behind the figure, not beside it — the robot walks in over
 * its own name, which is the whole first impression.
 */
export function Home({ on, onMood }: { on: boolean; onMood: (m: Mood) => void }) {
  return (
    <section className="section" data-on={on} aria-hidden={!on}>
      <h1 className="wordmark">{persona.wordmark}</h1>
      <div style={{ marginTop: "auto", paddingBottom: 28 }}>
        <Chat greeting={persona.greetingReturning} suggestions={suggestions.returning} onMood={onMood} />
      </div>
    </section>
  );
}
