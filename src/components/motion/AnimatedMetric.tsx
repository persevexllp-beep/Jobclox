/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';
import { tokens } from '../../tokens';

interface AnimatedMetricProps {
  label: string;
  value: number;
  color?: string;
  highlight?: boolean;
  delay?: number;
}

export default function AnimatedMetric({
  label,
  value,
  color = 'text-slate-800 dark:text-white',
  highlight = false,
  delay = 0,
}: AnimatedMetricProps) {
  const spring = useSpring(0, { stiffness: 80, damping: 20 });
  const display = useTransform(spring, (v) => Math.round(v));
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => spring.set(value), delay * 1000);
    return () => clearTimeout(timeout);
  }, [value, delay, spring]);

  useEffect(() => {
    return display.on('change', (v) => setShown(v));
  }, [display]);

  return (
    <motion.div
      className={`px-4 py-3 rounded-2xl text-center border transition-all ${
        highlight
          ? 'border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 to-cyan-500/5'
          : 'border-slate-200/60 dark:border-white/8 bg-white/50 dark:bg-slate-900/30'
      }`}
      initial={{ opacity: 0, y: 16, rotate: 3 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.5, delay, type: 'spring', stiffness: 120, damping: 16 }}
      whileHover={{ scale: 1.04, y: -2 }}
    >
      <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase block mb-0.5">
        {label}
      </span>
      <motion.span
        className={`font-display font-bold text-2xl tabular-nums ${color}`}
        style={highlight ? { background: tokens.colors.gradients.careerFlow, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : undefined}
      >
        {shown}
      </motion.span>
    </motion.div>
  );
}
