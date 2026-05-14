'use client';

import { useState, useEffect } from 'react';

interface EmailResult {
  email: string;
  score: number;
}

interface EnrichResult {
  lead_id: number;
  lead_name: string;
  website: string;
  emails_found: string[];
  phones_found: string[];
  decision_maker: string | null;
  best_email: string | null;
  updated: boolean;
  error?: string;
}

interface Stats {
  total_leads: number;
  with_email: number;
  enrichable: number;
  without_email: number;
}

function scoreLabel(score: number) {
  if (score >= 80) return { text: 'Entscheider', color: 'bg-elvora-success/15 text-elvora-success' };
  if (score >= 50) return { text: 'Persönlich', color: 'bg-elvora-purple/15 text-elvora-purple-light' };
  if (score >= 30) return { text: 'Allgemein', color: 'bg-elvora-warning/15 text-elvora-warning' };
  return { text: 'Generisch', color: 'bg-white/10 text-elvora-text-dim' };
}

export default function EmailFinderPage() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [emails, setEmails] = useState<EmailResult[]>([]);
  const [phones, setPhones] = useState<string[]>([]);
  const [decisionMaker, setDecisionMaker] = useState<string | null>(null);
  const [ustId, setUstId] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);

  const [stats, setStats] = useState<Stats | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResults, setBulkResults] = useState<EnrichResult[] | null>(null);
  const [bulkLimit, setBulkLimit] = useState('25');
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/scraper/enrich').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  async function scanUrl() {
    if (!url.trim()) return;
    setScanning(true);
    setScanned(false);
    setEmails([]);
    setPhones([]);
    setDecisionMaker(null);
    setUstId(null);
    try {
      const res = await fetch('/api/scraper/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      setEmails(data.emails || []);
      setPhones(data.phones || []);
      setDecisionMaker(data.decision_maker || null);
      setUstId(data.ust_id || null);
      setScanned(true);
    } catch { /* silent */ }
    finally { setScanning(false); }
  }

  async function runBulk() {
    setBulkRunning(true);
    setBulkResults(null);
    try {
      const res = await fetch('/api/scraper/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true, limit: parseInt(bulkLimit) || 25 }),
      });
      const data = await res.json();
      setBulkResults(data.results || []);
      fetch('/api/scraper/enrich').then(r => r.json()).then(setStats).catch(() => {});
    } catch { /* silent */ }
    finally { setBulkRunning(false); }
  }

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Email-Finder</h1>
        <p className="text-sm text-elvora-text-dim mt-0.5">Entscheider-Mails von Websites scrapen + Leads anreichern</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card rounded-xl p-4">
            <div className="text-xs text-elvora-text-dim">Leads gesamt</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total_leads}</div>
          </div>
          <div className="card rounded-xl p-4">
            <div className="text-xs text-elvora-text-dim">Mit E-Mail</div>
            <div className="text-2xl font-bold text-elvora-success mt-1">{stats.with_email}</div>
          </div>
          <div className="card rounded-xl p-4">
            <div className="text-xs text-elvora-text-dim">Ohne E-Mail</div>
            <div className="text-2xl font-bold text-red-400 mt-1">{stats.without_email}</div>
          </div>
          <div className="card rounded-xl p-4">
            <div className="text-xs text-elvora-text-dim">Anreicherbar</div>
            <div className="text-2xl font-bold text-elvora-purple-light mt-1">{stats.enrichable}</div>
            <div className="text-[10px] text-elvora-text-dim mt-0.5">haben Website</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* URL Scanner */}
        <div className="card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-elvora-text mb-3">Website scannen</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') scanUrl(); }}
              placeholder="domain.de oder https://..."
              className="flex-1 px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
            />
            <button
              onClick={scanUrl}
              disabled={scanning || !url.trim()}
              className="px-5 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-50"
            >
              {scanning ? 'Scannt...' : 'Scannen'}
            </button>
          </div>

          {scanning && (
            <div className="flex items-center gap-2 text-xs text-elvora-text-dim py-4">
              <div className="w-4 h-4 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
              Crawle Impressum, Kontakt, Team, About...
            </div>
          )}

          {scanned && (
            <div className="space-y-3">
              {decisionMaker && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-elvora-success/10 border border-elvora-success/20">
                  <svg className="w-4 h-4 text-elvora-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <div>
                    <div className="text-xs text-elvora-success font-medium">Entscheider gefunden</div>
                    <div className="text-sm text-white font-semibold">{decisionMaker}</div>
                  </div>
                </div>
              )}

              {emails.length > 0 ? (
                <div>
                  <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold mb-1.5">E-Mails ({emails.length})</div>
                  <div className="space-y-1">
                    {emails.map(e => {
                      const label = scoreLabel(e.score);
                      return (
                        <div key={e.email} className="flex items-center justify-between px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border group">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${label.color}`}>{label.text}</span>
                            <span className="text-sm text-white font-mono truncate">{e.email}</span>
                          </div>
                          <button onClick={() => copyEmail(e.email)} className="text-xs text-elvora-text-dim hover:text-white transition-colors flex-shrink-0 ml-2">
                            {copiedEmail === e.email ? '✓' : 'Kopieren'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-elvora-text-dim py-2">Keine E-Mails gefunden</div>
              )}

              {phones.length > 0 && (
                <div>
                  <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold mb-1.5">Telefon</div>
                  {phones.map(p => (
                    <div key={p} className="text-sm text-white font-mono px-3 py-1.5 rounded-lg bg-elvora-bg-alt border border-elvora-border">{p}</div>
                  ))}
                </div>
              )}

              {ustId && (
                <div className="text-xs text-elvora-text-dim">USt-IdNr.: <span className="text-white font-mono">{ustId}</span></div>
              )}
            </div>
          )}
        </div>

        {/* Bulk Enrichment */}
        <div className="card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-elvora-text mb-1">Bulk-Anreicherung</h2>
          <p className="text-xs text-elvora-text-dim mb-4">
            Alle Leads ohne E-Mail automatisch anreichern — crawlt deren Websites nach Impressum, Kontaktseite etc.
          </p>

          <div className="flex gap-2 mb-4">
            <select value={bulkLimit} onChange={e => setBulkLimit(e.target.value)} className="px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm">
              <option value="10">10 Leads</option>
              <option value="25">25 Leads</option>
              <option value="50">50 Leads</option>
              <option value="100">100 Leads</option>
            </select>
            <button
              onClick={runBulk}
              disabled={bulkRunning || !stats?.enrichable}
              className="flex-1 px-5 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-50"
            >
              {bulkRunning ? 'Läuft...' : `${stats?.enrichable || 0} Leads anreichern`}
            </button>
          </div>

          {bulkRunning && (
            <div className="flex items-center gap-2 text-xs text-elvora-text-dim py-4">
              <div className="w-4 h-4 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
              Websites werden gecrawlt... das kann etwas dauern
            </div>
          )}

          {bulkResults && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs text-elvora-success font-medium">
                  {bulkResults.filter(r => r.updated).length} von {bulkResults.length} angereichert
                </span>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {bulkResults.map(r => (
                  <div key={r.lead_id} className={`px-3 py-2 rounded-lg text-xs ${r.updated ? 'bg-elvora-success/10 border border-elvora-success/20' : r.error ? 'bg-red-500/5 border border-red-500/10' : 'bg-white/[0.02] border border-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{r.lead_name}</span>
                      {r.updated && r.best_email && (
                        <button onClick={() => copyEmail(r.best_email!)} className="text-elvora-text-dim hover:text-white transition-colors">
                          {copiedEmail === r.best_email ? '✓' : r.best_email}
                        </button>
                      )}
                    </div>
                    <div className="text-elvora-text-dim mt-0.5">
                      {r.error ? (
                        <span className="text-red-400">{r.error}</span>
                      ) : r.updated ? (
                        <span className="text-elvora-success">
                          {r.emails_found.length} Mails · {r.phones_found.length} Tel.
                          {r.decision_maker && ` · ${r.decision_maker}`}
                        </span>
                      ) : (
                        <span>{r.emails_found.length} Mails gefunden (Lead hat schon E-Mail)</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
