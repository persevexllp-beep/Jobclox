/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { animationPresets } from '../../animations/presets';

interface MotionWrapperProps {
  children: React.ReactNode;
  variant?: 'fadeIn' | 'slideUp' | 'scaleIn' | 'stagger';
  delay?: number;
  duration?: number;
  className?: string;
}

export default function MotionWrapper({
  children,
  variant = 'fadeIn',
  delay = 0,
  duration = 400,
  className = '',
}: MotionWrapperProps) {
  const variants = {
    fadeIn: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slideUp: {
      initial: { y: 20, opacity: 0 },
      animate: { y: 0, opacity: 1 },
      exit: { y: -20, opacity: 0 },
    },
    scaleIn: {
      initial: { scale: 0.95, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 1.05, opacity: 0 },
    },
    stagger: {
      initial: { opacity: 0, y: 20, rotate: 5 },
      animate: { opacity: 1, y: 0, rotate: 0 },
      exit: { opacity: 0, y: -20, rotate: -5 },
    },
  };

  const selectedVariant = variants[variant];

  return (
    <motion.div
      className={className}
      initial={selectedVariant.initial}
      animate={selectedVariant.animate}
      exit={selectedVariant.exit}
      transition={{
        duration: duration / 1000,
        delay: delay / 1000,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  );
}
