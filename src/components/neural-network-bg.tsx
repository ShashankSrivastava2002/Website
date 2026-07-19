"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

export default function NeuralNetworkBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || window.matchMedia("(pointer: coarse)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    
    // Set proper resolution
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      phase: number;
    }

    const particles: Particle[] = [];
    const count = Math.min(60, Math.floor((width * height) / 18000));
    
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        r: Math.random() * 2 + 1,
        phase: Math.random() * Math.PI * 2,
      });
    }

    let mouseX: number | null = null;
    let mouseY: number | null = null;
    let pulses: { from: number; to: number; t: number }[] = [];
    let lastPulseTime = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const handleMouseLeave = () => {
      mouseX = null;
      mouseY = null;
    };

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", handleResize);

    const isLight = resolvedTheme === "light";
    const baseColor = isLight ? "217, 119, 6" : "245, 158, 11";
    const bgFill = isLight ? "#fafafa" : "#1a1a2e";

    const draw = (time: number) => {
      ctx.fillStyle = bgFill;
      ctx.fillRect(0, 0, width, height);

      // Move particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        if (mouseX !== null && mouseY !== null) {
          const dx = mouseX - p.x;
          const dy = mouseY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150 && dist > 0) {
            p.x += dx * 0.002;
            p.y += dy * 0.002;
          }
        }
      });

      // Connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${baseColor}, ${(1 - dist / 120) * (isLight ? 0.3 : 0.4)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }

        // Mouse connection
        if (mouseX !== null && mouseY !== null) {
          const dx = particles[i].x - mouseX;
          const dy = particles[i].y - mouseY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(mouseX, mouseY);
            ctx.strokeStyle = `rgba(${baseColor}, ${(1 - dist / 150) * (isLight ? 0.5 : 0.6)})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      particles.forEach((p) => {
        ctx.beginPath();
        const cr = p.r + Math.sin(time * 0.002 + p.phase) * 0.5;
        ctx.arc(p.x, p.y, cr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, ${isLight ? 0.6 : 0.8})`;
        ctx.fill();
      });

      // Data pulses
      if (time - lastPulseTime > 3000 && particles.length > 1) {
        const i = Math.floor(Math.random() * particles.length);
        let j = Math.floor(Math.random() * particles.length);
        if (i === j) j = (j + 1) % particles.length;
        
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        
        if (Math.sqrt(dx * dx + dy * dy) < 150) {
          pulses.push({ from: i, to: j, t: 0 });
          lastPulseTime = time;
        }
      }

      pulses = pulses.filter((p) => p.t <= 1);
      pulses.forEach((p) => {
        p.t += 0.015;
        const from = particles[p.from];
        const to = particles[p.to];
        const px = from.x + (to.x - from.x) * p.t;
        const py = from.y + (to.y - from.y) * p.t;
        const fade = 1 - p.t;
        
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, ${0.9 * fade})`;
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${baseColor}, ${0.2 * fade})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-10 pointer-events-none opacity-40 transition-opacity duration-1000"
      aria-hidden="true"
    />
  );
}
