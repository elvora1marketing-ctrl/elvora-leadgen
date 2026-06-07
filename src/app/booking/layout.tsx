import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import CookieBanner from '@/components/CookieBanner';
import LegalFooter from '@/components/LegalFooter';
import EmbedWrapper from './embed-wrapper';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Termin buchen',
  description: 'Buchen Sie einen passenden Termin für ein unverbindliches Erstgespräch.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0f',
};

export default function BookingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`min-h-screen bg-elvora-bg ${inter.className}`}>
      <EmbedWrapper>{children}</EmbedWrapper>
    </div>
  );
}
