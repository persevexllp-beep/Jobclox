/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Career Progress Journey — visual career pipeline
 * Training → Internship → Applications → Interviews → Placement
 */

import React from 'react';
import { motion } from 'motion/react';
import { GraduationCap, Briefcase, Send, Video, Trophy, Check } from 'lucide-react';
import { tokens } from '../../tokens';

export type JourneyStage = 'training' | 'internship' | 'applications' | 'interviews' | 'placement';

interface CareerProgressJourneyProps {
  currentStage: JourneyStage;
  className?: string;
}

const STAGES: { id: JourneyStage; label: string; icon: React.ElementType }[] = [
  { id: 'training', label: 'Training', icon: GraduationCap },
  { id: 'internship', label: 'Internship', icon: Briefcase },
  { id: 'applications', label: 'Applications', icon: Send },
  { id: 'interviews', label: 'Interviews', icon: Video },
  { id: 'placement', label: 'Placement', icon: Trophy },
];

const STAGE_INDEX: Record<JourneyStage, number> = {
  training: 0,
  internship: 1,
  applications: 2,
  interviews: 3,
  placement: 4,
};

export default function CareerProgressJourney({
  currentStage,
  className = '',
}: CareerProgressJourneyProps) {
  const currentIdx = STAGE_INDEX[currentStage];
  const progressPct = (currentIdx / (STAGES.length - 1)) * 100;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-mono font-bold tracking-widest uppercase text-indigo-500">
          Placement Engine
        </span>
        <span className="text-[10px] font-mono text-slate-400">
          Stage {currentIdx + 1} of {STAGES.length}
        </span>
      </div>

      {/* Progress track */}
      <div className="relative h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/50 overflow-hidden mb-6">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: tokens.colors.gradients.careerFlow }}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
        />
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full opacity-60"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
            width: `${progressPct}%`,
          }}
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', delay: 1.5 }}
        />
      </div>

      {/* Stage nodes */}
      <div className="flex justify-between relative">
        {/* Connection line behind nodes */}
        <div className="absolute top-5 left-5 right-5 h-px bg-slate-200 dark:bg-slate-700 -z-0" />

        {STAGES.map((stage, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;
          const Icon = stage.icon;
          const color = tokens.careerFlow.progress[stage.id];

          return (
            <motion.div
              key={stage.id}
              className="flex flex-col items-center relative z-10"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + idx * 0.08 }}
            >
              <motion.div
                className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-colors ${
                  isFuture
                    ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'
                    : 'border-transparent'
                }`}
                style={{
                  background: isComplete || isCurrent ? `${color}18` : undefined,
                  borderColor: isCurrent ? color : isComplete ? `${color}60` : undefined,
                  boxShadow: isCurrent ? `0 0 20px ${color}40` : 'none',
                }}
                animate={isCurrent ? { scale: [1, 1.06, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                {isComplete ? (
                  <Check className="h-4 w-4" style={{ color }} strokeWidth={3} />
                ) : (
                  <Icon
                    className={`h-4 w-4 ${isFuture ? 'text-slate-400' : ''}`}
                    style={{ color: isCurrent ? color : isFuture ? undefined : color }}
                    strokeWidth={isCurrent ? 2.5 : 2}
                  />
                )}
              </motion.div>
              <span
                className={`text-[9px] font-semibold mt-2 text-center max-w-[60px] leading-tight ${
                  isCurrent
                    ? 'text-slate-900 dark:text-white'
                    : isFuture
                    ? 'text-slate-400'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {stage.label}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
