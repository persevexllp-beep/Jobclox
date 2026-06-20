/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SkeletonLoaderProps {
  type?: 'analytics' | 'jobGrid' | 'table' | 'profile' | 'metrics' | 'candidateCards' | 'pipeline';
  count?: number;
}

export default function SkeletonLoader({ type = 'jobGrid', count = 3 }: SkeletonLoaderProps) {
  const loadingLabel = {
    analytics: 'Loading analytics',
    jobGrid: 'Loading opportunities',
    table: 'Loading table',
    profile: 'Loading profile',
    metrics: 'Loading summary metrics',
    candidateCards: 'Loading candidates',
    pipeline: 'Loading hiring pipeline',
  }[type];

  return (
    <div className="pvx-skeleton-region" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{loadingLabel}</span>
      <SkeletonContent type={type} count={count} />
    </div>
  );
}

function SkeletonContent({ type = 'jobGrid', count = 3 }: SkeletonLoaderProps) {
  const pulseBg = 'pvx-skeleton';
  const pulseText = 'pvx-skeleton h-3';
  const surface = 'pvx-skeleton-card';

  if (type === 'metrics') {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className={`${surface} space-y-3`}>
            <div className="flex items-center justify-between gap-3">
              <div className={`${pulseText} w-24`} />
              <div className={`${pulseBg} h-8 w-8 rounded-lg`} />
            </div>
            <div className={`${pulseBg} h-8 w-16`} />
            <div className={`${pulseText} w-28`} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'candidateCards') {
    return (
      <div className="grid gap-3">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className={`${surface} space-y-3`}>
            <div className="flex items-start gap-3">
              <div className={`${pulseBg} h-11 w-11 rounded-xl`} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className={`${pulseBg} h-4 w-2/3`} />
                <div className={`${pulseText} w-4/5`} />
              </div>
              <div className={`${pulseBg} h-8 w-14 rounded-lg`} />
            </div>
            <div className="flex gap-2">
              <div className={`${pulseText} h-6 w-20 rounded-full`} />
              <div className={`${pulseText} h-6 w-24 rounded-full`} />
              <div className={`${pulseText} h-6 w-16 rounded-full`} />
            </div>
            <div className={`${pulseBg} h-10 w-full`} />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'pipeline') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <section key={idx} className={`${surface} p-3 space-y-3 min-h-[320px]`}>
            <div className="flex items-center justify-between">
              <div className={`${pulseBg} h-4 w-20`} />
              <div className={`${pulseText} h-6 w-8 rounded-full`} />
            </div>
            <SkeletonContent type="candidateCards" count={Math.max(1, Math.min(2, count))} />
          </section>
        ))}
      </div>
    );
  }

  if (type === 'analytics') {
    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className={`${surface} space-y-3`}>
              <div className="flex justify-between items-center">
                <div className={`${pulseText} w-20`} />
                <div className={`${pulseBg} h-8 w-8 rounded-full`} />
              </div>
              <div className="space-y-1.5 pt-1">
                <div className={`${pulseBg} h-8 w-16`} />
                <div className={`${pulseText} w-28`} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-8 ${surface} space-y-4`}>
            <div className="flex justify-between items-center">
              <div className="space-y-1.5">
                <div className={`${pulseBg} h-5 w-32`} />
                <div className={`${pulseText} w-48`} />
              </div>
              <div className={`${pulseBg} h-8 w-24`} />
            </div>
            <div className={`${pulseBg} h-64 w-full rounded-xl`} />
          </div>
          <div className={`lg:col-span-4 ${surface} space-y-4 flex flex-col justify-between`}>
            <div className="space-y-1.5">
              <div className={`${pulseBg} h-5 w-24`} />
              <div className={`${pulseText} w-36`} />
            </div>
            <div className="flex items-center justify-center py-6">
              <div className={`${pulseBg} h-40 w-40 rounded-full`} />
            </div>
            <div className="space-y-2">
              <div className={`${pulseText} w-full`} />
              <div className={`${pulseText} w-4/5`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'jobGrid') {
    return (
      <div className="space-y-6">
        <div className={surface}>
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

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className={`${surface} flex flex-col justify-between h-[250px]`}>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <div className={`${pulseBg} h-5 w-4/5`} />
                    <div className="flex space-x-1.5">
                      <div className={`${pulseText} w-24`} />
                      <div className={`${pulseText} w-16`} />
                    </div>
                  </div>
                  <div className={`${pulseBg} h-10 w-10`} />
                </div>
                <div className="grid grid-cols-2 gap-y-3 pt-2">
                  {Array.from({ length: 4 }).map((__, i) => (
                    <div key={i} className="flex items-center space-x-1.5">
                      <div className={`${pulseBg} h-4 w-4 rounded-full`} />
                      <div className={`${pulseText} w-16`} />
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t pt-4 mt-4 flex items-center justify-between" style={{ borderColor: 'var(--pvx-border-subtle)' }}>
                <div className={`${pulseText} w-24`} />
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
      <div className={`${surface} overflow-hidden`}>
        <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3" style={{ borderBottom: '1px solid var(--pvx-border-subtle)' }}>
          <div className={`${pulseBg} h-8 w-40`} />
          <div className="flex space-x-2 w-full sm:w-auto">
            <div className={`${pulseBg} h-8 w-24`} />
            <div className={`${pulseBg} h-8 w-24`} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: 'var(--pvx-bg-muted)', borderBottom: '1px solid var(--pvx-border-subtle)' }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <th key={i} className="p-4"><div className={`${pulseBg} h-4 w-12`} /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: count }).map((_, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--pvx-border-subtle)' }}>
                  <td className="p-4"><div className={`${pulseText} w-8`} /></td>
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className={`${pulseBg} h-10 w-10 rounded-full`} />
                      <div className="space-y-1.5">
                        <div className={`${pulseText} w-32`} />
                        <div className={`${pulseText} w-40`} />
                      </div>
                    </div>
                  </td>
                  <td className="p-4"><div className={`${pulseText} w-16`} /></td>
                  <td className="p-4"><div className={`${pulseText} w-24`} /></td>
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
      <div className={`${surface} space-y-6`}>
        <div className="pb-4 space-y-1.5" style={{ borderBottom: '1px solid var(--pvx-border-subtle)' }}>
          <div className={`${pulseBg} h-4 w-24`} />
          <div className={`${pulseBg} h-6 w-48`} />
          <div className={`${pulseText} w-64`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className={`${pulseText} w-28`} />
              <div className={`${pulseBg} h-10 w-full`} />
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2">
          <div className={`${pulseBg} h-4 w-32`} />
          <div className="rounded-xl p-8 text-center space-y-3 flex flex-col items-center" style={{ border: '1px dashed var(--pvx-border-default)' }}>
            <div className={`${pulseBg} h-12 w-12 rounded-full`} />
            <div className={`${pulseBg} h-4 w-40`} />
            <div className={`${pulseText} w-52`} />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className={`${pulseText} w-24`} />
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
