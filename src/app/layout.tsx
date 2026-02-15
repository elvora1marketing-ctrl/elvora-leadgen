import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Elvora - Lead Generator',
  description: 'Lead-Generierung für SHK-Betriebe in NRW',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-elvora-bg">
          <Sidebar />
          <main className="flex-1 ml-56 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
