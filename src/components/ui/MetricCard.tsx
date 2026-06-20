'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/src/lib/cn';
import Card from './Card';

export interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'accent' | 'success' | 'warning';
  className?: string;
}

const variantClass = {
  default: '',
  accent: 'pvx-metric-card--accent',
  success: 'pvx-metric-card--success',
  warning: 'pvx-metric-card--warning',
};

export default function MetricCard({
  label,
  value,
  trend,
  icon: Icon,
  variant = 'default',
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('pvx-metric-card', variantClass[variant], className)} padding="md">
      <div className="pvx-metric-card-top">
        <span className="pvx-metric-card-label">{label}</span>
        {Icon && (
          <span className="pvx-metric-card-icon" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <strong className="pvx-metric-card-value">{value}</strong>
      {trend && <span className="pvx-metric-card-trend">{trend}</span>}
    </Card>
  );
}
