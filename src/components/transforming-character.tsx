"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { useTheme } from "next-themes";

// 1. Abstract Neural Blob (Robot)
function AbstractNeuralBlob() {
  const meshRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!meshRef.current) return;
    const { clock, pointer, viewport } = state;
    
    // Rotate slowly
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.2;
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.3) * 0.2;

    // Follow cursor (head tracking equivalent)
    const targetX = (pointer.x * viewport.width) / 10;
    const targetY = (pointer.y * viewport.height) / 10;
    
    meshRef.current.rotation.y += (targetX - meshRef.current.rotation.y) * 0.05;
    meshRef.current.rotation.x += (-targetY - meshRef.current.rotation.x) * 0.05;
  });

  return (
    <group ref={meshRef}>
      <mesh>
        <icosahedronGeometry args={[1.5, 2]} />
        <meshStandardMaterial 
          color="#1a1a2e" 
          wireframe 
          emissive="#f59e0b"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.8, 1]} />
        <meshStandardMaterial 
          color="#f59e0b"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

// 2. Abstract Human Silhouette (Human)
function AbstractHumanSilhouette() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (!groupRef.current) return;
    const { pointer, viewport } = state;
    
    // Follow cursor (head tracking)
    const targetX = (pointer.x * viewport.width) / 8;
    const targetY = (pointer.y * viewport.height) / 8;
    
    groupRef.current.rotation.y += (targetX - groupRef.current.rotation.y) * 0.05;
    groupRef.current.rotation.x += (-targetY - groupRef.current.rotation.x) * 0.05;
  });

  return (
    <group ref={groupRef}>
      {/* Head */}
      <mesh position={[0, 1.2, 0]}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial 
          color="#f5f5f7" 
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      {/* Torso abstract */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.8, 0.5, 2, 16]} />
        <meshStandardMaterial 
          color="#f59e0b" 
          wireframe
        />
      </mesh>
    </group>
  );
}

// 3. Particle Burst
function ParticleBurst({ color }: { color: string }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { positions } = useMemo(() => {
    const count = 500;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Random points on a sphere
      const r = Math.random() * 2;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    return { positions };
  }, []);

  useFrame((state) => {
    if (!pointsRef.current) return;
    const time = state.clock.getElapsedTime();
    // Expand and fade out logic would go here ideally,
    // but for simplicity we just scale it rapidly
    const scale = Math.min(time * 8, 4);
    pointsRef.current.scale.set(scale, scale, scale);
    
    if (pointsRef.current.material instanceof THREE.Material) {
       pointsRef.current.material.opacity = Math.max(0, 1 - time * 2);
    }
  });

  return (
    <Points ref={pointsRef} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color={color}
        size={0.05}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}

export default function TransformingCharacter() {
  const [isHuman, setIsHuman] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const { resolvedTheme } = useTheme();
  
  // Create an audio context reference
  const audioContext = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Generate a simple beep for click if no audio file exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }, []);

  const playClick = () => {
    if (!audioContext.current) return;
    try {
      const osc = audioContext.current.createOscillator();
      const gainNode = audioContext.current.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isHuman ? 440 : 880, audioContext.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(isHuman ? 880 : 440, audioContext.current.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.1, audioContext.current.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.1);
      
      osc.connect(gainNode);
      gainNode.connect(audioContext.current.destination);
      
      osc.start();
      osc.stop(audioContext.current.currentTime + 0.1);
    } catch (e) {
      console.error("Audio playback failed", e);
    }
  };

  const handleClick = () => {
    if (transitioning) return;
    playClick();
    setTransitioning(true);
    
    setTimeout(() => {
      setIsHuman((prev) => !prev);
    }, 200); // Swap model at peak of burst
    
    setTimeout(() => {
      setTransitioning(false);
    }, 600); // Burst complete
  };

  const accentColor = resolvedTheme === "light" ? "#d97706" : "#f59e0b";

  return (
    <div className="w-full h-64 sm:h-80 md:h-96 relative cursor-pointer" onClick={handleClick}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-50">
        <span className="bg-bg-elevated/80 px-3 py-1 rounded-full text-xs font-mono border border-border">
          click to transform
        </span>
      </div>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} color={accentColor} intensity={0.5} />
        
        {transitioning && <ParticleBurst color={accentColor} />}
        {!isHuman ? <AbstractNeuralBlob /> : <AbstractHumanSilhouette />}
      </Canvas>
    </div>
  );
}
