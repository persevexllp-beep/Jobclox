import type { MetadataRoute } from 'next';
import { branding } from '@/src/config/branding';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: branding.productName,
    short_name: branding.productName,
    description: branding.metadata.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f4eea',
    icons: [
      {
        src: branding.logo.src,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
