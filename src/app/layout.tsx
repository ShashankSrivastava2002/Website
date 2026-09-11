import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Orbitron } from "next/font/google";
import "./globals.css";

/**
 * Space Grotesk rather than Inter: this is a portfolio for someone who builds
 * robots and agents, and Inter is the default every AI-generated site reaches
 * for. Space Grotesk is a technical grotesque with actual character in its
 * display sizes, and it shares a skeleton with JetBrains Mono, so the sans and
 * the data type read as one family rather than two rented ones.
 *
 * Both are variable, which is what makes the 500/600 weights available for
 * hierarchy instead of jumping straight from 400 to 700.
 *
 * The Home hero runs on its own third face — see `display` below.
 */
const sans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * Display only — the Home hero, and nothing else.
 *
 * Deliberately a third slot rather than a change to `sans`. This is a racing
 * display cut; running the whole site on it would take every heading, card
 * and micro-label with it. Isolated here, the name can be as loud as it likes
 * while Experience, Lab, About and Contact stay on Space Grotesk.
 *
 * To try another, change the import and this one call — nothing else moves.
 * Faces on Google Fonts with the same angular/sporty character:
 *   Orbitron      900         — square and futuristic, upright, caps-forward
 *   Chakra_Petch  700 italic  — angular sheared terminals, closest to Rushblade
 *   Exo_2         800 italic  — wider and rounder, more motorsport
 *   Bai_Jamjuree  700 italic  — same angular family, a little narrower
 *   Saira         800 italic  — techno grotesque, cleaner

 * Orbitron has no italic and no real lowercase character — it is drawn to be
 * set in caps, which is why .name carries text-transform: uppercase.
 */
const display = Orbitron({
  subsets: ["latin"],
  weight: "900",
  variable: "--font-display",
  display: "swap",
});

const description =
  "Shashank Srivastava — AI Developer. Agent frameworks, document intelligence, RAG, and computer vision at production scale.";

export const metadata: Metadata = {
  metadataBase: new URL("https://shash.ai"),
  title: "SHASH·AI — Shashank Srivastava",
  description,
  openGraph: {
    title: "SHASH·AI — Shashank Srivastava",
    description,
    type: "website",
    siteName: "SHASH·AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "SHASH·AI — Shashank Srivastava",
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The font variables go on <html> so that :root can build --sans / --mono
  // from them; defining them on <body> would leave those :root tokens empty.
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body>
        {/* Keyboard users land here first and can jump the nav and the 3D
            layer in one keystroke. Visible only when focused. */}
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
