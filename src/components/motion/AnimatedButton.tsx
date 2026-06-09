/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { tokens } from '../../tokens';

interface AnimatedButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  magnetic?: boolean;
  glow?: boolean;
  ripple?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export default function AnimatedButton({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  className = '',
  magnetic = true,
  glow = true,
  ripple = true,
  type = 'button',
}: AnimatedButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  // Mouse position for magnetic effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Spring physics for smooth magnetic movement
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  const handleMouseMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current || !magnetic || disabled) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    x.set((event.clientX - centerX) * 0.3);
    y.set((event.clientY - centerY) * 0.3);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current || !ripple || disabled) return;

    const rect = ref.current.getBoundingClientRect();
    const rippleX = event.clientX - rect.left;
    const rippleY = event.clientY - rect.top;

    const newRipple = {
      id: Date.now(),
      x: rippleX,
      y: rippleY,
    };

    setRipples([...ripples, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);

    onClick?.();
  };

  // Variant styles
  const variantStyles = {
    primary: {
      background: tokens.colors.gradients.primary,
      color: 'white',
      border: 'none',
    },
    secondary: {
      background: 'rgba(255, 255, 255, 0.1)',
      color: tokens.colors.light.text.primary,
      border: '1px solid rgba(255, 255, 255, 0.2)',
    },
    ghost: {
      background: 'transparent',
      color: tokens.colors.light.text.primary,
      border: 'none',
    },
  };

  // Size styles
  const sizeStyles = {
    sm: {
      padding: '8px 16px',
      fontSize: '12px',
    },
    md: {
      padding: '12px 24px',
      fontSize: '14px',
    },
    lg: {
      padding: '16px 32px',
      fontSize: '16px',
    },
  };

  return (
    <motion.button
      ref={ref}
      type={type}
      className={`
        relative
        overflow-hidden
        rounded-xl
        font-semibold
        cursor-pointer
        transition-all
        disabled:opacity-50
        disabled:cursor-not-allowed
        ${className}
      `}
      style={{
        ...variantStyles[variant],
        ...sizeStyles[size],
        x: magnetic ? springX : 0,
        y: magnetic ? springY : 0,
        boxShadow: isHovered && glow && !disabled
          ? '0 0 20px rgba(16, 185, 129, 0.4)'
          : 'none',
      }}
      whileHover={magnetic && !disabled ? {} : {
        scale: disabled ? 1 : 1.02,
      }}
      whileTap={{
        scale: disabled ? 1 : 0.98,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      disabled={disabled}
    >
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <motion.div
          key={ripple.id}
          className="absolute rounded-full bg-white/30"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            left: ripple.x,
            top: ripple.y,
            width: '20px',
            height: '20px',
            marginLeft: '-10px',
            marginTop: '-10px',
          }}
        />
      ))}

      {/* Content */}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
