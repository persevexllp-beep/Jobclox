import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
