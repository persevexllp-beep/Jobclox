/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';
import { tokens } from '../../tokens';

interface SuccessAnimationProps {
  onComplete?: () => void;
  size?: number;
  className?: string;
}

export default function SuccessAnimation({
  onComplete,
  size = 80,
  className = '',
}: SuccessAnimationProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Expanding ring */}
      <motion.div
        className="absolute rounded-full border-2"
        style={{
          width: size,
          height: size,
          borderColor: tokens.colors.semantic.success,
        }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: [0.8, 1.2, 1], opacity: [0, 1, 1] }}
        transition={{
          duration: 0.6,
          ease: 'easeOut',
        }}
      />

      {/* Pulse ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle, ${tokens.colors.semantic.success}33 0%, transparent 70%)`,
        }}
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
        transition={{
          duration: 0.8,
          repeat: 2,
          ease: 'easeOut',
        }}
      />

      {/* Checkmark circle */}
      <motion.div
        className="absolute rounded-full flex items-center justify-center"
        style={{
          width: size * 0.7,
          height: size * 0.7,
          background: tokens.colors.semantic.success,
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          delay: 0.2,
        }}
      >
        {/* Checkmark icon */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            duration: 0.4,
            delay: 0.4,
            ease: 'easeOut',
          }}
          onAnimationComplete={onComplete}
        >
          <Check size={size * 0.4} color="white" strokeWidth={3} />
        </motion.div>
      </motion.div>

      {/* Particle burst */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 6,
            height: 6,
            background: tokens.colors.semantic.success,
          }}
          initial={{ scale: 0, opacity: 1, x: 0, y: 0 }}
          animate={{
            scale: [0, 1, 0],
            opacity: [1, 0, 0],
            x: Math.cos((i * Math.PI * 2) / 8) * 40,
            y: Math.sin((i * Math.PI * 2) / 8) * 40,
          }}
          transition={{
            duration: 0.8,
            delay: 0.3,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}
