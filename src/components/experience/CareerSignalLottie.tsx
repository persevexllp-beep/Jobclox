'use client';

import dynamic from 'next/dynamic';
import { useReducedMotion } from 'motion/react';
import careerSignal from '@/public/animations/career-signal.json';

const Lottie = dynamic(() => import('lottie-react'), {
  ssr: false,
  loading: () => <span className="career-signal-fallback" aria-hidden="true" />,
});

export default function CareerSignalLottie({ className = '', label = 'AI career signal active' }: { className?: string; label?: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={`career-signal-lottie ${className}`} role="img" aria-label={label}>
      <Lottie animationData={careerSignal} autoplay={!reduceMotion} loop={!reduceMotion} />
    </span>
  );
}
