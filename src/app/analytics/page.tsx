'use client';

import { useState, useEffect } from 'react';

interface AnalyticsData {
  funnel: Array<{ contact_status: string; count: number }>;
  pipelineValue: Array<{ contact_status: string; total: number; count: number }>;
  forecast: { weighted: number | null; total: number | null; count: number };
  wonLost: Array<{ contact_status: string; count: number; total: number }>;
  activityTrend: Array<{ week: string; type: string; count: number }>;
  emailStats: { total_sent: number; total_replies: number; total_opened: number };
  cycle: { avg_days: number | null };
  monthly: Array<{ month: string; new_leads: number; wins: number; revenue: number }>;
}

interface MrrData {
  current_mrr: number;
  active_clients: number;
  churn_rate: number;
  annual_projection: number;
  won_value: number;
  trends: Array<{ month: string; mrr: number; active_clients: number }>;
  goal: { progress: number; on_track: boolean; won_value: number; projected_total: number; months_left: number };
}

interface OutreachData {
  overview: {
    totalSent: number;
    totalOpened: number;
    totalReplied: number;
    totalBounced: number;
    totalCampaigns: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    blacklisted: number;
  };
  dailySends: Array<{ day: string; count: number }>;
  recentCampaigns: Array<{
    id: number;
    name: string;
    status: string;
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    openRate: number;
    replyRate: number;
    created_at: string;
  }>;
}

const stageOrder = ['not_contacted', 'email_sent', 'called', 'meeting', 'proposal', 'won'];
const stageLabels: Record<string, string> = {
  not_contacted: 'Nicht kontakt.',
  email_sent: 'Mail gesendet',
  called: 'Angerufen',
  meeting: 'Meeting',
  proposal: 'Angebot',
  won: 'Gewonnen',
  lost: 'Verloren',
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [mrr, setMrr] = useState<MrrData | null>(null);
  const [outreach, setOutreach] = useState<OutreachData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/analytics').then(r => r.json()),
      fetch('/api/mrr').then(r => r.json()),
      fetch('/api/outreach/analytics').then(r => r.json()).catch(() => null),
    ]).then(([analyticsData, mrrData, outreachData]) => {
      setData(analyticsData);
      setMrr(mrrData);
      setOutreach(outreachData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-elvora-text-dim">Laden...</div>;
  if (!data) return <div className="p-8 text-center text-elvora-text-dim">Fehler beim Laden</div>;

  const funnelMap = new Map<string, number>(data.funnel.map(f => [f.contact_status, f.count]));
  const maxFunnel = Math.max(...data.funnel.map(f => f.count), 1);

  const won = data.wonLost.find(w => w.contact_status === 'won') || { count: 0, total: 0 };
  const lost = data.wonLost.find(w => w.contact_status === 'lost') || { count: 0, total: 0 };
  const winRate = (won.count + lost.count) > 0 ? (won.count / (won.count + lost.count) * 100) : 0;

  const responseRate = data.emailStats.total_sent > 0 ? (data.emailStats.total_replies / data.emailStats.total_sent * 100) : 0;
  const openRate = data.emailStats.total_sent > 0 ? (data.emailStats.total_opened / data.emailStats.total_sent * 100) : 0;

  // Activity trend processing - last 8 weeks
  const weekMap = new Map<string, Record<string, number>>();
  data.activityTrend.forEach(a => {
    if (!weekMap.has(a.week)) weekMap.set(a.week, {});
    weekMap.get(a.week)![a.type] = a.count;
  });
  const weeks = Array.from(weekMap.keys()).sort().slice(-8);
  const types = ['call', 'email', 'meeting', 'note'];
  const typeColors: Record<string, string> = {
    call: 'bg-elvora-accent', email: 'bg-elvora-purple', meeting: 'bg-elvora-success', note: 'bg-elvora-text-dim',
  };
  const maxWeek = Math.max(...weeks.map(w => {
    const wd = weekMap.get(w) || {};
    return Object.values(wd).reduce<number>((a, b) => a + (b as number), 0);
  }), 1);

  const maxMonthRev = Math.max(...data.monthly.map(m => m.revenue || 0), 1);

  // Outreach daily sends processing
  const maxDailySend = outreach ? Math.max(...outreach.dailySends.map(d => d.count), 1) : 1;

  // Email performance: find best day of week from daily sends
  const dayOfWeekStats: Record<number, { total: number; count: number }> = {};
  outreach?.dailySends.forEach(d => {
    const dow = new Date(d.day).getDay();
    if (!dayOfWeekStats[dow]) dayOfWeekStats[dow] = { total: 0, count: 0 };
    dayOfWeekStats[dow].total += d.count;
    dayOfWeekStats[dow].count += 1;
  });
  const dayNames = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  let bestDay = '';
  let bestDayAvg = 0;
  Object.entries(dayOfWeekStats).forEach(([dow, s]) => {
    const avg = s.count > 0 ? s.total / s.count : 0;
    if (avg > bestDayAvg) { bestDayAvg = avg; bestDay = dayNames[parseInt(dow)]; }
  });

  // Open rate trend from daily sends (approximate: use campaign-level data)
  const openRateTrend: Array<{ label: string; rate: number }> = [];
  if (outreach && outreach.recentCampaigns.length > 0) {
    const sorted = [...outreach.recentCampaigns].filter(c => c.sent > 0).reverse().slice(-8);
    sorted.forEach(c => {
      openRateTrend.push({
        label: c.name.length > 12 ? c.name.substring(0, 12) + '..' : c.name,
        rate: c.openRate,
      });
    });
  }
  const maxOpenRate = Math.max(...openRateTrend.map(o => o.rate), 1);

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto pb-20">
      <h1 className="text-2xl font-bold text-white mb-6">Sales-Analytics</h1>

      {/* Key KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="glass rounded-xl p-4 border border-elvora-success/20">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Win-Rate</div>
          <div className="text-2xl font-bold text-elvora-success mt-1">{winRate.toFixed(1)}%</div>
          <div className="text-[10px] text-elvora-text-dim mt-0.5">{won.count} gewonnen / {lost.count} verloren</div>
        </div>
        <div className="glass rounded-xl p-4 border border-elvora-purple/20">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Forecast (gewichtet)</div>
          <div className="text-2xl font-bold text-elvora-purple-light mt-1">{Math.round(data.forecast.weighted || 0).toLocaleString('de-DE')}</div>
          <div className="text-[10px] text-elvora-text-dim mt-0.5">EUR aus {data.forecast.count} Deals</div>
        </div>
        <div className="glass rounded-xl p-4 border border-elvora-pink/20">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Antwortrate</div>
          <div className="text-2xl font-bold text-elvora-pink mt-1">{responseRate.toFixed(1)}%</div>
          <div className="text-[10px] text-elvora-text-dim mt-0.5">{data.emailStats.total_replies} / {data.emailStats.total_sent} Mails</div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">O Deal-Zyklus</div>
          <div className="text-2xl font-bold text-white mt-1">{data.cycle.avg_days ? Math.round(data.cycle.avg_days) : '–'}</div>
          <div className="text-[10px] text-elvora-text-dim mt-0.5">Tage bis Won</div>
        </div>
      </div>

      {/* Funnel */}
      <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Sales-Funnel</h2>
        <div className="space-y-2">
          {stageOrder.map((stage, idx) => {
            const count = funnelMap.get(stage) || 0;
            const prev = idx > 0 ? (funnelMap.get(stageOrder[idx - 1]) || 0) : count;
            const conversion = prev > 0 ? (count / prev * 100) : 0;
            const widthPct = (count / maxFunnel) * 100;
            return (
              <div key={stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-elvora-text-muted">{stageLabels[stage]}</span>
                  <div className="flex items-center gap-3">
                    {idx > 0 && <span className="text-[10px] text-elvora-text-dim">{'→'} {conversion.toFixed(0)}%</span>}
                    <span className="text-xs font-bold text-white">{count}</span>
                  </div>
                </div>
                <div className="h-6 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-elvora-gradient transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Value */}
      <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Pipeline-Wert pro Stage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.pipelineValue.map(p => (
            <div key={p.contact_status} className="bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">{stageLabels[p.contact_status] || p.contact_status}</div>
              <div className="text-lg font-bold text-elvora-accent mt-1">{Math.round(p.total).toLocaleString('de-DE')} EUR</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">{p.count} Deals</div>
            </div>
          ))}
          {data.pipelineValue.length === 0 && (
            <div className="col-span-full text-center text-sm text-elvora-text-dim py-4">Noch keine offenen Deals mit Wert</div>
          )}
        </div>
      </div>

      {/* Activity Trend */}
      <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-2">Aktivitaten (letzte 8 Wochen)</h2>
        <div className="flex items-center gap-3 mb-4 text-[10px] flex-wrap">
          {types.map(t => (
            <div key={t} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded ${typeColors[t]}`} />
              <span className="text-elvora-text-dim capitalize">{t}</span>
            </div>
          ))}
        </div>
        <div className="flex items-end gap-2 h-40">
          {weeks.map(w => {
            const wd: Record<string, number> = weekMap.get(w) || {};
            const total = types.reduce<number>((sum, t) => sum + (wd[t] || 0), 0);
            return (
              <div key={w} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse h-32 rounded overflow-hidden bg-white/5">
                  {types.map(t => {
                    const c = wd[t] || 0;
                    if (c === 0) return null;
                    const h = (c / maxWeek) * 100;
                    return <div key={t} className={typeColors[t]} style={{ height: `${h}%` }} title={`${t}: ${c}`} />;
                  })}
                </div>
                <span className="text-[9px] text-elvora-text-dim">{w.split('-')[1]}</span>
                <span className="text-[10px] text-white font-bold">{total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Outreach Performance */}
      {outreach && (
        <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Outreach Performance</h2>

          {/* Outreach KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-white/5 rounded-lg p-3 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Gesendet</div>
              <div className="text-lg font-bold text-white mt-1">{outreach.overview.totalSent.toLocaleString('de-DE')}</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">{outreach.overview.totalCampaigns} Kampagnen</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-elvora-accent/20">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Open Rate</div>
              <div className="text-lg font-bold text-elvora-accent mt-1">{outreach.overview.openRate}%</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">{outreach.overview.totalOpened.toLocaleString('de-DE')} geoeffnet</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-elvora-success/20">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Reply Rate</div>
              <div className="text-lg font-bold text-elvora-success mt-1">{outreach.overview.replyRate}%</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">{outreach.overview.totalReplied.toLocaleString('de-DE')} Antworten</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-red-400/20">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Bounce Rate</div>
              <div className={`text-lg font-bold mt-1 ${outreach.overview.bounceRate > 5 ? 'text-red-400' : 'text-elvora-text-muted'}`}>{outreach.overview.bounceRate}%</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">{outreach.overview.totalBounced.toLocaleString('de-DE')} bounced</div>
            </div>
          </div>

          {/* Daily Sends Chart (last 30 days) */}
          {outreach.dailySends.length > 0 && (
            <div className="mb-6">
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-3">Gesendete Mails (letzte 30 Tage)</div>
              <div className="flex items-end gap-[3px] h-28">
                {outreach.dailySends.map((d, i) => {
                  const h = (d.count / maxDailySend) * 100;
                  const dayLabel = new Date(d.day).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center group relative">
                      <div
                        className="w-full rounded-t bg-elvora-purple/60 hover:bg-elvora-purple transition-colors cursor-default min-h-[2px]"
                        style={{ height: `${Math.max(2, h)}%` }}
                        title={`${dayLabel}: ${d.count} Mails`}
                      />
                      {i % 5 === 0 && (
                        <span className="text-[7px] text-elvora-text-dim mt-1 whitespace-nowrap">{dayLabel}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent Campaigns Table */}
          {outreach.recentCampaigns.length > 0 && (
            <div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-3">Letzte Kampagnen</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-elvora-text-dim border-b border-white/5">
                      <th className="text-left py-2 pr-3 font-medium">Kampagne</th>
                      <th className="text-left py-2 px-3 font-medium">Status</th>
                      <th className="text-right py-2 px-3 font-medium">Sent</th>
                      <th className="text-right py-2 px-3 font-medium">Opened</th>
                      <th className="text-right py-2 px-3 font-medium">Replied</th>
                      <th className="text-right py-2 pl-3 font-medium">Open %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outreach.recentCampaigns.slice(0, 6).map(c => (
                      <tr key={c.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 pr-3 text-white font-medium truncate max-w-[180px]">{c.name}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            c.status === 'completed' ? 'bg-elvora-success/15 text-elvora-success' :
                            c.status === 'running' || c.status === 'sending' ? 'bg-elvora-purple/15 text-elvora-purple-light' :
                            c.status === 'draft' ? 'bg-white/5 text-elvora-text-dim' :
                            c.status === 'paused' ? 'bg-elvora-warning/15 text-elvora-warning' :
                            'bg-white/5 text-elvora-text-dim'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-elvora-text-muted">{c.sent}</td>
                        <td className="py-2 px-3 text-right text-elvora-text-muted">{c.opened}</td>
                        <td className="py-2 px-3 text-right text-elvora-text-muted">{c.replied}</td>
                        <td className="py-2 pl-3 text-right">
                          <span className={`font-semibold ${c.openRate >= 50 ? 'text-elvora-success' : c.openRate >= 25 ? 'text-elvora-accent' : 'text-elvora-text-muted'}`}>
                            {c.openRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Performance */}
      {outreach && (
        <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">E-Mail Performance</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Open Rate Trend */}
            {openRateTrend.length > 0 && (
              <div>
                <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-3">Open Rate pro Kampagne</div>
                <div className="space-y-2">
                  {openRateTrend.map((o, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[10px] text-elvora-text-muted w-24 truncate shrink-0">{o.label}</span>
                      <div className="flex-1 h-4 bg-white/5 rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all duration-500 ${
                            o.rate >= 50 ? 'bg-elvora-success/60' : o.rate >= 25 ? 'bg-elvora-accent/60' : 'bg-elvora-pink/40'
                          }`}
                          style={{ width: `${(o.rate / Math.max(maxOpenRate, 100)) * 100}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold w-10 text-right ${
                        o.rate >= 50 ? 'text-elvora-success' : o.rate >= 25 ? 'text-elvora-accent' : 'text-elvora-text-muted'
                      }`}>{o.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Best performing insights */}
            <div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-3">Insights</div>
              <div className="space-y-3">
                {bestDay && (
                  <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3.5 h-3.5 text-elvora-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-white font-medium">Bester Versandtag</span>
                    </div>
                    <div className="text-lg font-bold text-elvora-accent">{bestDay}</div>
                    <div className="text-[10px] text-elvora-text-dim">O {bestDayAvg.toFixed(1)} Mails/Tag</div>
                  </div>
                )}
                <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-3.5 h-3.5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-xs text-white font-medium">E-Mail Gesamt</span>
                  </div>
                  <div className="text-lg font-bold text-white">{outreach.overview.totalSent.toLocaleString('de-DE')}</div>
                  <div className="text-[10px] text-elvora-text-dim">{openRate.toFixed(1)}% geoeffnet, {responseRate.toFixed(1)}% beantwortet</div>
                </div>
                {outreach.overview.blacklisted > 0 && (
                  <div className="bg-white/5 rounded-lg p-3 border border-red-400/10">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span className="text-xs text-white font-medium">Blacklisted</span>
                    </div>
                    <div className="text-lg font-bold text-red-400">{outreach.overview.blacklisted}</div>
                    <div className="text-[10px] text-elvora-text-dim">Domains auf Blacklist</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Trends */}
      <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
        <h2 className="text-sm font-semibold text-white mb-4">Monatliche Trends</h2>
        <div className="space-y-2">
          {data.monthly.map(m => {
            const revWidth = ((m.revenue || 0) / maxMonthRev) * 100;
            return (
              <div key={m.month} className="grid grid-cols-12 items-center gap-2">
                <span className="col-span-2 text-xs text-elvora-text-muted">{m.month}</span>
                <div className="col-span-7 h-5 bg-white/5 rounded overflow-hidden">
                  <div className="h-full bg-elvora-success/40" style={{ width: `${revWidth}%` }} />
                </div>
                <span className="col-span-2 text-xs text-elvora-success text-right font-semibold">{Math.round(m.revenue || 0).toLocaleString('de-DE')}</span>
                <span className="col-span-1 text-xs text-elvora-text-dim text-right">{m.new_leads}L</span>
              </div>
            );
          })}
          {data.monthly.length === 0 && <div className="text-sm text-elvora-text-dim text-center py-4">Noch keine Daten</div>}
        </div>
      </div>

      {/* Recurring Revenue */}
      {mrr && (
        <div className="glass rounded-2xl p-6 border border-white/5 mb-6">
          <h2 className="text-sm font-semibold text-white mb-4">Recurring Revenue</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">MRR</div>
              <div className="text-xl font-bold text-elvora-success mt-0.5">{mrr.current_mrr.toLocaleString('de-DE')} EUR</div>
            </div>
            <div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">ARR</div>
              <div className="text-xl font-bold text-white mt-0.5">{mrr.annual_projection.toLocaleString('de-DE')} EUR</div>
            </div>
            <div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Aktive Kunden</div>
              <div className="text-xl font-bold text-white mt-0.5">{mrr.active_clients}</div>
            </div>
            <div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Churn-Rate</div>
              <div className={`text-xl font-bold mt-0.5 ${mrr.churn_rate > 10 ? 'text-red-400' : 'text-elvora-success'}`}>{mrr.churn_rate}%</div>
            </div>
          </div>

          {mrr.trends.length > 1 && (
            <div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-2">MRR-Trend</div>
              <div className="flex items-end gap-2 h-24">
                {mrr.trends.map(t => {
                  const maxMrr = Math.max(...mrr.trends.map(x => x.mrr), 1);
                  const h = (t.mrr / maxMrr) * 100;
                  return (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[9px] text-elvora-success font-bold">{t.mrr > 0 ? `${t.mrr}EUR` : ''}</div>
                      <div className="w-full rounded-t bg-elvora-success/30 transition-all" style={{ height: `${Math.max(4, h)}%` }} />
                      <div className="text-[8px] text-elvora-text-dim">{t.month.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {mrr.goal && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-elvora-text-dim">50k-Ziel bis Mai 2027</span>
                <span className={`text-[10px] font-bold ${mrr.goal.on_track ? 'text-elvora-success' : 'text-elvora-warning'}`}>{mrr.goal.progress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-elvora-purple to-elvora-success" style={{ width: `${Math.min(100, mrr.goal.progress)}%` }} />
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-elvora-text-dim">
                <span>Won: {mrr.goal.won_value.toLocaleString('de-DE')}EUR + MRR x {mrr.goal.months_left}Mo</span>
                <span>Projektion: {Math.round(mrr.goal.projected_total).toLocaleString('de-DE')}EUR</span>
              </div>
            </div>
          )}

          {/* Revenue Mix */}
          {(won.total > 0 || mrr.current_mrr > 0) && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-2">Revenue-Mix</div>
              <div className="flex gap-2 h-6 rounded-lg overflow-hidden">
                {won.total > 0 && (
                  <div className="bg-elvora-purple/40 rounded" style={{ flex: won.total }} title={`Einmal-Projekte: ${won.total.toLocaleString('de-DE')}EUR`} />
                )}
                {mrr.annual_projection > 0 && (
                  <div className="bg-elvora-success/40 rounded" style={{ flex: mrr.annual_projection }} title={`MRR (annualisiert): ${mrr.annual_projection.toLocaleString('de-DE')}EUR`} />
                )}
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-elvora-text-dim">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-elvora-purple/40" /> Einmal: {won.total.toLocaleString('de-DE')}EUR</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-elvora-success/40" /> MRR: {mrr.annual_projection.toLocaleString('de-DE')}EUR/Jahr</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
