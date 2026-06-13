/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LucideIcon } from 'lucide-react';

interface FlowInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
}

export default function FlowInput({ icon: Icon, className = '', ...props }: FlowInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <motion.div
      className="relative flex-1 rounded-xl"
      animate={{
        boxShadow: focused
          ? '0 0 0 3px rgba(99, 102, 241, 0.12), 0 0 20px rgba(34, 211, 238, 0.08)'
          : '0 0 0 0px transparent',
      }}
      transition={{ duration: 0.2 }}
    >
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10 pointer-events-none" />
      )}
      <input
        {...props}
        className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-white/60 dark:bg-slate-900/40 border rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 transition-colors outline-none ${
          focused ? 'border-indigo-500/50' : 'border-slate-200/60 dark:border-white/10'
        } ${className}`}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      />
    </motion.div>
  );
}
