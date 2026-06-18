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
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const cursorX = useMotionValue(50);
  const cursorY = useMotionValue(35);
  const springX = useSpring(cursorX, { stiffness: 35, damping: 28, mass: 1.4 });
  const springY = useSpring(cursorY, { stiffness: 35, damping: 28, mass: 1.4 });
  const cursorGlow = useMotionTemplate`radial-gradient(circle at ${springX}% ${springY}%, rgba(34, 211, 238, ${reduceMotion ? 0.14 : 0.22}), transparent 34%)`;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncReducedMotion = () => {
      setReduceMotion(media.matches || window.innerWidth < 768);
    };

    syncReducedMotion();
    media.addEventListener('change', syncReducedMotion);
    window.addEventListener('resize', syncReducedMotion, { passive: true });

    if (media.matches || window.innerWidth < 768) {
      return () => {
        media.removeEventListener('change', syncReducedMotion);
        window.removeEventListener('resize', syncReducedMotion);
      };
    }

    let frame = 0;
    let nextX = 50;
    let nextY = 35;

    const flushPointerPosition = () => {
      frame = 0;
      cursorX.set(nextX);
      cursorY.set(nextY);
    };

    const handlePointerMove = (event: PointerEvent) => {
      nextX = (event.clientX / window.innerWidth) * 100;
      nextY = (event.clientY / window.innerHeight) * 100;
      if (frame === 0) {
        frame = window.requestAnimationFrame(flushPointerPosition);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      media.removeEventListener('change', syncReducedMotion);
      window.removeEventListener('resize', syncReducedMotion);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [cursorX, cursorY]);

  const effectiveParticleCount = reduceMotion ? Math.min(8, particleCount) : particleCount;
  const loopingTransition = reduceMotion ? undefined : { duration: 28, repeat: Infinity, ease: 'linear' as const };
  const loopingTransitionTwo = reduceMotion ? undefined : { duration: 34, repeat: Infinity, ease: 'linear' as const };
  const gridTransition = reduceMotion ? undefined : { duration: 18, repeat: Infinity, ease: 'easeInOut' as const };

  return (
    <div className={`persevex-aurora fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-[-16%]"
        style={{ background: cursorGlow }}
      />

      <motion.div
        className="aurora-field aurora-field-one"
        animate={reduceMotion ? { opacity: 0.68 } : {
          backgroundPosition: ['0% 40%', '80% 20%', '20% 90%', '0% 40%'],
          filter: ['hue-rotate(0deg)', 'hue-rotate(18deg)', 'hue-rotate(-8deg)', 'hue-rotate(0deg)'],
        }}
        transition={loopingTransition}
      />
      <motion.div
        className="aurora-field aurora-field-two"
        animate={reduceMotion ? { opacity: 0.5 } : {
          backgroundPosition: ['100% 0%', '30% 70%', '90% 100%', '100% 0%'],
          opacity: [0.52, 0.72, 0.58, 0.52],
        }}
        transition={loopingTransitionTwo}
      />
      <motion.div
        className="aurora-grid"
        animate={reduceMotion ? { opacity: 0.22 } : {
          x: [0, -24, 0],
          y: [0, 18, 0],
          opacity: [0.34, 0.48, 0.34],
        }}
        transition={gridTransition}
      />

      <div className="absolute inset-0 opacity-70">
        {Array.from({ length: effectiveParticleCount }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px w-16"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(125, 249, 255, 0.5), transparent)',
              left: `${(i * 37) % 100}%`,
              top: `${(i * 19) % 100}%`,
              rotate: `${-18 + (i % 9) * 5}deg`,
            }}
            animate={reduceMotion ? { opacity: 0.22 } : {
              opacity: [0, 0.78, 0],
              x: ['-16vw', '18vw'],
              y: ['8vh', '-10vh'],
            }}
            transition={reduceMotion ? undefined : {
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
          animate={reduceMotion ? { opacity: 0.28 } : { strokeDashoffset: [0, -128], opacity: [0.28, 0.72, 0.28] }}
          transition={reduceMotion ? undefined : { duration: 16, repeat: Infinity, ease: 'linear' }}
        />
        <motion.path
          d="M-120 710 C 240 500, 530 780, 850 610 S 1130 420, 1540 660"
          stroke="url(#persevexBackgroundFlow)"
          strokeWidth="1"
          fill="none"
          strokeDasharray="4 18"
          animate={reduceMotion ? { opacity: 0.18 } : { strokeDashoffset: [0, -96], opacity: [0.18, 0.52, 0.18] }}
          transition={reduceMotion ? undefined : { duration: 20, repeat: Infinity, ease: 'linear' }}
        />
      </svg>
    </div>
  );
}
