'use client';

import React from 'react';
import { cn } from '@/src/lib/cn';
import Badge from '@/src/components/ui/Badge';

export interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string;
  actions?: React.ReactNode;
  className?: string;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('pvx-page-header', className)}>
      <div className="pvx-page-header-copy">
        {eyebrow && <span className="pvx-page-header-eyebrow">{eyebrow}</span>}
        <div className="pvx-page-header-title-row">
          <h1 className="pvx-page-header-title">{title}</h1>
          {badge && <Badge variant="accent">{badge}</Badge>}
        </div>
        {description && <p className="pvx-page-header-description">{description}</p>}
      </div>
      {actions && <div className="pvx-page-header-actions">{actions}</div>}
    </header>
  );
}
