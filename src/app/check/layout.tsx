import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Kostenloser Website-Check | Elvora',
  description: 'Testen Sie Ihre Website kostenlos. Wir analysieren Ladezeit, SEO, Mobilfreundlichkeit und mehr.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
};

export default function CheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen bg-elvora-bg ${inter.className}`}>
      {children}
    </div>
  );
}
