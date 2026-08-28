import Link from "next/link";

export const metadata = {
  title: "Colophon — SHASH·AI",
  description: "How this site is built, and what it owes to.",
};

export default function Colophon() {
  return (
    <main className="doc">
      <div className="doc-inner">
        <Link className="doc-back" href="/">
          ← Back
        </Link>

        <p className="doc-eyebrow">COLOPHON</p>
        <h1>How this was built</h1>
        <p className="doc-lede">
          A short account of the parts, and of the work this design learned
          from.
        </p>

        <h2>Credit</h2>
        <p>
          The interface is a rebuild, made as a study of{" "}
          <a href="https://www.fuch.ai/" target="_blank" rel="noreferrer">
            fuch.ai
          </a>{" "}
          by Sayandeep Bose — an Awwwards Honorable Mention site whose layout,
          motion and character-led structure I set out to understand by
          reconstructing them from scratch. The engineering here is my own and
          so is every word, project and figure on it. The persona, the robot and
          the identity are mine; none of the original&apos;s content, copy or
          likeness has been carried over.
        </p>

        <h2>Type</h2>
        <ul className="doc-list">
          <li>
            <b>Space Grotesk</b> — interface and display
          </li>
          <li>
            <b>JetBrains Mono</b> — labels, data and anything numeric
          </li>
        </ul>

        <h2>Build</h2>
        <ul className="doc-list">
          <li>Next.js and React, in TypeScript</li>
          <li>Hand-written CSS. No component library, no UI kit</li>
          <li>Framer Motion for section transitions</li>
        </ul>

        <h2>The robot</h2>
        <p>
          Procedural, not a downloaded asset. It is assembled in code out of
          roughly forty primitives — a lathed head profile, blade forearms,
          chrome ball joints — and posed by a spring rig rather than baked
          animation clips, which is what lets it track the cursor and change
          posture at the same time.
        </p>
        <ul className="doc-list">
          <li>three.js, via React Three Fiber and drei</li>
          <li>A custom GLSL shader for the identity dissolve</li>
          <li>Selective bloom, held back hard for a light background</li>
        </ul>

        <p className="doc-foot">
          <Link href="/privacy">Privacy</Link> ·{" "}
          <a href="mailto:srivastavashashank46@gmail.com">Email</a>
        </p>
      </div>
    </main>
  );
}
