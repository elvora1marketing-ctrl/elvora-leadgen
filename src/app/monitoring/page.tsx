'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

const severityConfig: Record<string, { color: string; label: string; ring: string; bg: string }> = {
  critical: { color: 'bg-red-500/15 text-red-400 border-red-500/30', label: 'Kritisch', ring: 'border-l-red-500', bg: 'bg-red-500/5' },
  high: { color: 'bg-orange-500/15 text-orange-400 border-orange-500/30', label: 'Hoch', ring: 'border-l-orange-500', bg: 'bg-orange-500/5' },
  medium: { color: 'bg-elvora-warning/15 text-elvora-warning border-elvora-warning/30', label: 'Mittel', ring: 'border-l-elvora-warning', bg: '' },
  low: { color: 'bg-white/10 text-elvora-text-muted border-white/15', label: 'Niedrig', ring: 'border-l-white/20', bg: '' },
};

const triggerTypeLabels: Record<string, string> = {
  website_down: 'Website offline',
  website_back_online: 'Wieder online',
  ssl_lost: 'SSL verloren',
  ssl_expiring: 'SSL ab',
  no_ssl: 'Kein SSL',
  performance_degraded: 'Performance',
  score_dropped: 'Score gefallen',
  score_improved: 'Score besser',
  new_problems: 'Neue Probleme',
  negative_review: 'Neg. Bewertung',
  competitor_redesign: 'Konkurrent',
};

const contactLabels: Record<string, { label: string; color: string }> = {
  not_contacted: { label: 'Offen', color: 'text-elvora-text-dim' },
  email_sent: { label: 'Mail', color: 'text-elvora-purple-light' },
  called: { label: 'Angerufen', color: 'text-elvora-warning' },
  meeting: { label: 'Meeting', color: 'text-elvora-accent' },
  proposal: { label: 'Angebot', color: 'text-elvora-pink' },
  won: { label: 'Gewonnen', color: 'text-elvora-success' },
  lost: { label: 'Verloren', color: 'text-red-400' },
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval>>();

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

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(load, 30000);
    } else {
      clearInterval(autoRefreshRef.current);
    }
    return () => clearInterval(autoRefreshRef.current);
  }, [autoRefresh, load]);

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
      setTimeout(() => setScanResult(null), 6000);
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

  const lastScanTime = lastScan.last_scan
    ? new Date(lastScan.last_scan + 'Z').toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  const uniqueTypes = [...new Set(triggers.map(t => t.trigger_type))];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Website-Monitoring</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">
            Erkennt automatisch Website-Probleme und erzeugt Verkaufschancen
            {lastScanTime && <span className="ml-2 text-elvora-text-dim/60">Letzter Scan: {lastScanTime}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[11px] text-elvora-text-dim cursor-pointer mr-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded border-white/20 bg-white/5 w-3.5 h-3.5"
            />
            Auto-Refresh
          </label>
          <div className="flex items-center rounded-lg overflow-hidden border border-elvora-border">
            <button
              onClick={() => runScan(25)}
              disabled={scanning}
              className="px-3 py-2 bg-elvora-bg-alt text-elvora-text-muted text-xs hover:bg-white/10 transition-colors disabled:opacity-50 border-r border-elvora-border"
            >
              25
            </button>
            <button
              onClick={() => runScan(50)}
              disabled={scanning}
              className="px-3 py-2 bg-elvora-bg-alt text-elvora-text-muted text-xs hover:bg-white/10 transition-colors disabled:opacity-50 border-r border-elvora-border"
            >
              50
            </button>
            <button
              onClick={() => runScan(100)}
              disabled={scanning}
              className="px-3 py-2 bg-elvora-bg-alt text-elvora-text-muted text-xs hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              100
            </button>
          </div>
          <button
            onClick={() => runScan(50)}
            disabled={scanning}
            className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {scanning ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {scanning ? 'Scanne...' : 'Scannen'}
          </button>
        </div>
      </div>

      {/* Scan Result */}
      {scanResult && (
        <div className={`px-4 py-2.5 rounded-xl text-sm flex items-center gap-2 ${
          scanResult.startsWith('Fehler')
            ? 'bg-red-500/10 border border-red-500/20 text-red-400'
            : 'bg-elvora-success/10 border border-elvora-success/20 text-elvora-success'
        }`}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={scanResult.startsWith('Fehler') ? 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'} />
          </svg>
          {scanResult}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Aktive Trigger', value: counts.active, color: 'text-white', border: '', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
          { label: 'Kritisch', value: counts.critical, color: 'text-red-400', border: 'border-red-500/20', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
          { label: 'Hoch', value: counts.high, color: 'text-orange-400', border: 'border-orange-500/20', icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Gescannt', value: lastScan.leads_scanned, color: 'text-elvora-purple-light', border: '', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9' },
        ].map((stat, i) => (
          <div key={i} className={`card rounded-xl p-4 ${stat.border ? `border ${stat.border}` : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg className={`w-[18px] h-[18px] ${stat.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={stat.icon} />
                </svg>
              </div>
              <div>
                <div className={`text-2xl font-semibold ${stat.color} stat-number`}>{stat.value}</div>
                <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">{stat.label}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            !filterType ? 'bg-elvora-primary/20 text-elvora-purple-light border border-elvora-primary/30' : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 border border-transparent'
          }`}
        >
          Alle ({counts.active})
        </button>
        {uniqueTypes.map(type => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? '' : type)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              filterType === type ? 'bg-elvora-primary/20 text-elvora-purple-light border border-elvora-primary/30' : 'bg-white/5 text-elvora-text-dim hover:bg-white/10 border border-transparent'
            }`}
          >
            {triggerTypeLabels[type] || type}
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 mx-1" />
        <label className="flex items-center gap-1.5 text-xs text-elvora-text-dim cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showActed}
            onChange={e => setShowActed(e.target.checked)}
            className="rounded border-white/20 bg-white/5 w-3.5 h-3.5"
          />
          Erledigte zeigen
        </label>
      </div>

      {/* Trigger Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-elvora-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : triggers.length === 0 ? (
        <div className="card rounded-xl p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-elvora-text-dim/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="text-sm text-elvora-text-muted font-medium mb-1">Alles ruhig</div>
          <div className="text-xs text-elvora-text-dim mb-4">Keine aktiven Trigger gefunden</div>
          <button
            onClick={() => runScan(50)}
            disabled={scanning}
            className="px-4 py-2 rounded-lg bg-elvora-primary/15 text-elvora-purple-light text-xs font-medium border border-elvora-primary/20 hover:bg-elvora-primary/25 transition-all disabled:opacity-50"
          >
            Scan starten
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {triggers.map(t => {
            const sev = severityConfig[t.severity] || severityConfig.medium;
            const typeLabel = triggerTypeLabels[t.trigger_type] || t.trigger_type;
            const time = new Date(t.created_at + 'Z');
            const isExpanded = expandedId === t.id;
            const cs = t.contact_status ? contactLabels[t.contact_status] : null;
            return (
              <div
                key={t.id}
                className={`card rounded-xl border-l-[3px] ${sev.ring} ${t.is_acted_on || t.is_dismissed ? 'opacity-40' : ''} ${sev.bg} overflow-hidden`}
              >
                <div
                  className="flex items-start justify-between gap-3 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : t.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${sev.color}`}>
                        {sev.label}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">
                        {typeLabel}
                      </span>
                      {cs && (
                        <span className={`text-[10px] ${cs.color}`}>{cs.label}</span>
                      )}
                      <span className="text-[10px] text-elvora-text-dim ml-auto">
                        {time.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-sm text-white font-medium mt-1.5">{t.title}</div>
                    {t.lead_name && (
                      <Link
                        href={`/crm/${t.lead_id}`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-elvora-purple-light hover:underline inline-flex items-center gap-1 mt-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {t.lead_name} {t.lead_city && <span className="text-elvora-text-dim">· {t.lead_city}</span>}
                      </Link>
                    )}
                  </div>
                  {!t.is_acted_on && !t.is_dismissed && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <Link
                        href={`/crm/${t.lead_id}`}
                        onClick={e => e.stopPropagation()}
                        className="px-3 py-1.5 rounded-lg bg-elvora-primary text-white text-xs font-medium hover:bg-elvora-primary-dark transition-colors whitespace-nowrap"
                      >
                        Kontaktieren
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); markActed(t.id); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-elvora-text-dim hover:text-elvora-success hover:bg-elvora-success/10 transition-colors"
                        title="Erledigt"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Verwerfen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-elvora-border/30 space-y-3">
                    {t.details && (
                      <div className="bg-elvora-bg-alt rounded-lg p-3 mt-3">
                        <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold mb-1">Details</div>
                        <div className="text-xs text-elvora-text-muted whitespace-pre-wrap">{t.details}</div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                      {t.website_original && (
                        <div>
                          <span className="text-elvora-text-dim block mb-0.5">Website</span>
                          <a href={t.website_original} target="_blank" rel="noopener noreferrer" className="text-elvora-purple-light hover:underline truncate block">
                            {t.website_original.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                          </a>
                        </div>
                      )}
                      {t.lead_city && (
                        <div>
                          <span className="text-elvora-text-dim block mb-0.5">Stadt</span>
                          <span className="text-white">{t.lead_city}</span>
                        </div>
                      )}
                      {t.contact_status && cs && (
                        <div>
                          <span className="text-elvora-text-dim block mb-0.5">Status</span>
                          <span className={cs.color}>{cs.label}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-elvora-text-dim block mb-0.5">Erstellt</span>
                        <span className="text-white">{time.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
