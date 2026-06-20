'use client';

import React, { useId } from 'react';
import { cn } from '@/src/lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftIcon?: React.ReactNode;
}

export default function Input({
  label,
  hint,
  error,
  leftIcon,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id || `pvx-input-${generatedId.replace(/:/g, '')}`;
  const descriptionId = error || hint ? `${inputId}-description` : undefined;

  return (
    <label className={cn('pvx-field', error && 'pvx-field--error', className)} htmlFor={inputId}>
      {label && <span className="pvx-field-label">{label}</span>}
      <span className="pvx-input-wrap">
        {leftIcon && <span className="pvx-input-icon">{leftIcon}</span>}
        <input id={inputId} className={cn('pvx-input', leftIcon && 'pvx-input--with-icon')} aria-invalid={error ? true : undefined} aria-describedby={descriptionId} {...props} />
      </span>
      {error ? (
        <span id={descriptionId} className="pvx-field-error" role="alert">{error}</span>
      ) : hint ? (
        <span id={descriptionId} className="pvx-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
