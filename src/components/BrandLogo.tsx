/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import persevexLogo from '../../Logo/persevex_logo.avif';

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
      <img className={`pvx-brand-logo-mark ${markClassName}`} src={persevexLogo} alt="Persevex" />
      {!compact && (
        <span className={`pvx-brand-logo-text ${textClassName}`}>
          <strong>Persevex</strong>
          <small>{subline}</small>
        </span>
      )}
    </span>
  );
}
