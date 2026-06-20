'use client';

import React from 'react';
import { cn } from '@/src/lib/cn';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const variantClass: Record<BadgeVariant, string> = {
  neutral: 'pvx-badge--neutral',
  accent: 'pvx-badge--accent',
  success: 'pvx-badge--success',
  warning: 'pvx-badge--warning',
  danger: 'pvx-badge--danger',
};

export default function Badge({
  variant = 'neutral',
  size = 'md',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn('pvx-badge', variantClass[variant], size === 'sm' && 'pvx-badge--sm', className)}
      {...props}
    >
      {children}
    </span>
  );
}
