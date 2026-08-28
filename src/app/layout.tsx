import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
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
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
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
