import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import AuthProvider from '@/components/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Elvora - Lead Generator',
  description: 'Lead-Generierung für SHK-Betriebe in NRW',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Elvora',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0a0a0f',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <div className="flex min-h-screen bg-elvora-bg">
            <Sidebar />
            <main className="flex-1 ml-0 lg:ml-56 p-4 pt-16 lg:pt-6 lg:p-6 overflow-auto safe-area-pad">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
