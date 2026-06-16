'use client';

import dynamic from 'next/dynamic';
import WorkspaceRuntime from '@/src/components/WorkspaceRuntime';

const CompanyDashboard = dynamic(() => import('@/src/components/CompanyDashboard'), { ssr: false });

export default function RecruiterPage() {
  return <WorkspaceRuntime requiredRole="company" Dashboard={CompanyDashboard} />;
}
