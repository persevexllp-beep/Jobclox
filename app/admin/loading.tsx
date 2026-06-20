import BrandLogo from '@/src/components/BrandLogo';
import SkeletonLoader from '@/src/components/SkeletonLoader';

export default function AdminLoading() {
  return (
    <main className="pvx-dashboard-shell pvx-route-dashboard-loading">
      <header><BrandLogo subline="Platform operations" /><span>Preparing moderation and platform health</span></header>
      <SkeletonLoader type="metrics" count={4} />
      <div className="pvx-route-loading-spacer" />
      <SkeletonLoader type="table" count={6} />
    </main>
  );
}
