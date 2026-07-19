"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const terms = [
  "σ(zᵢ) = eᶻⁱ / Σ eᶻʲ",
  "LangGraph",
  "YOLOv8",
  "PySpark",
  "RAG",
  "MCP",
  "Attention",
  "Transformer"
];

export default function Preloader({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loss, setLoss] = useState(4.2371);
  const [activeTerms, setActiveTerms] = useState<{ id: number; text: string; top: number; left: number }[]>([]);
  const termId = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let currentLoss = 4.2371;
    let step = 0;
    const maxSteps = 180;
    const points: number[] = [];
    
    // Scale for HDPI
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      
      // Draw grid/axes
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(30, 20);
      ctx.lineTo(30, h - 30);
      ctx.lineTo(w - 20, h - 30);
      ctx.stroke();

      if (points.length < 2) return;

      // Draw gradient under curve
      const gradient = ctx.createLinearGradient(0, 0, 0, h - 30);
      gradient.addColorStop(0, "rgba(245, 158, 11, 0.2)");
      gradient.addColorStop(1, "rgba(245, 158, 11, 0)");

      ctx.beginPath();
      ctx.moveTo(30, h - 30);
      points.forEach((p, i) => {
        const x = 30 + (i / maxSteps) * (w - 50);
        const y = 20 + ((4.2371 - p) / 4.2371) * (h - 50);
        ctx.lineTo(x, y);
      });
      const lastX = 30 + ((points.length - 1) / maxSteps) * (w - 50);
      ctx.lineTo(lastX, h - 30);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw line
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = 30 + (i / maxSteps) * (w - 50);
        const y = 20 + ((4.2371 - p) / 4.2371) * (h - 50);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.stroke();
    };

    let rafId: number;
    const raf = () => {
      // Eased random walk
      currentLoss = Math.max(0.0001, currentLoss * 0.94 - Math.random() * 0.02);
      points.push(currentLoss);
      setLoss(currentLoss);
      
      draw();
      step++;

      if (currentLoss > 0.001 && step < maxSteps) {
        rafId = requestAnimationFrame(raf);
      } else {
        setLoss(0.0001);
        setTimeout(onDone, 800);
      }
    };

    rafId = requestAnimationFrame(raf);

    // Terms appearing
    const termInterval = setInterval(() => {
      if (step < maxSteps - 20) {
        setActiveTerms((prev) => [
          ...prev.slice(-3),
          {
            id: termId.current++,
            text: terms[Math.floor(Math.random() * terms.length)],
            top: 20 + Math.random() * 60,
            left: 20 + Math.random() * 60,
          }
        ]);
      }
    }, 400);

    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(termInterval);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a0a0a]">
      <div className="relative w-full max-w-md h-64 mb-8">
        <canvas ref={canvasRef} className="w-full h-full" style={{ width: '100%', height: '100%' }} />
        
        <AnimatePresence>
          {activeTerms.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.3, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 1.2 }}
              className="absolute font-mono text-xs text-white pointer-events-none"
              style={{ top: `${t.top}%`, left: `${t.left}%` }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="font-mono text-sm text-text-primary tracking-wider">
          loss: {loss <= 0.0001 ? "0.0001 ✓" : loss.toFixed(4)}
        </div>
        
        <div className="w-48 h-0.5 bg-white/10 rounded overflow-hidden">
          <motion.div 
            className="h-full bg-accent"
            initial={{ width: "0%" }}
            animate={{ width: loss <= 0.0001 ? "100%" : `${Math.min(100, 100 - (loss / 4.2) * 100)}%` }}
            transition={{ ease: "linear", duration: 0.1 }}
          />
        </div>
      </div>
    </div>
  );
}
