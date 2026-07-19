import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import CustomCursor from "@/components/custom-cursor";
import NeuralNetworkBg from "@/components/neural-network-bg";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const newsreader = Newsreader({ 
  subsets: ["latin"], 
  style: ["italic"],
  variable: "--font-newsreader" 
});

export const metadata: Metadata = {
  title: "Shashank Srivastava | AI Developer",
  description: "AI Developer building MCP agent frameworks, RAG systems, and computer vision at scale.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${newsreader.variable} font-sans antialiased bg-bg text-text-primary selection:bg-accent/20`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <NeuralNetworkBg />
          <CustomCursor />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
