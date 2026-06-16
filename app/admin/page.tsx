'use client';

import dynamic from 'next/dynamic';
import WorkspaceRuntime from '@/src/components/WorkspaceRuntime';

const AdminDashboard = dynamic(() => import('@/src/components/AdminDashboard'), { ssr: false });

export default function AdminPage() {
  return <WorkspaceRuntime requiredRole="admin" Dashboard={AdminDashboard} />;
}
