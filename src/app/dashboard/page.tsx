'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Stats {
  leads: { total: number; pending: number; qualified: number; todayNew: number; weekQualified: number };
  contact: { not_contacted: number; email_sent: number; called: number; meeting: number; proposal: number; won: number; lost: number };
  email: { totalSent: number; opened: number; openRate: number };
  pipeline: { activeValue: number; wonValue: number; activeDeals: number };
  audits: { total_audits: number; total_views: number; total_cta_clicks: number };
  hotLeads: Array<{ id: number; name: string; city: string; score: number; phone: string; email: string; contact_status: string; audit_views: number; cta_clicks: number; audit_slug: string }>;
  recentScans: Array<{ keyword: string; city: string; leads_found: number; leads_new: number; status: string; time: string }>;
  pendingFollowUps: number;
}

interface AutopilotStatus {
  enabled: boolean;
  lastRun: { timestamp: string; qualified: number; emailsSent: number; followUpsSent: number; hotLeadsDetected: number } | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [autopilot, setAutopilot] = useState<AutopilotStatus | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [runningAutopilot, setRunningAutopilot] = useState(false);
  const [autopilotResult, setAutopilotResult] = useState<string | null>(null);
  const [togglingAutopilot, setTogglingAutopilot] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, apRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/autopilot'),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (apRes.ok) setAutopilot(await apRes.json());
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const triggerScan = async () => {
    setScanning(true); setScanResult(null);
    try {
      const res = await fetch('/api/cron/scan', { method: 'POST' });
      const data = await res.json();
      setScanResult(res.ok ? `${data.totalScans} Scans abgeschlossen` : 'Fehler');
    } catch { setScanResult('Netzwerkfehler'); }
    finally { setScanning(false); loadData(); setTimeout(() => setScanResult(null), 4000); }
  };

  const runAutopilot = async () => {
    setRunningAutopilot(true); setAutopilotResult(null);
    try {
      const res = await fetch('/api/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = await res.json();
      if (res.ok) {
        const parts = [];
        if (data.qualified > 0) parts.push(`${data.qualified} qualifiziert`);
        if (data.emailsSent > 0) parts.push(`${data.emailsSent} Mails`);
        if (data.followUpsSent > 0) parts.push(`${data.followUpsSent} Follow-Ups`);
        if (data.hotLeadsDetected > 0) parts.push(`${data.hotLeadsDetected} Hot Leads`);
        setAutopilotResult(parts.length > 0 ? parts.join(', ') : 'Keine Aktionen nötig');
      } else {
        setAutopilotResult('Fehler');
      }
    } catch { setAutopilotResult('Netzwerkfehler'); }
    finally { setRunningAutopilot(false); loadData(); setTimeout(() => setAutopilotResult(null), 5000); }
  };

  const toggleAutopilot = async () => {
    setTogglingAutopilot(true);
    try {
      const newState = !autopilot?.enabled;
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autopilot_enabled: newState ? 'true' : 'false' }),
      });
      setAutopilot(prev => prev ? { ...prev, enabled: newState } : null);
    } catch { /* silent */ }
    finally { setTogglingAutopilot(false); }
  };

  const fmt = (n: number) => n.toLocaleString('de-DE');
  const fmtEur = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Autopilot Banner */}
      <div className={`rounded-xl p-4 mb-5 border transition-all ${
        autopilot?.enabled
          ? 'bg-elvora-success/5 border-elvora-success/20'
          : 'bg-white/[0.02] border-white/5'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              autopilot?.enabled ? 'bg-elvora-success/20' : 'bg-white/5'
            }`}>
              <svg className={`w-5 h-5 ${autopilot?.enabled ? 'text-elvora-success' : 'text-elvora-text-dim'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                Autopilot
                {autopilot?.enabled && <span className="px-1.5 py-0.5 rounded-full bg-elvora-success/15 text-elvora-success text-[10px] font-bold border border-elvora-success/20">AKTIV</span>}
              </div>
              <div className="text-xs text-elvora-text-dim">
                {autopilot?.enabled
                  ? 'Qualify → Email → Follow-Up läuft automatisch'
                  : 'Automatische Pipeline deaktiviert'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runAutopilot}
              disabled={runningAutopilot}
              className="hidden sm:block px-3 py-1.5 rounded-lg bg-elvora-gradient text-white text-xs font-semibold hover:shadow-elvora-lg transition-all disabled:opacity-50"
            >
              {runningAutopilot ? 'Läuft...' : autopilotResult || 'Jetzt ausführen'}
            </button>
            <button
              onClick={toggleAutopilot}
              disabled={togglingAutopilot}
              className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                autopilot?.enabled ? 'bg-elvora-success' : 'bg-white/10'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                autopilot?.enabled ? 'left-[22px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        </div>
        {autopilot?.lastRun && (
          <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-3 text-[11px] text-elvora-text-dim">
            <span>Letzter Lauf: {new Date(autopilot.lastRun.timestamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
            {autopilot.lastRun.qualified > 0 && <span className="text-elvora-success">{autopilot.lastRun.qualified} qualifiziert</span>}
            {autopilot.lastRun.emailsSent > 0 && <span className="text-elvora-pink">{autopilot.lastRun.emailsSent} Mails</span>}
            {autopilot.lastRun.followUpsSent > 0 && <span className="text-elvora-warning">{autopilot.lastRun.followUpsSent} Follow-Ups</span>}
          </div>
        )}
        {/* Mobile run button */}
        <button
          onClick={runAutopilot}
          disabled={runningAutopilot}
          className="sm:hidden mt-3 w-full px-3 py-2 rounded-lg bg-elvora-gradient text-white text-xs font-semibold transition-all disabled:opacity-50"
        >
          {runningAutopilot ? 'Läuft...' : autopilotResult || 'Jetzt ausführen'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Zu prüfen</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-warning">{stats ? fmt(stats.leads.pending) : '–'}</div>
          <div className="text-[11px] text-elvora-text-dim mt-1">{stats ? `+${stats.leads.todayNew} heute` : '...'}</div>
        </div>
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Qualifiziert</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-success">{stats ? fmt(stats.leads.qualified) : '–'}</div>
          <div className="text-[11px] text-elvora-text-dim mt-1">{stats ? `+${stats.leads.weekQualified} diese Woche` : '...'}</div>
        </div>
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Mails geöffnet</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-pink">{stats ? `${stats.email.openRate}%` : '–'}</div>
          <div className="text-[11px] text-elvora-text-dim mt-1">{stats ? `${stats.email.opened} von ${stats.email.totalSent}` : '...'}</div>
        </div>
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Pipeline</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-accent">{stats ? fmtEur(stats.pipeline.activeValue) : '–'}</div>
          <div className="text-[11px] text-elvora-text-dim mt-1">{stats ? `${stats.pipeline.activeDeals} aktive Deals` : '...'}</div>
        </div>
      </div>

      {/* Sales Funnel */}
      {stats && (
        <div className="glass rounded-xl p-4 mb-5">
          <div className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">Sales Funnel</div>
          <div className="flex items-center gap-1 text-center">
            {[
              { label: 'Nicht kontaktiert', value: stats.contact.not_contacted, color: 'bg-white/10' },
              { label: 'Mail gesendet', value: stats.contact.email_sent, color: 'bg-elvora-purple/30' },
              { label: 'Im Gespräch', value: stats.contact.called + stats.contact.meeting, color: 'bg-elvora-warning/30' },
              { label: 'Angebot', value: stats.contact.proposal, color: 'bg-elvora-pink/30' },
              { label: 'Gewonnen', value: stats.contact.won, color: 'bg-elvora-success/30' },
            ].map((step, i) => (
              <div key={i} className="flex-1 min-w-0">
                <div className={`${step.color} rounded-lg py-2 px-1`}>
                  <div className="text-lg font-bold text-white">{step.value}</div>
                </div>
                <div className="text-[10px] text-elvora-text-dim mt-1 truncate">{step.label}</div>
              </div>
            ))}
          </div>
          {stats.pipeline.wonValue > 0 && (
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
              <span className="text-elvora-text-dim">Gewonnener Umsatz</span>
              <span className="text-elvora-success font-bold">{fmt(stats.pipeline.wonValue)} EUR</span>
            </div>
          )}
        </div>
      )}

      {/* Hot Leads */}
      {stats && stats.hotLeads.length > 0 && (
        <div className="glass rounded-xl p-4 mb-5 border border-red-500/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🔥</span>
            <span className="text-sm font-semibold text-white">Hot Leads</span>
            <span className="text-[10px] text-red-400 font-semibold">Haben deinen Audit angesehen!</span>
          </div>
          <div className="space-y-2">
            {stats.hotLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{lead.name}</div>
                  <div className="text-xs text-elvora-text-dim flex items-center gap-2 mt-0.5">
                    <span>{lead.city}</span>
                    <span>Score: {lead.score}</span>
                    {lead.audit_views > 0 && <span className="text-elvora-warning">{lead.audit_views}x angesehen</span>}
                    {lead.cta_clicks > 0 && <span className="text-red-400 font-semibold">{lead.cta_clicks}x CTA geklickt</span>}
                  </div>
                </div>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="ml-2 px-3 py-1.5 rounded-lg bg-elvora-success/15 border border-elvora-success/20 text-elvora-success text-xs font-semibold hover:bg-elvora-success/25 transition-all flex-shrink-0">
                    Anrufen
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <Link href="/review" className="glass rounded-xl p-4 hover:bg-white/[0.04] transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elvora-gradient flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{stats ? `${stats.leads.pending} Leads prüfen` : 'Leads prüfen'}</div>
              <div className="text-xs text-elvora-text-dim">Manuell qualifizieren</div>
            </div>
          </div>
        </Link>

        <button onClick={triggerScan} disabled={scanning} className="glass rounded-xl p-4 hover:bg-white/[0.04] transition-all text-left disabled:opacity-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elvora-purple/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{scanning ? 'Scanne...' : scanResult || 'Jetzt scannen'}</div>
              <div className="text-xs text-elvora-text-dim">Neue Leads finden</div>
            </div>
          </div>
        </button>

        <Link href="/gmb-audit" className="glass rounded-xl p-4 hover:bg-white/[0.04] transition-all group">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elvora-pink/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-elvora-pink-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">GMB Audit</div>
              <div className="text-xs text-elvora-text-dim">Google Profil analysieren</div>
            </div>
          </div>
        </Link>
      </div>

      {/* Audit Stats */}
      {stats && stats.audits.total_audits > 0 && (
        <div className="glass rounded-xl p-4 mb-5">
          <div className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">Audit Performance</div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-elvora-purple-light">{stats.audits.total_audits}</div>
              <div className="text-[10px] text-elvora-text-dim">Audits erstellt</div>
            </div>
            <div>
              <div className="text-lg font-bold text-elvora-warning">{stats.audits.total_views}</div>
              <div className="text-[10px] text-elvora-text-dim">Aufrufe</div>
            </div>
            <div>
              <div className="text-lg font-bold text-elvora-success">{stats.audits.total_cta_clicks}</div>
              <div className="text-[10px] text-elvora-text-dim">CTA Klicks</div>
            </div>
          </div>
        </div>
      )}

      {/* Pending Follow-Ups */}
      {stats && stats.pendingFollowUps > 0 && (
        <div className="glass rounded-xl p-4 mb-5 border border-elvora-warning/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-elvora-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-white">{stats.pendingFollowUps} Follow-Ups fällig</span>
            </div>
            <span className="text-xs text-elvora-text-dim">Beim nächsten Autopilot-Lauf</span>
          </div>
        </div>
      )}

      {/* Recent Scans */}
      {stats && stats.recentScans.length > 0 && (
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white mb-3">Letzte Scans</h2>
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-elvora-text-dim pb-2">Keyword</th>
                  <th className="text-left text-xs text-elvora-text-dim pb-2">Stadt</th>
                  <th className="text-left text-xs text-elvora-text-dim pb-2">Gefunden</th>
                  <th className="text-left text-xs text-elvora-text-dim pb-2">Neu</th>
                  <th className="text-left text-xs text-elvora-text-dim pb-2">Zeit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.recentScans.map((scan, i) => (
                  <tr key={i}>
                    <td className="py-2.5 text-sm"><span className="tag">{scan.keyword}</span></td>
                    <td className="py-2.5 text-sm text-elvora-text-muted">{scan.city}</td>
                    <td className="py-2.5 text-sm text-white font-medium">{scan.leads_found || 0}</td>
                    <td className="py-2.5 text-sm text-elvora-success font-medium">+{scan.leads_new || 0}</td>
                    <td className="py-2.5 text-xs text-elvora-text-dim font-mono">{scan.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
