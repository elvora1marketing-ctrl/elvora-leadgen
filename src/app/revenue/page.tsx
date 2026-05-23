'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface ForecastData {
  current_month: number;
  last_month: number;
  pipeline_weighted: number;
  pipeline_total: number;
  forecast_next_month: number;
  avg_deal_value: number;
  avg_days_to_close: number;
  monthly_trend: Array<{ month: string; revenue: number; deals_won: number }>;
  by_stage: Array<{ stage: string; count: number; value: number }>;
}

interface WinLossData {
  win_rate: number;
  avg_score_won: number;
  avg_score_lost: number;
  top_cities_won: Array<{ city: string; count: number; total_value: number }>;
  top_keywords_won: Array<{ keyword: string; count: number; total_value: number }>;
  avg_time_to_win: number;
  avg_time_to_loss: number;
  loss_reasons: Array<{ reason: string; count: number }>;
  won_count: number;
  lost_count: number;
}

interface AttributionData {
  by_keyword: Array<{ keyword: string; leads_total: number; leads_won: number; revenue: number; conversion_rate: number }>;
  by_city: Array<{ city: string; leads_total: number; leads_won: number; revenue: number; conversion_rate: number }>;
  best_score_range: Array<{ range: string; leads: number; won: number; rate: number }>;
}

interface SpeedData {
  avg_minutes_to_contact: number;
  leads_under_1h: number;
  leads_under_24h: number;
  leads_over_24h: number;
  never_contacted: number;
  distribution: Array<{ range: string; count: number }>;
  hot_uncontacted: Array<{ id: number; name: string; city: string; score: number; created_at: string; minutes_since_created: number }>;
}

interface ABTest {
  id: number;
  name: string;
  subject_a: string;
  subject_b: string;
  variant_a_sent: number;
  variant_a_opened: number;
  variant_a_replied: number;
  variant_b_sent: number;
  variant_b_opened: number;
  variant_b_replied: number;
  winner: string | null;
  status: string;
  created_at: string;
}

interface ProposalAlert {
  id: number;
  title: string;
  lead_name: string;
  lead_city: string;
  lead_phone: string;
  last_viewed_at: string;
}

interface Referral {
  id: number;
  referrer_name: string;
  referred_name: string;
  status: string;
  deal_value: number;
  created_at: string;
}

const stageLabels: Record<string, string> = {
  not_contacted: 'Offen',
  email_sent: 'Mail gesendet',
  called: 'Angerufen',
  meeting: 'Meeting',
  proposal: 'Angebot',
  won: 'Gewonnen',
  lost: 'Verloren',
};

const fmtEur = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtPct = (n: number) => `${Math.round(n)}%`;

type Tab = 'forecast' | 'winloss' | 'attribution' | 'speed' | 'proposals' | 'referrals' | 'abtests';

export default function RevenuePage() {
  const [tab, setTab] = useState<Tab>('forecast');
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [winLoss, setWinLoss] = useState<WinLossData | null>(null);
  const [attribution, setAttribution] = useState<AttributionData | null>(null);
  const [speed, setSpeed] = useState<SpeedData | null>(null);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [proposalAlerts, setProposalAlerts] = useState<ProposalAlert[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [referralStats, setReferralStats] = useState({ total: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);

  const loadTab = useCallback(async (t: Tab) => {
    setLoading(true);
    try {
      if (t === 'forecast' && !forecast) {
        const res = await fetch('/api/revenue/forecast');
        if (res.ok) setForecast(await res.json());
      } else if (t === 'winloss' && !winLoss) {
        const res = await fetch('/api/revenue/win-loss');
        if (res.ok) setWinLoss(await res.json());
      } else if (t === 'attribution' && !attribution) {
        const res = await fetch('/api/revenue/attribution');
        if (res.ok) setAttribution(await res.json());
      } else if (t === 'speed') {
        const res = await fetch('/api/revenue/speed-to-lead');
        if (res.ok) setSpeed(await res.json());
      } else if (t === 'proposals') {
        const res = await fetch('/api/proposals/tracking');
        if (res.ok) {
          const d = await res.json();
          setProposalAlerts(d.recently_viewed || []);
          setAlertCount(d.unread_notifications || 0);
        }
      } else if (t === 'referrals') {
        const res = await fetch('/api/referrals');
        if (res.ok) {
          const d = await res.json();
          setReferrals(d.referrals || []);
          setReferralStats({ total: d.total || 0, totalValue: d.total_value || 0 });
        }
      } else if (t === 'abtests') {
        const res = await fetch('/api/ab-tests');
        if (res.ok) {
          const d = await res.json();
          setAbTests(d.tests || []);
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [forecast, winLoss, attribution]);

  useEffect(() => { loadTab('forecast'); }, [loadTab]);
  useEffect(() => {
    fetch('/api/proposals/tracking').then(r => r.json()).then(d => setAlertCount(d.unread_notifications || 0)).catch(() => {});
  }, []);

  const switchTab = (t: Tab) => { setTab(t); loadTab(t); };

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'forecast', label: 'Forecast' },
    { key: 'winloss', label: 'Win/Loss' },
    { key: 'attribution', label: 'Attribution' },
    { key: 'speed', label: 'Speed-to-Lead' },
    { key: 'proposals', label: 'Angebote Live', badge: alertCount },
    { key: 'referrals', label: 'Empfehlungen' },
    { key: 'abtests', label: 'A/B Tests' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Revenue Intelligence</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Umsatz analysieren, optimieren, steigern</p>
        </div>
        <Link href="/roi-rechner" target="_blank" className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors">
          ROI-Rechner
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            className={`px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              tab === t.key ? 'bg-elvora-primary text-white' : 'text-elvora-text-muted hover:bg-white/5'
            }`}
          >
            {t.label}
            {t.badge && t.badge > 0 && (
              <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {loading && !forecast && !winLoss && !attribution && !speed && (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* FORECAST TAB */}
      {tab === 'forecast' && forecast && (
        <div className="space-y-5">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Diesen Monat', value: `${fmtEur(forecast.current_month)}€`, sub: `Letzter: ${fmtEur(forecast.last_month)}€`, color: 'text-elvora-success', bg: 'bg-elvora-success/10' },
              { label: 'Pipeline (gewichtet)', value: `${fmtEur(forecast.pipeline_weighted)}€`, sub: `Gesamt: ${fmtEur(forecast.pipeline_total)}€`, color: 'text-elvora-purple-light', bg: 'bg-elvora-primary/10' },
              { label: 'Prognose', value: `${fmtEur(forecast.forecast_next_month)}€`, sub: 'Nächster Monat', color: 'text-elvora-warning', bg: 'bg-elvora-warning/10' },
              { label: 'Ø Deal-Wert', value: `${fmtEur(forecast.avg_deal_value)}€`, sub: `Ø ${Math.round(forecast.avg_days_to_close)} Tage bis Abschluss`, color: 'text-elvora-text', bg: 'bg-white/5' },
            ].map((card, i) => (
              <div key={i} className="card rounded-xl p-4">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                  <span className={`text-sm font-bold ${card.color}`}>{i === 0 ? '€' : i === 1 ? '~' : i === 2 ? '>' : 'Ø'}</span>
                </div>
                <div className={`text-2xl font-semibold ${card.color} stat-number`}>{card.value}</div>
                <div className="text-[11px] text-elvora-text-dim mt-0.5">{card.sub}</div>
                <div className="text-[10px] text-elvora-text-dim mt-0.5 uppercase tracking-wider">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Monthly Trend */}
          {forecast.monthly_trend.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-4">Umsatz-Trend (6 Monate)</h2>
              <div className="flex items-end gap-2 h-40">
                {forecast.monthly_trend.map((m, i) => {
                  const max = Math.max(...forecast.monthly_trend.map(t => t.revenue)) || 1;
                  const height = Math.max(4, (m.revenue / max) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-elvora-text-dim">{fmtEur(m.revenue)}€</span>
                      <div className="w-full bg-elvora-purple/30 rounded-t-md" style={{ height: `${height}%` }} />
                      <span className="text-[10px] text-elvora-text-dim">{m.month}</span>
                      <span className="text-[9px] text-elvora-success">{m.deals_won} Deals</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pipeline by Stage */}
          {forecast.by_stage.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Pipeline nach Phase</h2>
              <div className="space-y-2">
                {forecast.by_stage.filter(s => s.count > 0).map(s => (
                  <div key={s.stage} className="flex items-center justify-between py-2 border-b border-elvora-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-elvora-text">{stageLabels[s.stage] || s.stage}</span>
                      <span className="text-xs text-elvora-text-dim">({s.count})</span>
                    </div>
                    <span className="text-sm font-semibold text-elvora-text">{fmtEur(s.value)}€</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WIN/LOSS TAB */}
      {tab === 'winloss' && winLoss && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-elvora-success stat-number">{fmtPct(winLoss.win_rate)}</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Win-Rate</div>
              <div className="text-xs text-elvora-text-muted mt-0.5">{winLoss.won_count} Won / {winLoss.lost_count} Lost</div>
            </div>
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-elvora-text stat-number">{Math.round(winLoss.avg_score_won)}</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Ø Score Won</div>
              <div className="text-xs text-elvora-text-muted mt-0.5">Lost: {Math.round(winLoss.avg_score_lost)}</div>
            </div>
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-elvora-purple-light stat-number">{Math.round(winLoss.avg_time_to_win)}d</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Ø Zeit bis Won</div>
            </div>
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-red-400 stat-number">{Math.round(winLoss.avg_time_to_loss)}d</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Ø Zeit bis Lost</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Cities */}
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Top Städte (Won)</h2>
              <div className="space-y-2">
                {winLoss.top_cities_won.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-elvora-text-muted">{c.city}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-elvora-text-dim">{c.count}x</span>
                      <span className="text-elvora-success font-medium">{fmtEur(c.total_value)}€</span>
                    </div>
                  </div>
                ))}
                {winLoss.top_cities_won.length === 0 && <div className="text-xs text-elvora-text-dim text-center py-3">Noch keine Daten</div>}
              </div>
            </div>

            {/* Loss Reasons */}
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Verlust-Gründe</h2>
              <div className="space-y-2">
                {winLoss.loss_reasons.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-elvora-text-muted truncate flex-1 mr-3">{r.reason || 'Kein Grund angegeben'}</span>
                    <span className="text-red-400 font-medium">{r.count}x</span>
                  </div>
                ))}
                {winLoss.loss_reasons.length === 0 && <div className="text-xs text-elvora-text-dim text-center py-3">Noch keine Daten</div>}
              </div>
            </div>
          </div>

          {/* Top Keywords */}
          {winLoss.top_keywords_won.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Top Keywords (Won)</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {winLoss.top_keywords_won.map((k, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-sm font-medium text-elvora-text">{k.keyword}</div>
                    <div className="text-elvora-success text-xs mt-1">{fmtEur(k.total_value)}€</div>
                    <div className="text-[10px] text-elvora-text-dim">{k.count} Deals</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ATTRIBUTION TAB */}
      {tab === 'attribution' && attribution && (
        <div className="space-y-5">
          {/* Score Ranges */}
          {attribution.best_score_range.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Conversion nach Score-Range</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {attribution.best_score_range.map((r, i) => (
                  <div key={i} className="bg-white/5 rounded-lg p-3 text-center">
                    <div className="text-xs text-elvora-text-dim mb-1">Score {r.range}</div>
                    <div className={`text-xl font-bold stat-number ${r.rate > 20 ? 'text-elvora-success' : r.rate > 5 ? 'text-elvora-warning' : 'text-elvora-text-dim'}`}>
                      {fmtPct(r.rate)}
                    </div>
                    <div className="text-[10px] text-elvora-text-dim mt-0.5">{r.won}/{r.leads} Leads</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Keyword */}
          {attribution.by_keyword.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Revenue nach Keyword</h2>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-elvora-border">
                      <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Keyword</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Leads</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Won</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Rate</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elvora-border/30">
                    {attribution.by_keyword.slice(0, 15).map((k, i) => (
                      <tr key={i}>
                        <td className="py-2 text-sm text-elvora-text">{k.keyword}</td>
                        <td className="py-2 text-sm text-elvora-text-muted text-right">{k.leads_total}</td>
                        <td className="py-2 text-sm text-elvora-success text-right">{k.leads_won}</td>
                        <td className="py-2 text-sm text-elvora-warning text-right">{fmtPct(k.conversion_rate)}</td>
                        <td className="py-2 text-sm text-elvora-success font-medium text-right">{fmtEur(k.revenue)}€</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* By City */}
          {attribution.by_city.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Revenue nach Stadt</h2>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr className="border-b border-elvora-border">
                      <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Stadt</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Leads</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Won</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Rate</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-elvora-border/30">
                    {attribution.by_city.slice(0, 15).map((c, i) => (
                      <tr key={i}>
                        <td className="py-2 text-sm text-elvora-text">{c.city}</td>
                        <td className="py-2 text-sm text-elvora-text-muted text-right">{c.leads_total}</td>
                        <td className="py-2 text-sm text-elvora-success text-right">{c.leads_won}</td>
                        <td className="py-2 text-sm text-elvora-warning text-right">{fmtPct(c.conversion_rate)}</td>
                        <td className="py-2 text-sm text-elvora-success font-medium text-right">{fmtEur(c.revenue)}€</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SPEED-TO-LEAD TAB */}
      {tab === 'speed' && speed && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="card rounded-xl p-4">
              <div className={`text-2xl font-semibold stat-number ${speed.avg_minutes_to_contact < 60 ? 'text-elvora-success' : speed.avg_minutes_to_contact < 1440 ? 'text-elvora-warning' : 'text-red-400'}`}>
                {speed.avg_minutes_to_contact < 60 ? `${Math.round(speed.avg_minutes_to_contact)}min` : speed.avg_minutes_to_contact < 1440 ? `${Math.round(speed.avg_minutes_to_contact / 60)}h` : `${Math.round(speed.avg_minutes_to_contact / 1440)}d`}
              </div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Ø Reaktionszeit</div>
            </div>
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-elvora-success stat-number">{speed.leads_under_1h}</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Unter 1 Stunde</div>
            </div>
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-elvora-warning stat-number">{speed.leads_under_24h}</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Unter 24 Stunden</div>
            </div>
            <div className="card rounded-xl p-4 border border-red-500/20">
              <div className="text-2xl font-semibold text-red-400 stat-number">{speed.never_contacted}</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Nie kontaktiert</div>
            </div>
          </div>

          {/* Distribution */}
          {speed.distribution.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-4">Verteilung Reaktionszeit</h2>
              <div className="flex items-end gap-3 h-32">
                {speed.distribution.map((d, i) => {
                  const max = Math.max(...speed.distribution.map(x => x.count)) || 1;
                  const height = Math.max(4, (d.count / max) * 100);
                  const colors = ['bg-elvora-success', 'bg-elvora-success/70', 'bg-elvora-warning', 'bg-elvora-accent', 'bg-red-400'];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-elvora-text">{d.count}</span>
                      <div className={`w-full ${colors[i] || 'bg-elvora-purple'} rounded-t-md`} style={{ height: `${height}%` }} />
                      <span className="text-[10px] text-elvora-text-dim whitespace-nowrap">{d.range}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Hot Uncontacted */}
          {speed.hot_uncontacted.length > 0 && (
            <div className="card rounded-xl p-5 border border-red-500/20">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                <h2 className="text-sm font-semibold text-red-400">Jetzt kontaktieren!</h2>
                <span className="text-[10px] text-elvora-text-dim ml-auto">High-Score Leads ohne Kontakt</span>
              </div>
              <div className="space-y-1.5">
                {speed.hot_uncontacted.map(lead => {
                  const mins = lead.minutes_since_created;
                  const timeLabel = mins < 60 ? `${Math.round(mins)}min` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
                  return (
                    <Link key={lead.id} href={`/crm/${lead.id}`} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-red-500/5 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-red-400 text-xs font-semibold">{lead.score}</div>
                        <div>
                          <div className="text-sm font-medium text-elvora-text group-hover:text-red-400 transition-colors">{lead.name}</div>
                          <div className="text-[11px] text-elvora-text-dim">{lead.city}</div>
                        </div>
                      </div>
                      <span className="text-xs text-red-400 font-medium">seit {timeLabel}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROPOSAL LIVE TRACKING TAB */}
      {tab === 'proposals' && (
        <div className="space-y-5">
          {proposalAlerts.length === 0 ? (
            <div className="card rounded-xl p-8 text-center">
              <svg className="w-12 h-12 text-elvora-text-dim mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <h3 className="text-sm font-semibold text-elvora-text mb-1">Keine neuen Angebots-Aufrufe</h3>
              <p className="text-xs text-elvora-text-dim">Hier siehst du sofort, wenn ein Lead dein Angebot öffnet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {proposalAlerts.map(alert => (
                <div key={alert.id} className="card rounded-xl p-4 border-l-2 border-l-elvora-warning">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-elvora-warning/15 flex items-center justify-center">
                        <svg className="w-5 h-5 text-elvora-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-elvora-text">{alert.lead_name} schaut dein Angebot an!</div>
                        <div className="text-xs text-elvora-text-dim">{alert.title} &middot; {alert.lead_city}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {alert.lead_phone && (
                        <a href={`tel:${alert.lead_phone}`} className="px-3 py-1.5 rounded-lg bg-elvora-success/15 text-elvora-success text-xs font-medium hover:bg-elvora-success/25 transition-colors">
                          Jetzt anrufen
                        </a>
                      )}
                      <Link href={`/crm/${alert.id}`} className="px-3 py-1.5 rounded-lg bg-elvora-primary/15 text-elvora-purple-light text-xs font-medium hover:bg-elvora-primary/25 transition-colors">
                        Öffnen
                      </Link>
                    </div>
                  </div>
                  <div className="text-[10px] text-elvora-text-dim mt-2">
                    Angesehen: {new Date(alert.last_viewed_at).toLocaleString('de-DE')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REFERRALS TAB */}
      {tab === 'referrals' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-elvora-text stat-number">{referralStats.total}</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Empfehlungen</div>
            </div>
            <div className="card rounded-xl p-4">
              <div className="text-2xl font-semibold text-elvora-success stat-number">{fmtEur(referralStats.totalValue)}€</div>
              <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mt-1">Empfehlungs-Umsatz</div>
            </div>
          </div>
          {referrals.length === 0 ? (
            <div className="card rounded-xl p-8 text-center">
              <h3 className="text-sm font-semibold text-elvora-text mb-1">Noch keine Empfehlungen</h3>
              <p className="text-xs text-elvora-text-dim">Frag gewonnene Kunden nach Empfehlungen — das ist der beste Lead-Kanal.</p>
            </div>
          ) : (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-3">Empfehlungen</h2>
              <div className="space-y-2">
                {referrals.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-elvora-border/30 last:border-0">
                    <div>
                      <div className="text-sm text-elvora-text">{r.referred_name}</div>
                      <div className="text-[11px] text-elvora-text-dim">Empfohlen von: {r.referrer_name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        r.status === 'won' ? 'bg-elvora-success/15 text-elvora-success' :
                        r.status === 'contacted' ? 'bg-elvora-warning/15 text-elvora-warning' :
                        r.status === 'lost' ? 'bg-red-500/15 text-red-400' :
                        'bg-white/10 text-elvora-text-dim'
                      }`}>{r.status}</span>
                      {r.deal_value > 0 && <span className="text-xs text-elvora-success font-medium">{fmtEur(r.deal_value)}€</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* A/B TESTS TAB */}
      {tab === 'abtests' && (
        <div className="space-y-5">
          {abTests.length === 0 ? (
            <div className="card rounded-xl p-8 text-center">
              <h3 className="text-sm font-semibold text-elvora-text mb-1">Keine A/B Tests</h3>
              <p className="text-xs text-elvora-text-dim">Erstelle einen Test in der Outreach-Sektion um verschiedene Betreffzeilen zu vergleichen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {abTests.map(test => {
                const openRateA = test.variant_a_sent > 0 ? Math.round((test.variant_a_opened / test.variant_a_sent) * 100) : 0;
                const openRateB = test.variant_b_sent > 0 ? Math.round((test.variant_b_opened / test.variant_b_sent) * 100) : 0;
                const replyRateA = test.variant_a_sent > 0 ? Math.round((test.variant_a_replied / test.variant_a_sent) * 100) : 0;
                const replyRateB = test.variant_b_sent > 0 ? Math.round((test.variant_b_replied / test.variant_b_sent) * 100) : 0;
                const aWins = openRateA > openRateB;
                return (
                  <div key={test.id} className="card rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-elvora-text">{test.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        test.status === 'running' ? 'bg-elvora-success/15 text-elvora-success' :
                        test.status === 'completed' ? 'bg-elvora-purple/15 text-elvora-purple-light' :
                        'bg-white/10 text-elvora-text-dim'
                      }`}>{test.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className={`p-3 rounded-lg ${aWins ? 'bg-elvora-success/5 border border-elvora-success/20' : 'bg-white/5'}`}>
                        <div className="text-[10px] text-elvora-text-dim uppercase mb-1">Variante A {aWins && test.variant_a_sent > 5 ? '← Besser' : ''}</div>
                        <div className="text-xs text-elvora-text font-medium truncate mb-2">&quot;{test.subject_a}&quot;</div>
                        <div className="flex gap-3 text-[11px]">
                          <span className="text-elvora-text-dim">{test.variant_a_sent} gesendet</span>
                          <span className="text-elvora-warning">{openRateA}% geöffnet</span>
                          <span className="text-elvora-success">{replyRateA}% geantwortet</span>
                        </div>
                      </div>
                      <div className={`p-3 rounded-lg ${!aWins ? 'bg-elvora-success/5 border border-elvora-success/20' : 'bg-white/5'}`}>
                        <div className="text-[10px] text-elvora-text-dim uppercase mb-1">Variante B {!aWins && test.variant_b_sent > 5 ? '← Besser' : ''}</div>
                        <div className="text-xs text-elvora-text font-medium truncate mb-2">&quot;{test.subject_b}&quot;</div>
                        <div className="flex gap-3 text-[11px]">
                          <span className="text-elvora-text-dim">{test.variant_b_sent} gesendet</span>
                          <span className="text-elvora-warning">{openRateB}% geöffnet</span>
                          <span className="text-elvora-success">{replyRateB}% geantwortet</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
