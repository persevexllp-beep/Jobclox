'use client';

import React from 'react';
import { cn } from '@/src/lib/cn';
import type { AppIcon } from '@/src/lib/icons';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: AppIcon;
  badge?: number;
}

export type TabNavOnChange<T extends string> = React.Dispatch<React.SetStateAction<T>> | ((id: T) => void);

export interface TabNavProps<T extends string = string> {
  items: ReadonlyArray<TabItem<T>>;
  activeId: T;
  onChange: TabNavOnChange<T>;
  ariaLabel: string;
  className?: string;
  variant?: 'pill' | 'underline';
}

export default function TabNav<T extends string>({
  items,
  activeId,
  onChange,
  ariaLabel,
  className,
  variant = 'pill',
}: TabNavProps<T>) {
  return (
    <nav
      className={cn('pvx-tab-nav', variant === 'underline' && 'pvx-tab-nav--underline', className)}
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const active = activeId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className={cn('pvx-tab-nav-item', active && 'is-active')}
            aria-current={active ? 'page' : undefined}
            data-state={active ? 'active' : 'inactive'}
            onClick={() => onChange(item.id)}
          >
            {Icon && <Icon className="pvx-tab-nav-icon" aria-hidden />}
            <span>{item.label}</span>
            {typeof item.badge === 'number' && item.badge > 0 && (
              <em className="pvx-tab-nav-badge">{item.badge}</em>
            )}
          </button>
        );
      })}
    </nav>
  );
}
