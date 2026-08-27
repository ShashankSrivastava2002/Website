import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "SHASH·AI — Shashank Srivastava",
  description:
    "Shashank Srivastava — AI Developer. Agent frameworks, document intelligence, RAG, and computer vision at production scale.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The font variables go on <html> so that :root can build --sans / --mono
  // from them; defining them on <body> would leave those :root tokens empty.
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
