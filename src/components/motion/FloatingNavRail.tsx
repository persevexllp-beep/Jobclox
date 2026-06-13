/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Floating Navigation Rail — Arc Browser inspired
 * Glass, magnetic hover, active glow, smooth morphing
 */

import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import { LucideIcon } from 'lucide-react';

export interface NavRailItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface FloatingNavRailProps {
  items: NavRailItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export default function FloatingNavRail({
  items,
  activeId,
  onSelect,
  className = '',
}: FloatingNavRailProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 18 });
  const springY = useSpring(y, { stiffness: 180, damping: 18 });

  const handleMove = (event: React.MouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    x.set((event.clientX - rect.left - rect.width / 2) * 0.05);
    y.set((event.clientY - rect.top - rect.height / 2) * 0.05);
  };

  return (
    <motion.nav
      className={`fixed left-5 top-1/2 z-40 hidden -translate-y-1/2 lg:flex ${className}`}
      style={{ x: springX, y: springY }}
      initial={{ opacity: 0, x: -28, filter: 'blur(12px)' }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 0.15, type: 'spring', stiffness: 110, damping: 18 }}
      onMouseEnter={() => setExpanded(true)}
      onMouseMove={handleMove}
      onMouseLeave={() => {
        setExpanded(false);
        setHoveredId(null);
        x.set(0);
        y.set(0);
      }}
    >
      <motion.div
        className="flow-nav-rail flex flex-col gap-2 overflow-hidden p-2"
        animate={{ width: expanded ? 246 : 70 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <motion.div
            className="flow-brand-mark grid h-10 w-10 shrink-0 place-items-center"
            whileHover={{ scale: 1.08, rotate: -4 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <span className="font-display text-sm font-bold text-white">P</span>
          </motion.div>
          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden whitespace-nowrap"
              >
                <span className="block font-display text-sm font-bold leading-tight text-slate-950 dark:text-white">
                  Persevex Flow
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-500">
                  Career Operating Rail
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mx-2 h-px bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent" />

        {items.map((item) => {
          const isActive = activeId === item.id;
          const isHovered = hoveredId === item.id;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.id}
              onClick={() => onSelect(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="flow-nav-item relative flex w-full cursor-pointer items-center gap-3 overflow-hidden px-3 py-2.5 text-left"
              whileTap={{ scale: 0.965 }}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-rail-active"
                  className="flow-nav-active absolute inset-0"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              {isHovered && !isActive && (
                <motion.div className="flow-nav-hover absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
              )}

              <motion.div
                className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                animate={{
                  scale: isHovered ? 1.1 : 1,
                  rotate: isActive ? 0 : isHovered ? -3 : 0,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Icon
                  className={`h-[18px] w-[18px] transition-colors duration-200 ${
                    isActive ? 'text-cyan-500 dark:text-cyan-300' : 'text-slate-500 dark:text-slate-400'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </motion.div>

              <AnimatePresence>
                {expanded && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.12 }}
                    className={`relative z-10 whitespace-nowrap text-xs font-semibold ${
                      isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>

              {item.badge !== undefined && item.badge > 0 && (
                <motion.span
                  className={`relative z-10 ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    isActive
                      ? 'bg-cyan-400 text-slate-950'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  } ${expanded ? '' : 'absolute -top-0.5 -right-0.5 min-w-[18px] text-center'}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                >
                  {item.badge}
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </motion.nav>
  );
}
