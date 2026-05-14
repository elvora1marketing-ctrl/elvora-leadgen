'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Page render error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-xl font-semibold text-white mb-2">Da ist ein Fehler aufgetreten</h1>
      <p className="text-sm text-elvora-text-dim max-w-md mb-2">
        Die Seite konnte nicht geladen werden.
      </p>
      {error.message && (
        <p className="text-xs text-red-400/70 max-w-md mb-6 font-mono bg-red-500/5 px-3 py-2 rounded-lg border border-red-500/10">
          {error.message}
        </p>
      )}
      <button
        onClick={reset}
        className="px-5 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors"
      >
        Nochmal versuchen
      </button>
    </div>
  );
}
