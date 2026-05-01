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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
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
          <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Ø Deal-Zyklus</div>
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
                    {idx > 0 && <span className="text-[10px] text-elvora-text-dim">→ {conversion.toFixed(0)}%</span>}
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
        <h2 className="text-sm font-semibold text-white mb-2">Aktivitäten (letzte 8 Wochen)</h2>
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

      {/* Monthly Trends */}
      <div className="glass rounded-2xl p-6 border border-white/5">
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
    </div>
  );
}
