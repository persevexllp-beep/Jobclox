'use client';

import React, { useEffect } from 'react';
import { ensurePerfWindow, usePerfSnapshot } from '@/src/lib/perfMonitor';

const TARGET_COMPONENTS = [
  'WorkspaceRuntime',
  'Navbar',
  'CandidateDashboard',
  'CompanyDashboard',
  'AdminDashboard',
  'JobCard',
  'ApplicationCard',
];

export default function PerfOverlay() {
  const snapshot = usePerfSnapshot();

  useEffect(() => {
    ensurePerfWindow();
  }, []);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <aside
      style={{
        position: 'fixed',
        right: 12,
        bottom: 12,
        zIndex: 9999,
        width: 320,
        maxHeight: '50vh',
        overflow: 'auto',
        borderRadius: 16,
        padding: 12,
        background: 'rgba(15, 23, 42, 0.88)',
        color: '#e2e8f0',
        boxShadow: '0 18px 60px rgba(15, 23, 42, 0.35)',
        backdropFilter: 'blur(16px)',
        fontSize: 12,
      }}
    >
      <strong style={{ display: 'block', marginBottom: 8 }}>Perf Overlay</strong>
      {TARGET_COMPONENTS.map((componentId) => {
        const entry = snapshot[componentId];
        return (
          <div key={componentId} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '4px 0' }}>
            <span>{componentId}</span>
            <span>r {entry?.renders ?? 0}</span>
            <span>c {entry?.commits ?? 0}</span>
          </div>
        );
      })}
    </aside>
  );
}
