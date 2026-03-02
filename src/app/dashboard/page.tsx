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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

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

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
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

      {/* Inbox / Recent Replies */}
      {stats && stats.inbox.unread > 0 && (
        <div className="glass rounded-xl p-4 mb-5 border border-elvora-pink/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-elvora-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider">Neue Antworten</span>
              <span className="px-2 py-0.5 rounded-full bg-elvora-pink/20 text-elvora-pink text-[10px] font-bold animate-pulse">
                {stats.inbox.unread} ungelesen
              </span>
            </div>
            <Link href="/inbox" className="text-xs text-elvora-pink hover:text-elvora-pink-light transition-colors">
              Alle anzeigen &rarr;
            </Link>
          </div>

          <div className="space-y-2">
            {stats.inbox.recent.filter(r => !r.is_read).slice(0, 3).map(reply => (
              <Link
                key={reply.id}
                href="/inbox"
                className="flex items-center gap-3 p-3 rounded-lg bg-elvora-pink/5 border border-elvora-pink/10 hover:bg-elvora-pink/10 transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-elvora-gradient flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {(reply.lead_name || reply.from_name || reply.from_email)[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {reply.lead_name || reply.from_name || reply.from_email}
                  </div>
                  <div className="text-xs text-elvora-text-dim truncate">{reply.subject}</div>
                </div>
                {reply.lead_city && (
                  <span className="text-[10px] text-elvora-text-dim flex-shrink-0">{reply.lead_city}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Engagement Scoring */}
      {stats && (stats.engagement.distribution.hot > 0 || stats.engagement.distribution.warm > 0 || stats.engagement.topLeads.length > 0) && (() => {
        const dist = stats.engagement.distribution;
        const total = dist.hot + dist.warm + dist.cool + dist.cold;
        const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
        const signalLabels: Record<string, string> = {
          email_opened: 'Email geöffnet',
          email_opened_multiple: 'Mehrfach geöffnet',
          audit_viewed: 'Audit angesehen',
          audit_cta_clicked: 'CTA geklickt',
          replied: 'Geantwortet',
          pipeline_advanced: 'Pipeline aktiv',
          bad_website: 'Schlechte Website',
          has_phone: 'Telefon',
          has_email: 'Email',
          multiple_found: 'Mehrfach gefunden',
        };

        return (
          <div className="glass rounded-xl p-4 mb-5 border border-elvora-purple/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider">Engagement Scoring</span>
              </div>
              <Link href="/akquise?sort=engagement" className="text-xs text-elvora-purple-light hover:text-elvora-purple transition-colors">
                Alle anzeigen &rarr;
              </Link>
            </div>

            {/* Distribution Bar */}
            <div className="mb-4">
              <div className="flex rounded-lg overflow-hidden h-3 bg-white/5">
                {dist.hot > 0 && (
                  <div className="bg-red-500 transition-all" style={{ width: `${pct(dist.hot)}%` }} title={`Hot: ${dist.hot}`} />
                )}
                {dist.warm > 0 && (
                  <div className="bg-elvora-warning transition-all" style={{ width: `${pct(dist.warm)}%` }} title={`Warm: ${dist.warm}`} />
                )}
                {dist.cool > 0 && (
                  <div className="bg-elvora-accent transition-all" style={{ width: `${pct(dist.cool)}%` }} title={`Cool: ${dist.cool}`} />
                )}
                {dist.cold > 0 && (
                  <div className="bg-white/10 transition-all" style={{ width: `${pct(dist.cold)}%` }} title={`Kalt: ${dist.cold}`} />
                )}
              </div>
              <div className="flex justify-between mt-2 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-elvora-text-dim">Hot {dist.hot}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-elvora-warning" />
                  <span className="text-elvora-text-dim">Warm {dist.warm}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-elvora-accent" />
                  <span className="text-elvora-text-dim">Cool {dist.cool}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-white/20" />
                  <span className="text-elvora-text-dim">Kalt {dist.cold}</span>
                </div>
              </div>
            </div>

            {/* Top Engaged Leads */}
            {stats.engagement.topLeads.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Top Engaged Leads</div>
                {stats.engagement.topLeads.map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:border-elvora-purple/20 transition-all">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        lead.engagement_score >= 50 ? 'bg-red-500/20 text-red-400' : 'bg-elvora-warning/20 text-elvora-warning'
                      }`}>
                        {lead.engagement_score}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{lead.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-elvora-text-dim">{lead.city}</span>
                          {Object.entries(lead.engagement_signals)
                            .filter(([, v]) => v)
                            .slice(0, 3)
                            .map(([key]) => (
                              <span key={key} className="text-[9px] px-1.5 py-0.5 rounded-full bg-elvora-purple/10 text-elvora-purple-light">
                                {signalLabels[key] || key}
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="ml-2 px-2.5 py-1 rounded-lg bg-elvora-success/15 border border-elvora-success/20 text-elvora-success text-[10px] font-semibold hover:bg-elvora-success/25 transition-all flex-shrink-0">
                        Anrufen
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
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

      {/* Follow-Up Automation */}
      {stats && (stats.followUps.pending > 0 || stats.followUps.sent > 0) && (
        <div className="glass rounded-xl p-4 mb-5 border border-elvora-accent/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-elvora-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider">Auto Follow-Ups</span>
            </div>
            {stats.followUps.dueNow > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-elvora-warning/15 text-elvora-warning text-[10px] font-bold animate-pulse">
                {stats.followUps.dueNow} fällig
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <div>
              <div className="text-lg font-bold text-elvora-accent">{stats.followUps.pending}</div>
              <div className="text-[10px] text-elvora-text-dim">Geplant</div>
            </div>
            <div>
              <div className="text-lg font-bold text-elvora-success">{stats.followUps.sentThisWeek}</div>
              <div className="text-[10px] text-elvora-text-dim">Diese Woche</div>
            </div>
            <div>
              <div className="text-lg font-bold text-elvora-purple-light">{stats.followUps.sent}</div>
              <div className="text-[10px] text-elvora-text-dim">Gesamt gesendet</div>
            </div>
          </div>

          {stats.followUps.next.length > 0 && (
            <div className="border-t border-white/5 pt-3">
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-2">Nächste Follow-Ups</div>
              <div className="space-y-1.5">
                {stats.followUps.next.map((fu, i) => {
                  const date = new Date(fu.scheduled_at + 'Z');
                  const now = new Date();
                  const diffMs = date.getTime() - now.getTime();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  const timeLabel = diffDays <= 0 ? 'Jetzt fällig' : diffDays === 1 ? 'Morgen' : `In ${diffDays} Tagen`;

                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-elvora-accent/20 text-elvora-accent text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                          {fu.step}
                        </span>
                        <span className="text-elvora-text-muted truncate">{fu.name}</span>
                        <span className="text-elvora-text-dim">{fu.city}</span>
                      </div>
                      <span className={`flex-shrink-0 ml-2 ${diffDays <= 0 ? 'text-elvora-warning font-semibold' : 'text-elvora-text-dim'}`}>
                        {timeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
