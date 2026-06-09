/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'motion/react';
import { tokens } from '../../tokens';

interface CareerFlowBackgroundProps {
  className?: string;
  particleCount?: number;
}

export default function CareerFlowBackground({
  className = '',
  particleCount = 50,
}: CareerFlowBackgroundProps) {
  const controls = useAnimation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    controls.start('animate');
  }, [controls]);

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      {/* Ambient gradient background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            ${tokens.colors.gradients.ambient1},
            ${tokens.colors.gradients.ambient2},
            ${tokens.colors.gradients.ambient3}
          `,
          backgroundAttachment: 'fixed',
        }}
      />

      {/* Morphing gradient orbs */}
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ background: tokens.colors.gradients.orb1 }}
        animate={{
          scale: [1, 1.2, 1],
          x: [0, 50, -50, 0],
          y: [0, -30, 30, 0],
        }}
        transition={{
          duration: 8000,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      <motion.div
        className="absolute top-3/4 right-1/4 w-80 h-80 rounded-full blur-3xl opacity-25"
        style={{ background: tokens.colors.gradients.orb2 }}
        animate={{
          scale: [1, 1.3, 1],
          x: [0, -40, 40, 0],
          y: [0, 40, -40, 0],
        }}
        transition={{
          duration: 10000,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 1,
        }}
      />

      <motion.div
        className="absolute bottom-1/4 left-1/2 w-72 h-72 rounded-full blur-3xl opacity-20"
        style={{ background: tokens.colors.gradients.orb3 }}
        animate={{
          scale: [1, 1.25, 1],
          x: [0, 30, -30, 0],
          y: [0, -50, 50, 0],
        }}
        transition={{
          duration: 9000,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 2,
        }}
      />

      {/* Particle system */}
      <div className="absolute inset-0">
        {Array.from({ length: particleCount }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 4 + 2,
              height: Math.random() * 4 + 2,
              background: i % 3 === 0 
                ? tokens.colors.primary.emerald[500]
                : i % 3 === 1
                ? tokens.colors.primary.blue[500]
                : tokens.colors.primary.violet[500],
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.3, 0.7, 0.3],
              scale: [1, 1.2, 1],
              y: [0, -100, -200],
              x: [0, Math.random() * 50 - 25, Math.random() * 100 - 50],
            }}
            transition={{
              duration: Math.random() * 5000 + 5000,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: Math.random() * 2000,
            }}
          />
        ))}
      </div>

      {/* SVG Career Flow Paths */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <motion.path
          d="M0,500 Q400,300 800,500 T1600,500"
          stroke={tokens.colors.primary.emerald[500]}
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2000, ease: 'easeInOut' }}
        />
        <motion.path
          d="M0,600 Q400,400 800,600 T1600,600"
          stroke={tokens.colors.primary.blue[500]}
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2000, ease: 'easeInOut', delay: 0.5 }}
        />
        <motion.path
          d="M0,700 Q400,500 800,700 T1600,700"
          stroke={tokens.colors.primary.violet[500]}
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 2000, ease: 'easeInOut', delay: 1 }}
        />
      </svg>
    </div>
  );
}
