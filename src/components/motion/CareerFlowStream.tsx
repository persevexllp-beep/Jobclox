/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Career Flow Stream — Persevex signature visual
 * Living animated energy paths representing career momentum
 */

import React from 'react';
import { motion } from 'motion/react';
import { tokens } from '../../tokens';

interface CareerFlowStreamProps {
  className?: string;
  intensity?: 'subtle' | 'medium';
}

const STREAM_PATHS = [
  { d: 'M-100,200 C200,100 400,300 700,180 S1100,80 1400,200', color: tokens.colors.careerFlow.indigo[500], delay: 0 },
  { d: 'M-100,350 C250,250 450,450 750,320 S1150,200 1400,380', color: tokens.colors.careerFlow.cyan[400], delay: 0.4 },
  { d: 'M-100,500 C300,400 500,600 800,480 S1200,350 1400,520', color: tokens.colors.careerFlow.violet[500], delay: 0.8 },
];

export default function CareerFlowStream({
  className = '',
  intensity = 'subtle',
}: CareerFlowStreamProps) {
  const opacity = intensity === 'subtle' ? 0.35 : 0.55;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden>
      <svg
        className="absolute w-[200%] h-full -left-1/4"
        viewBox="0 0 1400 700"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="flowStreamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={tokens.colors.careerFlow.indigo[500]} stopOpacity="0" />
            <stop offset="30%" stopColor={tokens.colors.careerFlow.cyan[400]} stopOpacity="1" />
            <stop offset="70%" stopColor={tokens.colors.careerFlow.violet[500]} stopOpacity="1" />
            <stop offset="100%" stopColor={tokens.colors.careerFlow.green} stopOpacity="0" />
          </linearGradient>
          <filter id="flowGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {STREAM_PATHS.map((path, i) => (
          <g key={i}>
            <motion.path
              d={path.d}
              stroke="url(#flowStreamGrad)"
              strokeWidth="1.5"
              strokeLinecap="round"
              opacity={opacity}
              filter="url(#flowGlow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity }}
              transition={{ duration: 2.5, ease: 'easeInOut', delay: path.delay }}
            />
            <motion.path
              d={path.d}
              stroke={path.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="8 24"
              opacity={opacity * 0.8}
              animate={{ strokeDashoffset: [0, -64] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: 'linear', delay: path.delay }}
            />
          </g>
        ))}

        {/* Flowing opportunity nodes */}
        {[0, 1, 2, 3, 4].map((node) => (
          <motion.circle
            key={node}
            r="4"
            fill={tokens.colors.careerFlow.cyan[400]}
            filter="url(#flowGlow)"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              offsetDistance: ['0%', '100%'],
            }}
            transition={{
              duration: 8 + node * 2,
              repeat: Infinity,
              ease: 'linear',
              delay: node * 1.5,
            }}
            style={{
              offsetPath: `path('${STREAM_PATHS[node % STREAM_PATHS.length].d}')`,
            }}
          />
        ))}
      </svg>
    </div>
  );
}
