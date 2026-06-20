'use client';

import React from 'react';
import { cn } from '@/src/lib/cn';

export interface DashboardShellProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'candidate' | 'recruiter' | 'admin' | 'default';
}

const variantClass = {
  candidate: 'pvx-dashboard-shell--candidate',
  recruiter: 'pvx-dashboard-shell--recruiter',
  admin: 'pvx-dashboard-shell--admin',
  default: '',
};

export default function DashboardShell({
  children,
  className,
  variant = 'default',
}: DashboardShellProps) {
  return (
    <div className={cn('pvx-dashboard-shell', variantClass[variant], className)}>
      {children}
    </div>
  );
}
