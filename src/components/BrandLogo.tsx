/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  subline?: string;
  compact?: boolean;
};

export default function BrandLogo({
  className = '',
  markClassName = '',
  textClassName = '',
  subline = 'Hiring & Placement Engine',
  compact = false,
}: BrandLogoProps) {
  return (
    <span className={`pvx-brand-logo ${className}`}>
      <img className={`pvx-brand-logo-mark ${markClassName}`} src="/persevex_logo.avif" alt="Persevex" width="40" height="40" decoding="async" />
      {!compact && (
        <span className={`pvx-brand-logo-text ${textClassName}`}>
          <strong>Persevex</strong>
          <small>{subline}</small>
        </span>
      )}
    </span>
  );
}
