'use client';

import type { ReactNode } from 'react';
import { MotionConfig } from 'motion/react';

type MotionProviderProps = {
  children: ReactNode;
};

export default function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </MotionConfig>
  );
}
