'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Trigger {
  id: number;
  lead_id: number;
  trigger_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  details: string | null;
  is_acted_on: number;
  is_dismissed: number;
  created_at: string;
  lead_name: string | null;
  lead_city: string | null;
  contact_status: string | null;
  priority: string | null;
  website_original: string | null;
}

interface Counts {
  total: number;
  active: number;
  critical: number;
  high: number;
}

interface LastScan {
  last_scan: string | null;
  leads_scanned: number;
}

const severityConfig: Record<string, { color: string; label: string; ring: string }> = {
  critical: { color: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Kritisch', ring: 'border-l-red-500' },
  high: { color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', label: 'Hoch', ring: 'border-l-orange-500' },
  medium: { color: 'bg-elvora-warning/15 text-elvora-warning border-elvora-warning/30', label: 'Mittel', ring: 'border-l-elvora-warning' },
  low: { color: 'bg-white/10 text-elvora-text-muted border-white/15', label: 'Niedrig', ring: 'border-l-white/20' },
};

const triggerTypeLabels: Record<string, string> = {
  website_down: 'Website offline',
  website_back_online: 'Wieder online',
  ssl_lost: 'SSL verloren',
  ssl_expiring: 'SSL läuft ab',
  no_ssl: 'Kein SSL',
  performance_degraded: 'Performance schlecht',
  score_dropped: 'Score gefallen',
  score_improved: 'Score verbessert',
  new_problems: 'Neue Probleme',
  negative_review: 'Negative Bewertung',
  competitor_redesign: 'Konkurrent-Redesign',
};

export default function MonitoringPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, active: 0, critical: 0, high: 0 });
  const [lastScan, setLastScan] = useState<LastScan>({ last_scan: null, leads_scanned: 0 });
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('');
  const [showActed, setShowActed] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.set('type', filterType);
      if (showActed) params.set('show_acted', '1');
      const res = await fetch(`/api/monitoring/triggers?${params}`);
      if (res.ok) {
        const d = await res.json();
        setTriggers(d.triggers || []);
        setCounts(d.counts || { total: 0, active: 0, critical: 0, high: 0 });
        setLastScan(d.lastScan || { last_scan: null, leads_scanned: 0 });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filterType, showActed]);

  useEffect(() => { load(); }, [load]);

  const runScan = async (limit = 50) => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/monitoring/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit }),
      });
      const d = await res.json();
      if (res.ok) {
        setScanResult(`${d.scanned} Websites geprüft, ${d.triggers} neue Trigger`);
        load();
      } else {
        setScanResult(`Fehler: ${d.error}`);
      }
    } catch (e) {
      setScanResult(`Fehler: ${e instanceof Error ? e.message : 'Netzwerk'}`);
    } finally {
      setScanning(false);
    }
  };

  const markActed = async (id: number) => {
    await fetch(`/api/monitoring/triggers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_acted_on: true }),
    });
    load();
  };

  const dismiss = async (id: number) => {
    await fetch(`/api/monitoring/triggers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_dismissed: true }),
    });
    load();
  };

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Website-Monitoring</h1>
          <p className="text-sm text-elvora-text-dim mt-1">
            Erkennt automatisch Website-Probleme und erzeugt Verkaufschancen
          </p>
        </div>
        <button
          onClick={() => runScan(50)}
          disabled={scanning}
          className="px-4 py-2 rounded-xl bg-elvora-gradient text-white text-sm font-semibold shadow-elvora hover:opacity-90 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {scanning ? 'Scanne...' : 'Jetzt scannen'}
        </button>
      </div>

      {scanResult && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-elvora-success/10 border border-elvora-success/20 text-sm text-elvora-success">
          {scanResult}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Aktive Trigger</div>
          <div className="text-2xl font-bold text-white mt-1">{counts.active}</div>
        </div>
        <div className="glass rounded-xl p-4 border border-red-500/20">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Kritisch</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{counts.critical}</div>
        </div>
        <div className="glass rounded-xl p-4 border border-orange-500/20">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Hoch</div>
          <div className="text-2xl font-bold text-orange-400 mt-1">{counts.high}</div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Letzte 7 Tage</div>
          <div className="text-2xl font-bold text-white mt-1">{lastScan.leads_scanned}</div>
          <div className="text-[10px] text-elvora-text-dim mt-0.5">Websites gescannt</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !filterType ? 'bg-elvora-purple/20 text-elvora-purple-light border border-elvora-purple/30' : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 border border-transparent'
          }`}
        >
          Alle
        </button>
        {Object.entries(triggerTypeLabels).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilterType(filterType === key ? '' : key)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
              filterType === key ? 'bg-elvora-purple/20 text-elvora-purple-light' : 'bg-white/5 text-elvora-text-dim hover:bg-white/10'
            }`}
          >
            {label}
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 mx-1" />
        <label className="flex items-center gap-1.5 text-xs text-elvora-text-dim cursor-pointer">
          <input
            type="checkbox"
            checked={showActed}
            onChange={e => setShowActed(e.target.checked)}
            className="rounded border-white/20 bg-white/5"
          />
          Erledigte zeigen
        </label>
      </div>

      {/* Trigger Feed */}
      {loading ? (
        <div className="text-center py-12 text-elvora-text-dim text-sm">Laden...</div>
      ) : triggers.length === 0 ? (
        <div className="glass rounded-2xl p-12 border border-white/5 text-center">
          <svg className="w-12 h-12 mx-auto text-elvora-text-dim mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="text-sm text-elvora-text-dim mb-3">Alles ruhig - keine aktiven Trigger</div>
          <button
            onClick={() => runScan(50)}
            disabled={scanning}
            className="text-elvora-purple-light text-sm hover:underline"
          >
            Ersten Scan starten
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers.map(t => {
            const sev = severityConfig[t.severity] || severityConfig.medium;
            const typeLabel = triggerTypeLabels[t.trigger_type] || t.trigger_type;
            const time = new Date(t.created_at + 'Z');
            return (
              <div
                key={t.id}
                className={`glass rounded-xl p-4 border-l-4 ${sev.ring} ${t.is_acted_on || t.is_dismissed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${sev.color}`}>
                        {sev.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">
                        {typeLabel}
                      </span>
                      <span className="text-[10px] text-elvora-text-dim">
                        {time.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-white font-medium mt-1.5">{t.title}</div>
                    {t.lead_name && (
                      <Link href={`/crm/${t.lead_id}`} className="text-xs text-elvora-purple-light hover:underline inline-flex items-center gap-1 mt-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {t.lead_name} {t.lead_city && <span className="text-elvora-text-dim">· {t.lead_city}</span>}
                      </Link>
                    )}
                  </div>
                  {!t.is_acted_on && !t.is_dismissed && (
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/crm/${t.lead_id}`}
                        className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple-light transition-colors whitespace-nowrap"
                      >
                        Kontaktieren
                      </Link>
                      <button
                        onClick={() => markActed(t.id)}
                        className="px-2 py-1.5 rounded-lg text-xs text-elvora-text-dim hover:text-elvora-success hover:bg-elvora-success/10 transition-colors"
                        title="Als erledigt markieren"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => dismiss(t.id)}
                        className="px-2 py-1.5 rounded-lg text-xs text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Verwerfen"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
