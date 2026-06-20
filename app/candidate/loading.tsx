import BrandLogo from '@/src/components/BrandLogo';
import SkeletonLoader from '@/src/components/SkeletonLoader';

export default function CandidateLoading() {
  return (
    <main className="pvx-dashboard-shell pvx-route-dashboard-loading">
      <header><BrandLogo subline="Candidate workspace" /><span>Preparing recommendations and career signals</span></header>
      <SkeletonLoader type="metrics" count={4} />
      <div className="pvx-route-loading-spacer" />
      <SkeletonLoader type="jobGrid" count={6} />
    </main>
  );
}
