'use client';

import { useState, useEffect } from 'react';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('elvora_cookie_consent');
    if (!consent) setVisible(true);
  }, []);

  const accept = (choice: 'all' | 'necessary') => {
    localStorage.setItem('elvora_cookie_consent', choice);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-2xl mx-auto card rounded-xl p-5 shadow-2xl border border-elvora-border">
        <p className="text-sm text-elvora-text mb-4">
          Diese Website verwendet technisch notwendige Cookies für die Funktionalität.
          Weitere Informationen finden Sie in unserer Datenschutzerklärung.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => accept('necessary')}
            className="px-4 py-2 text-sm rounded-lg border border-elvora-border text-elvora-text-dim hover:bg-elvora-bg-alt transition-colors"
          >
            Nur notwendige
          </button>
          <button
            onClick={() => accept('all')}
            className="px-4 py-2 text-sm rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/90 transition-colors"
          >
            Alle akzeptieren
          </button>
        </div>
      </div>
    </div>
  );
}
