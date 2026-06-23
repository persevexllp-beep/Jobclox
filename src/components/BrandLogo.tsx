/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { branding } from '@/src/config/branding';

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
  subline = branding.tagline,
  compact = false,
}: BrandLogoProps) {
  return (
    <span className={`pvx-brand-logo ${className}`}>
      <img className={`pvx-brand-logo-mark ${markClassName}`} src={branding.logo.src} alt={branding.logo.alt} width="40" height="40" decoding="async" />
      {!compact && (
        <span className={`pvx-brand-logo-text ${textClassName}`}>
          <strong>{branding.productName}</strong>
          <small>{subline}</small>
        </span>
      )}
    </span>
  );
}
