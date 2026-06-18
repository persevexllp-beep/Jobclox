'use client';

import WorkspaceRuntime from '@/src/components/WorkspaceRuntime';
import CandidateDashboard from '@/src/components/CandidateDashboard';

export default function CandidatePage() {
  return <WorkspaceRuntime requiredRole="candidate" Dashboard={CandidateDashboard} />;
}
