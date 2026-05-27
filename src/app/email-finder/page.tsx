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
        body: JSON.stringify({ bulk: true, limit: 0 }),
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
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Leads gesamt', value: stats.total_leads, color: 'text-white', iconColor: 'text-elvora-purple-light', iconBg: 'bg-elvora-primary/10', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
              { label: 'Mit E-Mail', value: stats.with_email, color: 'text-elvora-success', iconColor: 'text-elvora-success', iconBg: 'bg-elvora-success/10', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
              { label: 'Ohne E-Mail', value: stats.without_email, color: 'text-red-400', iconColor: 'text-red-400', iconBg: 'bg-red-500/10', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636' },
              { label: 'Anreicherbar', value: stats.enrichable, color: 'text-elvora-purple-light', iconColor: 'text-elvora-purple-light', iconBg: 'bg-elvora-primary/10', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
            ].map((s, i) => (
              <div key={i} className="card rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <svg className={`w-[18px] h-[18px] ${s.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                    </svg>
                  </div>
                  <div>
                    <div className={`text-2xl font-semibold ${s.color} stat-number`}>{s.value}</div>
                    <div className="text-[10px] text-elvora-text-dim">{s.label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {stats.total_leads > 0 && (
            <div className="card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-elvora-text-dim">E-Mail-Abdeckung</span>
                <span className="text-xs font-semibold text-elvora-success">{Math.round((stats.with_email / stats.total_leads) * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-elvora-bg-alt rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-elvora-primary to-elvora-success rounded-full transition-all" style={{ width: `${(stats.with_email / stats.total_leads) * 100}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-elvora-text-dim">
                <span>{stats.with_email} mit E-Mail</span>
                <span>{stats.enrichable} anreicherbar</span>
              </div>
            </div>
          )}
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
            <button
              onClick={runBulk}
              disabled={bulkRunning || !stats?.enrichable}
              className="flex-1 px-5 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-50"
            >
              {bulkRunning ? 'Läuft...' : `Alle ${stats?.enrichable?.toLocaleString('de-DE') || 0} Leads anreichern`}
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
