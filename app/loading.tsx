import BrandLogo from '@/src/components/BrandLogo';

export default function RootLoading() {
  return (
    <main className="pvx-route-loading" role="status" aria-live="polite">
      <div className="pvx-route-loading-brand"><BrandLogo subline="Preparing your experience" /></div>
      <div className="pvx-route-loading-line" aria-hidden="true"><span /></div>
      <p>Loading Persevex</p>
    </main>
  );
}
