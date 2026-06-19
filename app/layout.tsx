import type { Metadata } from 'next';
import './globals.css';
import { THEME_STORAGE_KEY } from '@/src/lib/theme-constants';
import MotionProvider from '@/src/components/motion/MotionProvider';

export const metadata: Metadata = {
  title: 'Persevex Job Portal',
  description: 'Next.js migration shell for the Persevex hiring and placement platform.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var storageKey=${JSON.stringify(THEME_STORAGE_KEY)};var stored=localStorage.getItem(storageKey);var theme=(stored==='dark'||stored==='light')?stored:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.dataset.theme=theme;root.classList.toggle('dark',theme==='dark');root.style.colorScheme=theme;}catch(_error){}})();`,
          }}
        />
      </head>
      <body>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
