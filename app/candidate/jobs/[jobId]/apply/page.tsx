import WorkspaceRuntime from '@/src/components/WorkspaceRuntime';
import CandidateApplyWorkspace from '@/src/components/CandidateApplyWorkspace';

export default function CandidateJobApplyPage() {
  return <WorkspaceRuntime requiredRole="candidate" Dashboard={CandidateApplyWorkspace} />;
}
