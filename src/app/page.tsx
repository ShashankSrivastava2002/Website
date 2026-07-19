"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Preloader from "@/components/preloader";
import CipherText from "@/components/cipher-text";
import { useTheme } from "next-themes";
import { Mail, FileText, Sun, Moon } from "lucide-react";
import dynamic from "next/dynamic";

const TransformingCharacter = dynamic(() => import("@/components/transforming-character"), { ssr: false });

export default function Home() {
  const [showPreloader, setShowPreloader] = useState(true);
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showResumeEmoji, setShowResumeEmoji] = useState(false);
  const [emojiPos, setEmojiPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
    const hasVisited = sessionStorage.getItem("visited");
    if (hasVisited) {
      setShowPreloader(false);
    }
  }, []);

  const handlePreloaderDone = () => {
    sessionStorage.setItem("visited", "true");
    setShowPreloader(false);
  };

  const handleResumeClick = (e: React.MouseEvent) => {
    setEmojiPos({ x: e.clientX, y: e.clientY });
    setShowResumeEmoji(true);
    setTimeout(() => setShowResumeEmoji(false), 2000);
  };

  if (!mounted) return null;

  return (
    <>
      <AnimatePresence>
        {showPreloader && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100]"
          >
            <Preloader onDone={handlePreloaderDone} />
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-3xl mx-auto px-6 py-24 min-h-screen space-y-32">
        {/* Header / Hero */}
        <motion.header
          initial={{ opacity: 0, y: 24 }}
          animate={!showPreloader ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="space-y-12"
        >
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-text-primary">
                {!showPreloader && <CipherText text="Shashank Srivastava" />}
              </h1>
              <p className="font-serif italic text-xl sm:text-2xl text-text-secondary">
                Engineer. Builder. <span className="text-accent">Shipper.</span>
              </p>
            </div>
            
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="p-2 rounded-full hover:bg-bg-elevated transition-colors border border-transparent hover:border-border text-text-primary"
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>

          <nav className="flex gap-6 text-sm font-medium">
            <a href="#experience" className="text-text-primary hover:text-accent transition-colors">Experience</a>
            <a href="#projects" className="text-text-primary hover:text-accent transition-colors">Projects</a>
            <a href="#contact" className="text-text-primary hover:text-accent transition-colors">Contact</a>
          </nav>

          <TransformingCharacter />

          <div className="space-y-6 text-text-secondary leading-relaxed">
            <p>
              AI Developer building scalable, production-grade systems — currently at{" "}
              <a href="https://www.delhivery.com/" target="_blank" className="text-text-primary hover:text-accent transition-colors font-medium border-b border-border border-dashed pb-0.5">Delhivery</a>.
              Previously at <a href="https://inteligenai.com/" target="_blank" className="text-text-primary hover:text-accent transition-colors font-medium border-b border-border border-dashed pb-0.5">InteligenAI</a>,
              including <a href="https://spector.ai/" target="_blank" className="text-text-primary hover:text-accent transition-colors font-medium border-b border-border border-dashed pb-0.5">Spector.AI</a>,
              where I built MCP-orchestrated agent frameworks, document intelligence pipelines, and vision systems
              across AWS, Azure, and GCP.
            </p>
            <p>
              I work across NLP, computer vision, and ML — multi-agent reasoning with LangGraph, RAG with hybrid
              retrieval, document classification over 500K+ records at 99% accuracy, and vision models with YOLO,
              SAM, and Gemini. B.Tech ECE&apos;24, <span className="font-medium text-text-primary">HBTU Kanpur</span>.
            </p>
          </div>

          <div className="flex gap-4">
            <a href="mailto:srivastavashashank46@gmail.com" className="text-text-primary p-2.5 rounded-full bg-bg-elevated hover:text-accent transition-all hover:scale-110 shadow-sm border border-border">
              <Mail size={18} />
            </a>
            <a href="https://github.com/ShashankSrivastava2002" target="_blank" className="text-text-primary p-2.5 rounded-full bg-bg-elevated hover:text-accent transition-all hover:scale-110 shadow-sm border border-border">
              <span className="font-bold">GH</span>
            </a>
            <a href="https://linkedin.com/in/shashank-srivastava-70b62a255" target="_blank" className="text-text-primary p-2.5 rounded-full bg-bg-elevated hover:text-accent transition-all hover:scale-110 shadow-sm border border-border">
              <span className="font-bold">IN</span>
            </a>
            <a href="/shashank-resume.pdf" target="_blank" onClick={handleResumeClick} className="text-text-primary p-2.5 rounded-full bg-bg-elevated hover:text-accent transition-all hover:scale-110 shadow-sm border border-border">
              <FileText size={18} />
            </a>
          </div>
        </motion.header>

        {/* Experience Section */}
        <section id="experience" className="space-y-12">
          <motion.h2 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-2xl font-bold flex items-center gap-4 text-text-primary"
          >
            Experience
            <div className="h-px bg-border flex-grow"></div>
          </motion.h2>

          <div className="space-y-12 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-border">
            
            <motion.div 
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-bg bg-accent absolute left-0 md:left-1/2 -translate-x-1/2 shadow"></div>
              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-xl border border-border bg-bg-elevated/50 backdrop-blur-sm group-hover:border-accent/50 transition-colors text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-text-primary">Software Engineer</h3>
                  <span className="text-xs font-mono text-accent">Jan 2026 – Present</span>
                </div>
                <div className="text-sm font-medium mb-3 text-text-primary">Delhivery</div>
                <p className="text-sm text-text-secondary">Building and shipping software at scale for India&apos;s largest integrated logistics platform.</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full border-4 border-bg bg-text-secondary absolute left-0 md:left-1/2 -translate-x-1/2 shadow group-hover:bg-accent transition-colors"></div>
              <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-xl border border-border bg-bg-elevated/50 backdrop-blur-sm group-hover:border-accent/50 transition-colors text-left md:text-right">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2">
                  <h3 className="font-bold text-lg text-text-primary">AI Developer</h3>
                  <span className="text-xs font-mono text-text-secondary">Jan 2024 – Jan 2026</span>
                </div>
                <div className="text-sm font-medium mb-3 text-text-primary">InteligenAI · Spector.AI</div>
                <p className="text-sm text-text-secondary">Built MCP-orchestrated AI agent frameworks with LangGraph for multi-step reasoning. Delivered document intelligence (99% classification, 90% extraction on 500K+ docs), RAG chatbots with hybrid search, and vision systems deployed on AWS, Azure, and GCP.</p>
              </div>
            </motion.div>
            
          </div>
        </section>

        {/* Projects Section */}
        <section id="projects" className="space-y-12">
          <motion.h2 
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-2xl font-bold flex items-center gap-4 text-text-primary"
          >
            Projects
            <div className="h-px bg-border flex-grow"></div>
          </motion.h2>

          <div className="grid gap-6">
            {[
              {
                id: "01",
                date: "APR 2024",
                title: "Source Code Converter",
                desc: "Built a source code converter utilizing LLM and prompt engineering for accurate conversion to target programming languages with accuracy scores. Streamlit UI for file uploads and specifications.",
                tech: ["Generative AI", "LLM", "Python", "Streamlit"]
              },
              {
                id: "02",
                date: "MAR 2024",
                title: "Custom Segmentation Model",
                desc: "Implemented YOLOv8 (SOTA) for object detection and boundary delineation. Leveraged the SAM model for precise semantic segmentation from images, achieving 95% accuracy.",
                tech: ["SAM", "YOLOv8", "Deep Learning", "Python"]
              },
              {
                id: "03",
                date: "OCT 2023",
                title: "Image Caption Generator",
                desc: "Preprocessed Flickr8K with data cleaning and VGG-16 image feature extraction. Integrated captions and features with LSTM models. Evaluated with BLEU scores against human references.",
                tech: ["NLP", "Computer Vision", "LSTM", "VGG-16"]
              }
            ].map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>

        {/* Footer */}
        <motion.footer 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="pt-12 pb-6 border-t border-border text-center text-sm text-text-secondary"
        >
          <p>Designed & built by Shashank Srivastava. © {new Date().getFullYear()}</p>
        </motion.footer>
      </main>

      <AnimatePresence>
        {showResumeEmoji && (
          <motion.div
            initial={{ opacity: 1, y: 0, scale: 0.5 }}
            animate={{ opacity: 0, y: -100, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="fixed pointer-events-none z-[1000] text-4xl"
            style={{ left: emojiPos.x - 20, top: emojiPos.y - 20 }}
          >
            😂
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

interface ProjectType {
  id: string;
  date: string;
  title: string;
  desc: string;
  tech: string[];
}

function ProjectCard({ project }: { project: ProjectType }) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    cardRef.current.style.setProperty('--x', `${e.clientX - rect.left}px`);
    cardRef.current.style.setProperty('--y', `${e.clientY - rect.top}px`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="group relative p-6 rounded-2xl border border-border bg-bg-elevated/30 overflow-hidden"
    >
      {/* Hover glow effect */}
      <div 
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: 'radial-gradient(300px circle at var(--x, 0px) var(--y, 0px), rgba(245,158,11,0.1), transparent 70%)'
        }}
      />
      
      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-4 text-xs font-mono">
          <span className="text-accent">{project.id}</span>
          <span className="text-text-secondary">{project.date}</span>
        </div>
        <h3 className="text-xl font-bold mb-3 text-text-primary group-hover:text-accent transition-colors">{project.title}</h3>
        <p className="text-text-secondary text-sm leading-relaxed mb-6">
          {project.desc}
        </p>
        <div className="flex flex-wrap gap-2">
          {project.tech.map((t: string) => (
            <span key={t} className="px-3 py-1 rounded-full bg-bg border border-border text-xs font-medium text-text-secondary">
              {t}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
