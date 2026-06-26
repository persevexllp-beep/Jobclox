/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import BrandLogo from '@/src/components/BrandLogo';
import SkeletonLoader from '@/src/components/SkeletonLoader';

export default function CandidateApplyLoading() {
  return (
    <main className="apply-workspace apply-route-loading">
      <header className="apply-route-loading-header">
        <BrandLogo />
        <div className="apply-route-loading-pill" aria-hidden="true" />
      </header>
      <SkeletonLoader type="applyWorkspace" count={3} />
    </main>
  );
}
