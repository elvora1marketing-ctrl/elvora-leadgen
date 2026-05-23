'use client';

import { useEffect, useState } from 'react';

export default function LegalFooter() {
  const [links, setLinks] = useState<{ privacy: string; impressum: string; agency: string }>({
    privacy: '', impressum: '', agency: '',
  });

  useEffect(() => {
    fetch('/api/legal')
      .then(r => r.json())
      .then(data => {
        setLinks({
          privacy: data.privacy_policy_url || '',
          impressum: data.impressum_url || '',
          agency: data.agency_name || '',
        });
      })
      .catch(() => {});
  }, []);

  if (!links.privacy && !links.impressum) return null;

  return (
    <footer className="mt-12 py-6 border-t border-elvora-border text-center">
      <div className="flex justify-center gap-4 text-[11px] text-elvora-text-dim">
        {links.impressum && (
          <a href={links.impressum} target="_blank" rel="noopener noreferrer" className="hover:text-elvora-text transition-colors">
            Impressum
          </a>
        )}
        {links.privacy && (
          <a href={links.privacy} target="_blank" rel="noopener noreferrer" className="hover:text-elvora-text transition-colors">
            Datenschutz
          </a>
        )}
      </div>
      {links.agency && (
        <p className="text-[10px] text-elvora-text-dim/40 mt-2">
          &copy; {new Date().getFullYear()} {links.agency}
        </p>
      )}
    </footer>
  );
}
