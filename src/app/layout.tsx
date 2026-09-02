import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "shash.ai — Shashank Srivastava",
  description:
    "Shashank Srivastava — AI developer at Delhivery. Agent frameworks, document intelligence at 500K+ documents, and vision systems running in production across three clouds. Narrated by shash, the AI he built to keep the archive.",
  authors: [{ name: "Shashank Srivastava" }],
  keywords: [
    "Shashank Srivastava", "AI developer", "LangGraph", "MCP",
    "document intelligence", "RAG", "computer vision", "Delhivery",
  ],
  openGraph: {
    title: "shash.ai — Shashank Srivastava",
    description: "A portfolio you talk to, narrated by the AI he built.",
    type: "website",
  },
};

/* Light-only, so a dark-mode browser doesn't auto-darken the UA chrome and
   fight the page's own ground colour at the status bar. */
export const viewport: Viewport = {
  themeColor: "#e9edf4",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
