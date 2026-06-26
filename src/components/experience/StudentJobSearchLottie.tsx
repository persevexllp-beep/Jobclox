'use client';

import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';
import studentJobSearch from '@/public/animations/student-job-search.json';

const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => <span className="student-job-search-fallback" aria-hidden="true" />,
});

export default function StudentJobSearchLottie({ className = '', label = 'Student searching for jobs' }: { className?: string; label?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={`student-job-search-lottie ${className}`} role="img" aria-label={label}>
      <Lottie animationData={studentJobSearch} autoplay={!reduceMotion} loop={!reduceMotion} />
      <span className="student-job-search-figure" aria-hidden="true">
        <i className="student-head" />
        <i className="student-body" />
        <i className="student-arm" />
        <i className="student-laptop" />
      </span>
    </span>
  );
}
