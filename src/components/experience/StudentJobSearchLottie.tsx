'use client';

import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';
import pageSearching from '@/page searching.json';

const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => <span className="student-job-search-fallback" aria-hidden="true" />,
});

export default function StudentJobSearchLottie({ className = '', label = 'Student searching for jobs' }: { className?: string; label?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={`student-job-search-lottie ${className}`} role="img" aria-label={label}>
      <Lottie animationData={pageSearching} autoplay={!reduceMotion} loop={!reduceMotion} />
    </span>
  );
}
