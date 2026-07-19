"use client";

import { useState, useEffect } from "react";

const chars = "!<>-_\\/[]{}—=+*^?#________";

export default function CipherText({ text, className }: { text: string; className?: string }) {
  const [display, setDisplay] = useState(() => text.replace(/[a-zA-Z]/g, "#"));

  useEffect(() => {
    let iteration = 0;
    const maxIterations = text.length;
    
    const interval = setInterval(() => {
      setDisplay(
        text.split("").map((char, i) => {
          if (i < iteration) return char;
          return chars[Math.floor(Math.random() * chars.length)];
        }).join("")
      );
      
      iteration += 1 / 3;
      
      if (iteration >= maxIterations) {
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [text]);

  return <span className={className}>{display}</span>;
}
