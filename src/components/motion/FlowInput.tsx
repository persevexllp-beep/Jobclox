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
  const isReadOnly = Boolean(props.readOnly);

  return (
    <motion.div
      className="relative flex-1 rounded-xl"
      animate={{
        boxShadow: focused
          ? '0 0 0 3px rgba(37, 99, 235, 0.12)'
          : '0 0 0 0px transparent',
      }}
      transition={{ duration: 0.2 }}
    >
      {Icon && (
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-slate-300 z-10 pointer-events-none" />
      )}
      <input
        {...props}
        data-readonly={isReadOnly ? 'true' : undefined}
        className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 border rounded-xl text-sm transition-colors outline-none ${
          isReadOnly
            ? 'bg-slate-50 text-slate-900 dark:bg-slate-800/80 dark:text-slate-50'
            : 'bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white'
        } placeholder:text-slate-400 ${
          focused ? 'border-blue-600/45 dark:border-blue-400/55' : 'border-slate-200 dark:border-slate-700'
        } ${className}`}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      />
    </motion.div>
  );
}
