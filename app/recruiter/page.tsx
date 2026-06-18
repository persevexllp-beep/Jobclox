'use client';

import WorkspaceRuntime from '@/src/components/WorkspaceRuntime';
import CompanyDashboard from '@/src/components/CompanyDashboard';

export default function RecruiterPage() {
  return <WorkspaceRuntime requiredRole="company" Dashboard={CompanyDashboard} />;
}
