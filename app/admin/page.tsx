'use client';

import WorkspaceRuntime from '@/src/components/WorkspaceRuntime';
import AdminDashboard from '@/src/components/AdminDashboard';

export default function AdminPage() {
  return <WorkspaceRuntime requiredRole="admin" Dashboard={AdminDashboard} />;
}
