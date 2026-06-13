/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'motion/react';

interface CareerFlowBackgroundProps {
  className?: string;
  particleCount?: number;
}

export default function CareerFlowBackground({
  className = '',
  particleCount = 34,
}: CareerFlowBackgroundProps) {
  const cursorX = useMotionValue(50);
  const cursorY = useMotionValue(35);
  const springX = useSpring(cursorX, { stiffness: 35, damping: 28, mass: 1.4 });
  const springY = useSpring(cursorY, { stiffness: 35, damping: 28, mass: 1.4 });
  const cursorGlow = useMotionTemplate`radial-gradient(circle at ${springX}% ${springY}%, rgba(34, 211, 238, 0.22), transparent 34%)`;

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      cursorX.set((event.clientX / window.innerWidth) * 100);
      cursorY.set((event.clientY / window.innerHeight) * 100);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [cursorX, cursorY]);

  return (
    <div className={`persevex-aurora fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-[-16%]"
        style={{ background: cursorGlow }}
      />

      <motion.div
        className="aurora-field aurora-field-one"
        animate={{
          backgroundPosition: ['0% 40%', '80% 20%', '20% 90%', '0% 40%'],
          filter: ['hue-rotate(0deg)', 'hue-rotate(18deg)', 'hue-rotate(-8deg)', 'hue-rotate(0deg)'],
        }}
        transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="aurora-field aurora-field-two"
        animate={{
          backgroundPosition: ['100% 0%', '30% 70%', '90% 100%', '100% 0%'],
          opacity: [0.52, 0.72, 0.58, 0.52],
        }}
        transition={{ duration: 34, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="aurora-grid"
        animate={{
          x: [0, -24, 0],
          y: [0, 18, 0],
          opacity: [0.34, 0.48, 0.34],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="absolute inset-0 opacity-70">
        {Array.from({ length: particleCount }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px w-16"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(125, 249, 255, 0.5), transparent)',
              left: `${(i * 37) % 100}%`,
              top: `${(i * 19) % 100}%`,
              rotate: `${-18 + (i % 9) * 5}deg`,
            }}
            animate={{
              opacity: [0, 0.78, 0],
              x: ['-16vw', '18vw'],
              y: ['8vh', '-10vh'],
            }}
            transition={{
              duration: 9 + (i % 7),
              repeat: Infinity,
              ease: 'linear',
              delay: (i % 11) * 0.8,
            }}
          />
        ))}
      </div>

      <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="persevexBackgroundFlow" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0" />
            <stop offset="35%" stopColor="#8b5cf6" stopOpacity="0.48" />
            <stop offset="68%" stopColor="#22d3ee" stopOpacity="0.56" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          d="M-80 590 C 220 360, 460 760, 760 470 S 1160 300, 1520 520"
          stroke="url(#persevexBackgroundFlow)"
          strokeWidth="1.2"
          fill="none"
          strokeDasharray="10 22"
          animate={{ strokeDashoffset: [0, -128], opacity: [0.28, 0.72, 0.28] }}
          transition={{ duration: 16, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M-120 710 C 240 500, 530 780, 850 610 S 1130 420, 1540 660"
          stroke="url(#persevexBackgroundFlow)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 18"
          animate={{ strokeDashoffset: [0, -96], opacity: [0.18, 0.52, 0.18] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
      </svg>
    </div>
  );
}
