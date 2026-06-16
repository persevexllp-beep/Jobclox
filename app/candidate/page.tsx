'use client';

import dynamic from 'next/dynamic';
import WorkspaceRuntime from '@/src/components/WorkspaceRuntime';

const CandidateDashboard = dynamic(() => import('@/src/components/CandidateDashboard'), { ssr: false });

export default function CandidatePage() {
  return <WorkspaceRuntime requiredRole="candidate" Dashboard={CandidateDashboard} />;
}
