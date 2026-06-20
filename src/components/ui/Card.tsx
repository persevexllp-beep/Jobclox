'use client';

import React from 'react';
import { cn } from '@/src/lib/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'ghost';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

const paddingClass = {
  none: '',
  sm: 'pvx-card--pad-sm',
  md: 'pvx-card--pad-md',
  lg: 'pvx-card--pad-lg',
};

export default function Card({
  variant = 'default',
  padding = 'md',
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'pvx-card',
        variant === 'elevated' && 'pvx-card--elevated',
        variant === 'ghost' && 'pvx-card--ghost',
        paddingClass[padding],
        interactive && 'pvx-card--interactive',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('pvx-card-header', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('pvx-card-title', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('pvx-card-description', className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('pvx-card-content', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('pvx-card-footer', className)} {...props}>
      {children}
    </div>
  );
}
