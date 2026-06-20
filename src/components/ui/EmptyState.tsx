'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/cn';
import Button from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('pvx-empty-state', className)}>
      {Icon && (
        <div className="pvx-empty-state-icon" aria-hidden="true">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <h3 className="pvx-empty-state-title">{title}</h3>
      {description && <p className="pvx-empty-state-description">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
