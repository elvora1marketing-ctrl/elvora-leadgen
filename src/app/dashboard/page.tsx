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
  followUps: {
    dueNow: number;
    pending: number;
    sent: number;
    cancelled: number;
    sentThisWeek: number;
    next: Array<{ step: number; scheduled_at: string; name: string; city: string }>;
  };
  inbox: {
    total: number;
    unread: number;
    thisWeek: number;
    recent: Array<{
      id: number;
      from_name: string;
      from_email: string;
      subject: string;
      body_text: string;
      is_read: number;
      created_at: string;
      lead_name: string | null;
      lead_city: string | null;
    }>;
  };
  pendingFollowUps: number;
  engagement: {
    distribution: { hot: number; warm: number; cool: number; cold: number };
    topLeads: Array<{
      id: number; name: string; city: string; email: string; phone: string;
      engagement_score: number; engagement_signals: Record<string, boolean>; contact_status: string;
    }>;
  };
}

interface TaskItem {
  id: number;
  lead_id: number | null;
  title: string;
  type: string;
  due_date: string | null;
  is_completed: number;
  lead_name: string | null;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [taskCounts, setTaskCounts] = useState({ overdue: 0, due_today: 0, open: 0 });

  useEffect(() => {
    fetch('/api/tasks?completed=0&limit=10')
      .then(r => r.json())
      .then(d => {
        setTasks(d.tasks || []);
        if (d.counts) setTaskCounts(d.counts);
      })
      .catch(() => {});
  }, []);

  const toggleTask = async (id: number) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: true }),
    });
    const r = await fetch('/api/tasks?completed=0&limit=10');
    if (r.ok) {
      const d = await r.json();
      setTasks(d.tasks || []);
      if (d.counts) setTaskCounts(d.counts);
    }
  };

  const loadData = useCallback(async () => {
    try {
      const statsRes = await fetch('/api/stats');
      if (statsRes.ok) setStats(await statsRes.json());
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

  const fmt = (n: number) => n.toLocaleString('de-DE');
  const fmtEur = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

  const today = new Date();
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7;

  const calendarDays = [];
  const prevMonthDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  for (let i = firstDay - 1; i >= 0; i--) calendarDays.push({ day: prevMonthDays - i, current: false });
  for (let i = 1; i <= daysInMonth; i++) calendarDays.push({ day: i, current: true });
  const remaining = 42 - calendarDays.length;
  for (let i = 1; i <= remaining; i++) calendarDays.push({ day: i, current: false });

  const funnelSteps = stats ? [
    { label: 'Offen', value: stats.contact.not_contacted, pct: 100 },
    { label: 'Kontaktiert', value: stats.contact.email_sent, pct: stats.contact.not_contacted > 0 ? Math.round((stats.contact.email_sent / stats.contact.not_contacted) * 100) : 0 },
    { label: 'Im Gespräch', value: stats.contact.called + stats.contact.meeting, pct: stats.contact.not_contacted > 0 ? Math.round(((stats.contact.called + stats.contact.meeting) / stats.contact.not_contacted) * 100) : 0 },
    { label: 'Angebot', value: stats.contact.proposal, pct: stats.contact.not_contacted > 0 ? Math.round((stats.contact.proposal / stats.contact.not_contacted) * 100) : 0 },
    { label: 'Gewonnen', value: stats.contact.won, pct: stats.contact.not_contacted > 0 ? Math.round((stats.contact.won / stats.contact.not_contacted) * 100) : 0 },
  ] : [];

  const engDist = stats?.engagement.distribution;
  const engTotal = engDist ? engDist.hot + engDist.warm + engDist.cool + engDist.cold : 0;

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Willkommen zurück</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={triggerScan}
            disabled={scanning}
            className="px-4 py-2 rounded-xl bg-elvora-gradient text-white text-sm font-semibold shadow-elvora hover:shadow-elvora-lg transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {scanning ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            {scanning ? 'Scannt...' : scanResult || 'Neuer Scan'}
          </button>
        </div>
      </div>

      {/* Main Grid: Content + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        {/* LEFT COLUMN */}
        <div className="space-y-5">

          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {/* Zu prüfen */}
            <div className="card-premium rounded-2xl p-4 card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-elvora-warning/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-elvora-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-[10px] text-elvora-text-dim">Zu prüfen</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-white stat-number">{stats ? fmt(stats.leads.pending) : '–'}</div>
              <div className="flex items-center gap-1 mt-1.5">
                <svg className="w-3 h-3 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-[11px] text-elvora-success font-medium">{stats ? `+${stats.leads.todayNew} heute` : '...'}</span>
              </div>
            </div>

            {/* Qualifiziert */}
            <div className="card-premium rounded-2xl p-4 card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-elvora-success/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-[10px] text-elvora-text-dim">Qualifiziert</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-white stat-number">{stats ? fmt(stats.leads.qualified) : '–'}</div>
              <div className="flex items-center gap-1 mt-1.5">
                <svg className="w-3 h-3 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                <span className="text-[11px] text-elvora-success font-medium">{stats ? `+${stats.leads.weekQualified} Woche` : '...'}</span>
              </div>
            </div>

            {/* Email Öffnungsrate */}
            <div className="card-premium rounded-2xl p-4 card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-elvora-pink/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-elvora-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className="text-[10px] text-elvora-text-dim">Öffnungsrate</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-white stat-number">{stats ? `${stats.email.openRate}%` : '–'}</div>
              <div className="text-[11px] text-elvora-text-dim mt-1.5">{stats ? `${stats.email.opened} / ${stats.email.totalSent} Mails` : '...'}</div>
            </div>

            {/* Pipeline */}
            <div className="card-premium rounded-2xl p-4 card-hover">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-elvora-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-[10px] text-elvora-text-dim">Pipeline</span>
              </div>
              <div className="text-2xl lg:text-3xl font-bold text-white stat-number">{stats ? `${fmtEur(stats.pipeline.activeValue)}€` : '–'}</div>
              <div className="text-[11px] text-elvora-text-dim mt-1.5">{stats ? `${stats.pipeline.activeDeals} aktive Deals` : '...'}</div>
            </div>
          </div>

          {/* Sales Funnel - Visual Bar Chart */}
          {stats && (
            <div className="card-premium rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-white">Sales Funnel</h2>
                  <p className="text-[11px] text-elvora-text-dim mt-0.5">Conversion pro Stufe</p>
                </div>
                {stats.pipeline.wonValue > 0 && (
                  <div className="text-right">
                    <div className="text-lg font-bold text-elvora-success stat-number">{fmt(stats.pipeline.wonValue)}€</div>
                    <div className="text-[10px] text-elvora-text-dim">Gewonnen</div>
                  </div>
                )}
              </div>

              {/* Funnel Bars */}
              <div className="space-y-2.5">
                {funnelSteps.map((step, i) => {
                  const colors = ['bg-white/20', 'bg-elvora-purple/60', 'bg-elvora-warning/60', 'bg-elvora-pink/60', 'bg-elvora-success/60'];
                  const width = i === 0 ? 100 : Math.max(8, step.pct);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-24 text-right">
                        <span className="text-xs text-elvora-text-muted">{step.label}</span>
                      </div>
                      <div className="flex-1 h-8 bg-white/[0.03] rounded-lg overflow-hidden relative">
                        <div
                          className={`h-full ${colors[i]} rounded-lg transition-all duration-700 flex items-center px-3`}
                          style={{ width: `${width}%` }}
                        >
                          <span className="text-xs font-bold text-white">{step.value}</span>
                        </div>
                      </div>
                      {i > 0 && <span className="text-[10px] text-elvora-text-dim w-10 text-right">{step.pct}%</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Engagement Distribution + Audit Stats Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Engagement Donut */}
            {engDist && engTotal > 0 && (
              <div className="card-premium rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">Engagement</h2>
                  <Link href="/akquise?sort=engagement" className="text-[11px] text-elvora-purple-light hover:text-elvora-purple transition-colors">Details →</Link>
                </div>
                <div className="flex items-center gap-6">
                  {/* CSS Donut Chart */}
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                      {(() => {
                        const segments = [
                          { pct: engDist.hot / engTotal * 100, color: '#ef4444' },
                          { pct: engDist.warm / engTotal * 100, color: '#F97316' },
                          { pct: engDist.cool / engTotal * 100, color: '#8B5CF6' },
                          { pct: engDist.cold / engTotal * 100, color: 'rgba(255,255,255,0.1)' },
                        ];
                        let offset = 0;
                        return segments.map((seg, i) => {
                          const el = (
                            <circle
                              key={i}
                              r="15.9155"
                              cx="18"
                              cy="18"
                              fill="transparent"
                              stroke={seg.color}
                              strokeWidth="3.5"
                              strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                              strokeDashoffset={`${-offset}`}
                              className="transition-all duration-700"
                            />
                          );
                          offset += seg.pct;
                          return el;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-white stat-number">{engTotal}</span>
                      <span className="text-[9px] text-elvora-text-dim">Leads</span>
                    </div>
                  </div>
                  {/* Legend */}
                  <div className="space-y-2.5 flex-1">
                    {[
                      { label: 'Hot', count: engDist.hot, color: 'bg-red-500' },
                      { label: 'Warm', count: engDist.warm, color: 'bg-elvora-warning' },
                      { label: 'Cool', count: engDist.cool, color: 'bg-elvora-purple' },
                      { label: 'Kalt', count: engDist.cold, color: 'bg-white/20' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                          <span className="text-xs text-elvora-text-muted">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-white">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Audit Performance */}
            {stats && stats.audits.total_audits > 0 && (
              <div className="card-premium rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-white">Audit Performance</h2>
                  <Link href="/gmb-audit" className="text-[11px] text-elvora-purple-light hover:text-elvora-purple transition-colors">Mehr →</Link>
                </div>
                {/* Vertical Bar Chart */}
                <div className="flex items-end justify-around h-28 gap-4 mb-3">
                  {[
                    { value: stats.audits.total_audits, label: 'Erstellt', color: 'bg-elvora-purple/50', max: Math.max(stats.audits.total_audits, stats.audits.total_views, stats.audits.total_cta_clicks) || 1 },
                    { value: stats.audits.total_views, label: 'Aufrufe', color: 'bg-elvora-warning/50', max: Math.max(stats.audits.total_audits, stats.audits.total_views, stats.audits.total_cta_clicks) || 1 },
                    { value: stats.audits.total_cta_clicks, label: 'CTA Klicks', color: 'bg-elvora-success/50', max: Math.max(stats.audits.total_audits, stats.audits.total_views, stats.audits.total_cta_clicks) || 1 },
                  ].map((bar, i) => (
                    <div key={i} className="flex flex-col items-center flex-1">
                      <span className="text-xs font-bold text-white mb-1">{bar.value}</span>
                      <div
                        className={`w-full max-w-[48px] ${bar.color} rounded-t-lg transition-all duration-700 sparkline-bar`}
                        style={{ height: `${Math.max(8, (bar.value / bar.max) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-around">
                  {['Erstellt', 'Aufrufe', 'CTA Klicks'].map(l => (
                    <span key={l} className="text-[10px] text-elvora-text-dim">{l}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Hot Leads */}
          {stats && stats.hotLeads.length > 0 && (
            <div className="card-premium rounded-2xl p-5 border border-red-500/10">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Hot Leads</h2>
                  <span className="text-[10px] text-red-400/80">Haben deinen Audit angesehen</span>
                </div>
              </div>
              <div className="space-y-2">
                {stats.hotLeads.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/crm/${lead.id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-red-500/20 hover:bg-red-500/[0.03] transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center text-red-400 text-xs font-bold flex-shrink-0">
                        {lead.score}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate group-hover:text-red-300 transition-colors">{lead.name}</div>
                        <div className="text-xs text-elvora-text-dim flex items-center gap-2">
                          <span>{lead.city}</span>
                          {lead.audit_views > 0 && <span className="text-elvora-warning">{lead.audit_views}x gesehen</span>}
                          {lead.cta_clicks > 0 && <span className="text-red-400 font-semibold">{lead.cta_clicks}x CTA</span>}
                        </div>
                      </div>
                    </div>
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="ml-2 w-8 h-8 rounded-lg bg-elvora-success/15 flex items-center justify-center text-elvora-success hover:bg-elvora-success/25 transition-all flex-shrink-0"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Follow-Up Automation */}
          {stats && (stats.followUps.pending > 0 || stats.followUps.sent > 0) && (
            <div className="card-premium rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-elvora-accent/10 flex items-center justify-center">
                    <svg className="w-4 h-4 text-elvora-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">Auto Follow-Ups</h2>
                    <p className="text-[10px] text-elvora-text-dim">{stats.followUps.sentThisWeek} diese Woche gesendet</p>
                  </div>
                </div>
                {stats.followUps.dueNow > 0 && (
                  <span className="px-2.5 py-1 rounded-full bg-elvora-warning/15 text-elvora-warning text-[10px] font-bold animate-pulse">
                    {stats.followUps.dueNow} fällig
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { value: stats.followUps.pending, label: 'Geplant', color: 'text-elvora-accent' },
                  { value: stats.followUps.sentThisWeek, label: 'Diese Woche', color: 'text-elvora-success' },
                  { value: stats.followUps.sent, label: 'Gesamt', color: 'text-elvora-purple-light' },
                ].map((s, i) => (
                  <div key={i} className="text-center p-3 rounded-xl bg-white/[0.02]">
                    <div className={`text-lg font-bold ${s.color} stat-number`}>{s.value}</div>
                    <div className="text-[10px] text-elvora-text-dim mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {stats.followUps.next.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-2">Nächste</div>
                  {stats.followUps.next.map((fu, i) => {
                    const date = new Date(fu.scheduled_at + 'Z');
                    const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
                    const timeLabel = diffDays <= 0 ? 'Jetzt' : diffDays === 1 ? 'Morgen' : `${diffDays}d`;
                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-elvora-accent/15 text-elvora-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {fu.step}
                          </span>
                          <span className="text-elvora-text-muted truncate">{fu.name}</span>
                        </div>
                        <span className={`flex-shrink-0 ml-2 font-medium ${diffDays <= 0 ? 'text-elvora-warning' : 'text-elvora-text-dim'}`}>
                          {timeLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Recent Scans */}
          {stats && stats.recentScans.length > 0 && (
            <div className="card-premium rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-white">Letzte Scans</h2>
                <Link href="/scraper" className="text-[11px] text-elvora-purple-light hover:text-elvora-purple transition-colors">Alle →</Link>
              </div>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-white/[0.04]">
                      <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3 font-semibold">Keyword</th>
                      <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3 font-semibold">Stadt</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3 font-semibold">Gefunden</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3 font-semibold">Neu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.03]">
                    {stats.recentScans.map((scan, i) => (
                      <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 text-sm text-white font-medium">{scan.keyword}</td>
                        <td className="py-3 text-sm text-elvora-text-muted">{scan.city}</td>
                        <td className="py-3 text-sm text-white font-medium text-right">{scan.leads_found || 0}</td>
                        <td className="py-3 text-sm text-elvora-success font-semibold text-right">+{scan.leads_new || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - Sidebar Widgets */}
        <div className="space-y-5">
          {/* Calendar Widget */}
          <div className="card-premium rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-white">Kalender</h2>
              <span className="text-xs text-elvora-purple-light font-medium">{monthNames[today.getMonth()]}</span>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center mb-2">
              {dayNames.map(d => (
                <div key={d} className="text-[10px] text-elvora-text-dim font-medium py-1">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {calendarDays.slice(0, 35).map((d, i) => {
                const isToday = d.current && d.day === today.getDate();
                return (
                  <div
                    key={i}
                    className={`text-xs py-1.5 rounded-lg transition-colors ${
                      isToday
                        ? 'bg-elvora-gradient text-white font-bold shadow-elvora-glow-sm'
                        : d.current
                          ? 'text-elvora-text-muted hover:bg-white/[0.04] cursor-pointer'
                          : 'text-elvora-text-dim/40'
                    }`}
                  >
                    {d.day}
                  </div>
                );
              })}
            </div>
            <Link href="/calendar" className="block text-center text-[11px] text-elvora-purple-light hover:text-elvora-purple transition-colors mt-3">
              Kalender öffnen →
            </Link>
          </div>

          {/* Tasks Widget */}
          {(tasks.length > 0 || taskCounts.open > 0) && (
            <div className={`card-premium rounded-2xl p-5 ${taskCounts.overdue > 0 ? 'border border-red-500/15' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">Aufgaben</h2>
                  {taskCounts.overdue > 0 && (
                    <span className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center">
                      {taskCounts.overdue}
                    </span>
                  )}
                </div>
                <Link href="/tasks" className="text-[11px] text-elvora-purple-light hover:text-elvora-purple transition-colors">Alle →</Link>
              </div>
              {tasks.length === 0 ? (
                <div className="text-xs text-elvora-text-dim text-center py-4">Keine offenen Aufgaben</div>
              ) : (
                <div className="space-y-1">
                  {tasks.slice(0, 5).map(t => {
                    const overdue = t.due_date && t.due_date < new Date().toISOString().split('T')[0];
                    const isToday = t.due_date === new Date().toISOString().split('T')[0];
                    return (
                      <div key={t.id} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/[0.03] group transition-colors">
                        <button
                          onClick={() => toggleTask(t.id)}
                          className="w-4 h-4 rounded-md border-2 border-white/15 hover:border-elvora-purple flex-shrink-0 transition-colors group-hover:border-white/25"
                        />
                        <span className="text-[13px] text-white/90 truncate flex-1">{t.title}</span>
                        {t.due_date && (
                          <span className={`text-[10px] flex-shrink-0 font-medium ${overdue ? 'text-red-400' : isToday ? 'text-elvora-warning' : 'text-elvora-text-dim'}`}>
                            {new Date(t.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Inbox Widget */}
          {stats && stats.inbox.unread > 0 && (
            <div className="card-premium rounded-2xl p-5 border border-elvora-pink/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white">Neue Antworten</h2>
                  <span className="w-5 h-5 rounded-full bg-elvora-pink/20 text-elvora-pink text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {stats.inbox.unread}
                  </span>
                </div>
                <Link href="/inbox" className="text-[11px] text-elvora-pink hover:text-elvora-pink-light transition-colors">Inbox →</Link>
              </div>
              <div className="space-y-2">
                {stats.inbox.recent.filter(r => !r.is_read).slice(0, 3).map(reply => (
                  <Link
                    key={reply.id}
                    href="/inbox"
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.02] hover:bg-elvora-pink/[0.04] border border-transparent hover:border-elvora-pink/10 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-elvora-gradient flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                      {(reply.lead_name || reply.from_name || reply.from_email)[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-white truncate">
                        {reply.lead_name || reply.from_name || reply.from_email}
                      </div>
                      <div className="text-[11px] text-elvora-text-dim truncate">{reply.subject}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Top Engaged Leads */}
          {stats && stats.engagement.topLeads.length > 0 && (
            <div className="card-premium rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3">Top Engaged</h2>
              <div className="space-y-2">
                {stats.engagement.topLeads.slice(0, 4).map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/crm/${lead.id}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/[0.03] transition-colors group"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                      lead.engagement_score >= 50 ? 'bg-red-500/15 text-red-400' : 'bg-elvora-warning/15 text-elvora-warning'
                    }`}>
                      {lead.engagement_score}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-white truncate group-hover:text-elvora-purple-light transition-colors">{lead.name}</div>
                      <div className="text-[10px] text-elvora-text-dim truncate">{lead.city}</div>
                    </div>
                    {lead.phone && (
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={e => e.stopPropagation()}
                        className="w-7 h-7 rounded-lg bg-elvora-success/10 flex items-center justify-center text-elvora-success hover:bg-elvora-success/20 transition-all flex-shrink-0"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </a>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/scraper" className="card-premium rounded-2xl p-4 card-hover group text-center">
              <div className="w-10 h-10 rounded-xl bg-elvora-primary/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-elvora-primary/20 transition-colors">
                <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-xs text-elvora-text-muted font-medium group-hover:text-white transition-colors">Maps Scraper</span>
            </Link>
            <Link href="/gmb-audit" className="card-premium rounded-2xl p-4 card-hover group text-center">
              <div className="w-10 h-10 rounded-xl bg-elvora-pink/10 flex items-center justify-center mx-auto mb-2 group-hover:bg-elvora-pink/20 transition-colors">
                <svg className="w-5 h-5 text-elvora-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="text-xs text-elvora-text-muted font-medium group-hover:text-white transition-colors">GMB Audit</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
