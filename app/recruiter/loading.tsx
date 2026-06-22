import BrandLogo from '@/src/components/BrandLogo';
import SkeletonLoader from '@/src/components/SkeletonLoader';

export default function RecruiterLoading() {
  return (
    <main className="pvx-dashboard-shell pvx-route-dashboard-loading">
      <header><BrandLogo subline="Recruiter workspace" /><span>Preparing hiring activity and candidate pipeline</span></header>
      <SkeletonLoader type="hiringWorkspace" count={4} />
    </main>
  );
}
