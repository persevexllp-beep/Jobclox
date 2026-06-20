'use client';

import React, { useId } from 'react';
import { cn } from '@/src/lib/cn';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export default function Select({ label, hint, error, className, id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id || `pvx-select-${generatedId.replace(/:/g, '')}`;
  const descriptionId = error || hint ? `${selectId}-description` : undefined;

  return (
    <label className={cn('pvx-field', error && 'pvx-field--error', className)} htmlFor={selectId}>
      {label && <span className="pvx-field-label">{label}</span>}
      <select id={selectId} className="pvx-select" aria-invalid={error ? true : undefined} aria-describedby={descriptionId} {...props}>
        {children}
      </select>
      {error ? (
        <span id={descriptionId} className="pvx-field-error" role="alert">{error}</span>
      ) : hint ? (
        <span id={descriptionId} className="pvx-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
