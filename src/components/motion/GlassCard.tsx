/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'motion/react';
import { tokens } from '../../tokens';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'dark' | 'light' | 'adaptive';
  hover?: boolean;
  tilt?: boolean;
  glow?: boolean;
  levitate?: boolean;
  onClick?: () => void;
}

const VARIANT_STYLES = {
  dark: {
    background: 'rgba(15, 23, 42, 0.75)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  light: {
    background: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(99, 102, 241, 0.12)',
  },
  adaptive: {
    background: 'var(--flow-glass-bg, rgba(255, 255, 255, 0.72))',
    borderColor: 'var(--flow-glass-border, rgba(99, 102, 241, 0.12))',
  },
};

export default function GlassCard({
  children,
  className = '',
  variant = 'adaptive',
  hover = true,
  tilt = true,
  glow = true,
  levitate = false,
  onClick,
}: GlassCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mouse position for tilt effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Transform mouse position to rotation
  const rotateX = useTransform(y, [-0.5, 0.5], [5, -5]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-5, 5]);

  // Spring physics for smooth tilt
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 20 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || !tilt) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    x.set((event.clientX - centerX) / rect.width);
    y.set((event.clientY - centerY) / rect.height);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const surface = VARIANT_STYLES[variant];

  return (
    <motion.div
      ref={ref}
      className={`
        relative
        backdrop-blur-xl
        rounded-2xl
        border
        transition-all
        ${className}
      `}
      style={{
        background: surface.background,
        borderColor: isHovered && glow ? 'rgba(99, 102, 241, 0.35)' : surface.borderColor,
        boxShadow: isHovered && glow 
          ? '0 0 30px rgba(99, 102, 241, 0.2), 0 10px 15px rgba(0, 0, 0, 0.08)' 
          : '0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.02)',
      }}
      initial={{ opacity: 0, y: 20, rotate: 5 }}
      animate={{ 
        opacity: 1, 
        y: levitate ? [-4, 4, -4] : 0,
        rotate: 0,
      }}
      transition={{
        opacity: { duration: 0.4 },
        y: levitate ? { duration: 4, repeat: Infinity, ease: 'easeInOut' } : {},
        rotate: { type: 'spring', stiffness: 100, damping: 15 },
      }}
      whileHover={hover ? {
        scale: 1.02,
        rotateX: tilt ? springRotateX.get() : 0,
        rotateY: tilt ? springRotateY.get() : 0,
      } : {}}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      {/* Gradient glow effect */}
      {isHovered && glow && (
        <motion.div
          className="absolute inset-0 rounded-2xl opacity-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(34, 211, 238, 0.06) 50%, rgba(16, 185, 129, 0.08) 100%)',
          }}
          transition={{ duration: 0.3 }}
        />
      )}

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
