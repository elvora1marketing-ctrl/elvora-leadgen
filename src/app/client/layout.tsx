import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import CookieBanner from '@/components/CookieBanner';
import LegalFooter from '@/components/LegalFooter';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Client Portal',
  description: 'Ihr Projekt-Portal',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
};

export default function ClientLayout({
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
