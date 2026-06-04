'use client';

import { useState, useEffect, useCallback } from 'react';
import { blockRegistry } from '@/lib/baukasten-registry';

interface BlockRender {
  id: string;
  props: Record<string, unknown>;
}

export default function BaukastenPreviewPage() {
  const [blocks, setBlocks] = useState<BlockRender[]>([]);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'preview-chrome-hide';
    style.textContent = `
      aside { display: none !important; }
      main { margin-left: 0 !important; padding: 0 !important; padding-top: 0 !important; }
      .safe-area-pad { padding: 0 !important; }
      .safe-area-top { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    if (event.data?.type === 'render') {
      setBlocks(event.data.blocks || []);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    window.parent.postMessage({ type: 'ready' }, '*');
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  if (blocks.length === 0) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0B] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#E1106E]/20 to-[#FF6A3D]/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#A1A1AA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
          <p className="text-sm text-[#636366]">Warte auf Vorschau...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0B]">
      {blocks.map((block, index) => {
        const entry = blockRegistry[block.id];
        if (!entry) {
          return (
            <div key={index} className="p-8 text-center text-[#636366] border-b border-[#26262A]">
              Block &quot;{block.id}&quot; nicht in Registry gefunden.
            </div>
          );
        }
        const Comp = entry.component;
        return <Comp key={`${block.id}-${index}`} {...block.props} />;
      })}
    </div>
  );
}
