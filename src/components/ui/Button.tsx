'use client';

import React from 'react';
import { cn } from '@/src/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: 'pvx-btn pvx-btn--primary',
  secondary: 'pvx-btn pvx-btn--secondary',
  ghost: 'pvx-btn pvx-btn--ghost',
  danger: 'pvx-btn pvx-btn--danger',
};

const sizeClass: Record<ButtonSize, string> = {
  sm: 'pvx-btn--sm',
  md: 'pvx-btn--md',
  lg: 'pvx-btn--lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(variantClass[variant], sizeClass[size], loading && 'pvx-btn--loading', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <span className="pvx-btn-spinner" aria-hidden="true" /> : leftIcon}
      {children && <span className="pvx-btn-label">{children}</span>}
      {!loading && rightIcon}
    </button>
  );
}
