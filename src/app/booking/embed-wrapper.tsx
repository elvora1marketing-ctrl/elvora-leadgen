'use client';

import { useState, useEffect } from 'react';
import CookieBanner from '@/components/CookieBanner';
import LegalFooter from '@/components/LegalFooter';

export default function EmbedWrapper({ children }: { children: React.ReactNode }) {
  const [isEmbed, setIsEmbed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsEmbed(params.has('embed'));
  }, []);

  useEffect(() => {
    if (!isEmbed) return;
    const observer = new ResizeObserver(() => {
      window.parent.postMessage(
        { type: 'elvora-booking-height', height: document.body.scrollHeight },
        '*'
      );
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isEmbed]);

  return (
    <>
      {children}
      {!isEmbed && <LegalFooter />}
      {!isEmbed && <CookieBanner />}
    </>
  );
}
