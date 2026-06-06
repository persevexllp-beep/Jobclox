/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SkeletonLoaderProps {
  type?: 'analytics' | 'jobGrid' | 'table' | 'profile';
  count?: number;
}

export default function SkeletonLoader({ type = 'jobGrid', count = 3 }: SkeletonLoaderProps) {
  // Base pulsing class that handles light and dark background styles beautifully
  const pulseBg = 'bg-slate-200/80 dark:bg-slate-700/40 animate-pulse rounded-xl';
  const pulseText = 'bg-slate-200/60 dark:bg-slate-700/35 animate-pulse rounded-md';

  if (type === 'analytics') {
    return (
      <div className="space-y-8 animate-fade-in">
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs space-y-3 dark:bg-slate-900 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <div className={`${pulseText} h-4 w-20`} />
                <div className={`${pulseBg} h-8 w-8 rounded-full`} />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className={`${pulseBg} h-8 w-16`} />
                <div className={`${pulseText} h-3.5 w-28`} />
              </div>
            </div>
          ))}
        </div>

        {/* Charts Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800 space-y-4">
            <div className="flex justify-between items-center">
              <div className="space-y-1.5">
                <div className={`${pulseBg} h-5 w-32`} />
                <div className={`${pulseText} h-3.5 w-48`} />
              </div>
              <div className={`${pulseBg} h-8 w-24`} />
            </div>
            <div className={`${pulseBg} h-64 w-full rounded-2xl`} />
          </div>
          <div className="lg:col-span-4 bg-white border border-slate-150 rounded-2xl p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800 space-y-4 flex flex-col justify-between">
            <div className="space-y-1.5">
              <div className={`${pulseBg} h-5 w-24`} />
              <div className={`${pulseText} h-3.5 w-36`} />
            </div>
            <div className="flex items-center justify-center py-6">
              <div className={`${pulseBg} h-40 w-40 rounded-full`} />
            </div>
            <div className="space-y-2">
              <div className={`${pulseText} h-3.5 w-full`} />
              <div className={`${pulseText} h-3.5 w-4/5`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'jobGrid') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Search & Filter Header Skeleton */}
        <div className="bg-white border border-slate-150 rounded-2xl p-4 sm:p-5 shadow-xs dark:bg-slate-900 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-4">
            <div className="md:col-span-6">
              <div className={`${pulseBg} h-10 w-full`} />
            </div>
            <div className="md:col-span-3">
              <div className={`${pulseBg} h-10 w-full`} />
            </div>
            <div className="md:col-span-3">
              <div className={`${pulseBg} h-10 w-full`} />
            </div>
          </div>
        </div>

        {/* List Grid Item Cards Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-150 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col justify-between h-[250px] dark:bg-slate-900 dark:border-slate-800">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className={`${pulseBg} h-5 w-4/5`} />
                    <div className="flex space-x-1.5">
                      <div className={`${pulseText} h-4 w-24`} />
                      <div className={`${pulseText} h-4 w-16`} />
                    </div>
                  </div>
                  <div className={`${pulseBg} h-10 w-10`} />
                </div>

                <div className="grid grid-cols-2 gap-y-3 pt-2 text-xs">
                  <div className="flex items-center space-x-1.5">
                    <div className={`${pulseBg} h-4 w-4 rounded-full`} />
                    <div className={`${pulseText} h-3.5 w-16`} />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className={`${pulseBg} h-4 w-4 rounded-full`} />
                    <div className={`${pulseText} h-3.5 w-20`} />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className={`${pulseBg} h-4 w-4 rounded-full`} />
                    <div className={`${pulseText} h-3.5 w-16`} />
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <div className={`${pulseBg} h-4 w-4 rounded-full`} />
                    <div className={`${pulseText} h-3.5 w-24`} />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4 flex items-center justify-between">
                <div className={`${pulseText} h-3.5 w-24`} />
                <div className={`${pulseBg} h-8 w-24 rounded-lg`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white border border-slate-150 rounded-2xl shadow-xs overflow-hidden dark:bg-slate-900 dark:border-slate-800 animate-fade-in">
        {/* Table Filter Top Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className={`${pulseBg} h-8 w-40`} />
          <div className="flex space-x-2 w-full sm:w-auto">
            <div className={`${pulseBg} h-8 w-24`} />
            <div className={`${pulseBg} h-8 w-24`} />
          </div>
        </div>

        {/* Table Rows */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 dark:bg-slate-950 dark:border-slate-800">
                <th className="p-4"><div className={`${pulseBg} h-4 w-12`} /></th>
                <th className="p-4"><div className={`${pulseBg} h-4 w-28`} /></th>
                <th className="p-4"><div className={`${pulseBg} h-4 w-20`} /></th>
                <th className="p-4"><div className={`${pulseBg} h-4 w-24`} /></th>
                <th className="p-4"><div className={`${pulseBg} h-4 w-16`} /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {Array.from({ length: count }).map((_, idx) => (
                <tr key={idx}>
                  <td className="p-4"><div className={`${pulseText} h-4 w-8`} /></td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`${pulseBg} h-10 w-10 rounded-full`} />
                      <div className="space-y-1.5">
                        <div className={`${pulseText} h-4 w-32`} />
                        <div className={`${pulseText} h-3 w-40`} />
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><div className={`${pulseText} h-4 w-16`} /></td>
                  <td className="p-4"><div className={`${pulseText} h-4 w-24`} /></td>
                  <td className="p-4"><div className={`${pulseBg} h-7 w-20 rounded-full`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (type === 'profile') {
    return (
      <div className="bg-white border border-slate-150 rounded-2xl p-6 sm:p-8 shadow-xs dark:bg-slate-900 dark:border-slate-800 space-y-6 animate-fade-in">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4 space-y-1.5">
          <div className={`${pulseBg} h-4 w-24`} />
          <div className={`${pulseBg} h-6 w-48`} />
          <div className={`${pulseText} h-3.5 w-64`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <div className={`${pulseText} h-4 w-28`} />
            <div className={`${pulseBg} h-10 w-full`} />
          </div>
          <div className="space-y-1.5">
            <div className={`${pulseText} h-4 w-20`} />
            <div className={`${pulseBg} h-10 w-full`} />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className={`${pulseBg} h-4 w-32`} />
          <div className="border border-dashed border-slate-200 dark:border-slate-850 rounded-2xl p-8 text-center space-y-3 flex flex-col items-center">
            <div className={`${pulseBg} h-12 w-12 rounded-full`} />
            <div className={`${pulseBg} h-4 w-40`} />
            <div className={`${pulseText} h-3 w-52`} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className={`${pulseText} h-4 w-24`} />
          <div className={`${pulseBg} h-32 w-full`} />
        </div>

        <div className="flex justify-end pt-4">
          <div className={`${pulseBg} h-10 w-36`} />
        </div>
      </div>
    );
  }

  return null;
}
