import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import CookieBanner from '@/components/CookieBanner';
import LegalFooter from '@/components/LegalFooter';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Website-Audit Report',
  description: 'Kostenloser Website-Audit für Ihren Betrieb',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
};

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen bg-elvora-bg ${inter.className}`}>
      {children}
      <LegalFooter />
      <CookieBanner />
    </div>
  );
}
