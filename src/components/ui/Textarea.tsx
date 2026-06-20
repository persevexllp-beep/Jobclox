'use client';

import React, { useId } from 'react';
import { cn } from '@/src/lib/cn';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export default function Textarea({ label, hint, error, className, id, ...props }: TextareaProps) {
  const generatedId = useId();
  const textareaId = id || `pvx-textarea-${generatedId.replace(/:/g, '')}`;
  const descriptionId = error || hint ? `${textareaId}-description` : undefined;

  return (
    <label className={cn('pvx-field', error && 'pvx-field--error', className)} htmlFor={textareaId}>
      {label && <span className="pvx-field-label">{label}</span>}
      <textarea id={textareaId} className="pvx-textarea" aria-invalid={error ? true : undefined} aria-describedby={descriptionId} {...props} />
      {error ? (
        <span id={descriptionId} className="pvx-field-error" role="alert">{error}</span>
      ) : hint ? (
        <span id={descriptionId} className="pvx-field-hint">{hint}</span>
      ) : null}
    </label>
  );
}
