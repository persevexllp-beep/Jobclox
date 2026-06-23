export const branding = {
  productName: 'JobClox',
  tagline: 'Your Career, On The Clock.',
  footer: '© 2026 JobClox. Powered by Persevex LLP.',
  company: 'Persevex LLP',
  logo: {
    src: '/jobclox-logo.png',
    alt: 'JobClox',
  },
  metadata: {
    title: 'JobClox — Your Career, On The Clock.',
    description: 'Discover verified jobs and internships, build a stronger career profile, and hire high-intent early-career talent with JobClox.',
    siteName: 'JobClox',
  },
} as const;

export type BrandingConfig = typeof branding;
