import type { Metadata } from 'next';
import { Inter, Sora } from 'next/font/google';
import './globals.css';
import { THEME_STORAGE_KEY } from '@/src/lib/theme-constants';
import MotionProvider from '@/src/components/motion/MotionProvider';
import { branding } from '@/src/config/branding';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const sora = Sora({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: branding.metadata.title,
    template: `%s | ${branding.productName}`,
  },
  description: branding.metadata.description,
  applicationName: branding.productName,
  appleWebApp: {
    capable: true,
    title: branding.productName,
  },
  icons: {
    icon: branding.logo.src,
    shortcut: branding.logo.src,
    apple: branding.logo.src,
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: branding.metadata.title,
    description: branding.metadata.description,
    siteName: branding.metadata.siteName,
    images: [{ url: branding.logo.src, alt: branding.logo.alt }],
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${sora.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var storageKey=${JSON.stringify(THEME_STORAGE_KEY)};var stored=localStorage.getItem(storageKey);var theme=(stored==='dark'||stored==='light')?stored:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.dataset.theme=theme;root.classList.toggle('dark',theme==='dark');root.style.colorScheme=theme;}catch(_error){}})();`,
          }}
        />
      </head>
      <body className={inter.className}>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
