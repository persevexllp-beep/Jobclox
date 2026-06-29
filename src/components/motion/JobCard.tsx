/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'motion/react';
import { MapPin, DollarSign, Building2 } from 'lucide-react';
import { Job } from '../../types';
import { tokens } from '../../tokens';
import { branding } from '@/src/config/branding';
import { hasDisclosedCompensation } from '@/src/lib/compensation';

interface JobCardProps {
  job: Job;
  onApply: (job: Job) => void;
  className?: string;
}

export default function JobCard({ job, onApply, className = '' }: JobCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Mouse position for magnetic effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Transform mouse position to rotation
  const rotateX = useTransform(y, [-0.5, 0.5], [3, -3]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-3, 3]);

  // Spring physics for smooth tilt
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 20 });

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;

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

  return (
    <motion.div
      ref={ref}
      id={`job-card-${job.id}`}
      className={`
        relative
        backdrop-blur-xl
        rounded-2xl
        border
        p-5
        flex flex-col justify-between
        transition-all
        cursor-pointer
        ${className}
      `}
      style={{
        background: 'var(--flow-glass-bg, rgba(255, 255, 255, 0.75))',
        borderColor: isHovered ? 'rgba(99, 102, 241, 0.45)' : 'var(--flow-glass-border, rgba(99, 102, 241, 0.12))',
        boxShadow: isHovered 
          ? '0 0 30px rgba(99, 102, 241, 0.2), 0 10px 15px rgba(0, 0, 0, 0.08)' 
          : '0 4px 6px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03)',
      }}
      initial={{ opacity: 0, y: 20, rotate: 5 }}
      animate={{ 
        opacity: 1, 
        y: 0, 
        rotate: 0,
      }}
      transition={{
        opacity: { duration: 0.4 },
        y: { type: 'spring', stiffness: 100, damping: 15 },
        rotate: { type: 'spring', stiffness: 100, damping: 15 },
      }}
      whileHover={{
        scale: 1.02,
        rotateX: springRotateX.get(),
        rotateY: springRotateY.get(),
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={() => onApply(job)}
    >
      {/* Gradient glow effect */}
      {isHovered && (
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

      <div className="relative z-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div>
            <motion.span
              className="text-[10px] font-bold text-slate-400 tracking-wide uppercase font-mono block"
              animate={{ color: isHovered ? tokens.colors.primary.emerald[400] : '#94a3b8' }}
              transition={{ duration: 0.2 }}
            >
              {job.department}
            </motion.span>
            <h3 className="font-display font-bold text-base text-slate-900 mt-0.5 leading-tight hover:text-emerald-700 transition-colors">
              {job.title}
            </h3>
            <motion.span
              className="text-xs text-slate-600 block font-medium mt-1"
              animate={{ color: isHovered ? tokens.colors.primary.emerald[600] : '#475569' }}
              transition={{ duration: 0.2 }}
            >
              {job.companyName}
            </motion.span>
          </div>
          <motion.span
            className="px-2 py-0.5 bg-emerald-50 text-[10px] font-bold text-emerald-800 rounded"
            animate={{ 
              scale: isHovered ? 1.1 : 1,
              rotate: isHovered ? 5 : 0,
            }}
            transition={{ duration: 0.3 }}
          >
            {job.jobType}
          </motion.span>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed mb-4">
          {job.description}
        </p>

        {/* Skills */}
        <div className="space-y-3 mb-4">
          <div>
            <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
              Must-Have Skills
            </span>
            <div className="flex flex-wrap gap-1">
              {job.requirements.map((skill, index) => (
                <motion.span
                  key={index}
                  className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] text-slate-700 font-mono"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ 
                    opacity: isHovered ? 1 : 0.7,
                    y: isHovered ? 0 : 0,
                  }}
                  transition={{ 
                    duration: 0.2,
                    delay: isHovered ? index * 0.05 : 0,
                  }}
                >
                  {skill}
                </motion.span>
              ))}
            </div>
          </div>

          {job.preferredSkills && job.preferredSkills.length > 0 && (
            <div>
              <span className="text-[9px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                Additional Preferred
              </span>
              <div className="flex flex-wrap gap-1">
                {job.preferredSkills.map((skill, index) => (
                  <motion.span
                    key={index}
                    className="px-1.5 py-0.5 bg-green-50 rounded text-[10px] text-green-700 font-mono"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ 
                      opacity: isHovered ? 1 : 0.7,
                      y: isHovered ? 0 : 0,
                    }}
                    transition={{ 
                      duration: 0.2,
                      delay: isHovered ? 0.1 + index * 0.05 : 0,
                    }}
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 pt-4 flex items-center justify-between mt-auto relative z-10">
        <div className="space-y-1">
          <div className="flex items-center text-slate-400 text-[10px]">
            <MapPin className="h-3 w-3 mr-1" />
            <span>{job.location}</span>
          </div>
          {hasDisclosedCompensation(job.salary) && (
            <motion.div
              className="flex items-center text-slate-400 text-[10px]"
              animate={{ color: isHovered ? tokens.colors.primary.emerald[600] : '#94a3b8' }}
              transition={{ duration: 0.2 }}
            >
              <DollarSign className="h-3 w-3 mr-1" />
              <span className="font-mono text-slate-600">{job.salary}</span>
            </motion.div>
          )}
        </div>

        <motion.button
          className="px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors text-white"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #5b21b6 50%, #10b981 100%)' }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => {
            e.stopPropagation();
            onApply(job);
          }}
        >
          {job.isExternal ? `Apply via ${branding.productName}` : 'Apply Now'}
        </motion.button>
      </div>
    </motion.div>
  );
}
