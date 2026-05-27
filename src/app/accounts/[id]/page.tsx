'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Account {
  id: number;
  name: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  status: string;
  monthly_fee: number;
  portal_token: string | null;
  onboarding_completed: number;
}

interface Stats {
  totalLeads: number;
  leadsWithEmail: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalBounced: number;
  activeDomains: number;
  activeSequences: number;
  blacklistCount: number;
  sentToday: number;
  dailyCapacity: number;
}

interface Campaign {
  id: number; name: string; status: string;
  sent_count: number; open_count: number; reply_count: number; bounce_count: number;
  created_at: string;
}

interface Domain {
  id: number; domain: string; status: string; health_score: number;
  warm_current_day: number; sent_today: number; daily_limit: number; sent_total: number;
}

interface Lead {
  id: number; name: string; email: string | null; company: string | null;
  city: string | null; contact_status: string; score: number; created_at: string;
}

interface Sequence {
  id: number; name: string; status: string;
  active_count: number; completed_count: number; replied_count: number;
}

interface DailySend { day: string; count: number; }

const STATUS_COLORS: Record<string, string> = {
  onboarding: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-gray-500/20 text-gray-400',
  churned: 'bg-red-500/20 text-red-400',
};

const CONTACT_COLORS: Record<string, string> = {
  not_contacted: 'text-gray-400',
  email_sent: 'text-blue-400',
  replied: 'text-green-400',
  meeting: 'text-purple-400',
  won: 'text-emerald-400',
  lost: 'text-red-400',
};

export default function AccountDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.id as string;

  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [dailySends, setDailySends] = useState<DailySend[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/accounts/${accountId}/stats`)
      .then(r => r.json())
      .then(data => {
        setAccount(data.account);
        setStats(data.stats);
        setCampaigns(data.campaigns || []);
        setDomains(data.domains || []);
        setLeads(data.recentLeads || []);
        setSequences(data.sequences || []);
        setDailySends(data.dailySends || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accountId]);

  if (loading) return <div className="p-6 text-elvora-text-muted text-center py-12">Laden...</div>;
  if (!account) return <div className="p-6 text-red-400 text-center py-12">Konto nicht gefunden</div>;

  const openRate = stats && stats.totalSent > 0 ? ((stats.totalOpened / stats.totalSent) * 100).toFixed(1) : '0';
  const replyRate = stats && stats.totalSent > 0 ? ((stats.totalReplied / stats.totalSent) * 100).toFixed(1) : '0';
  const bounceRate = stats && stats.totalSent > 0 ? ((stats.totalBounced / stats.totalSent) * 100).toFixed(1) : '0';
  const maxSend = Math.max(...dailySends.map(d => d.count), 1);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/accounts')} className="text-elvora-text-muted hover:text-white transition">←</button>
            <h1 className="text-2xl font-bold text-white">{account.name}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[account.status] || ''}`}>{account.status}</span>
          </div>
          {account.company && <p className="text-elvora-text-muted text-sm mt-1 ml-8">{account.company}</p>}
        </div>
        <div className="flex gap-2">
          {account.portal_token && (
            <button onClick={() => window.open(`/account-portal/${account.portal_token}`, '_blank')}
              className="px-3 py-1.5 rounded-lg bg-elvora-darker text-elvora-text-muted hover:text-white text-xs transition">
              Portal öffnen
            </button>
          )}
          {!account.onboarding_completed && (
            <button onClick={() => router.push(`/accounts/onboarding?id=${accountId}`)}
              className="px-3 py-1.5 rounded-lg bg-elvora-accent/20 text-elvora-accent text-xs transition">
              Onboarding
            </button>
          )}
        </div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Leads', value: stats?.totalLeads || 0, color: 'text-white' },
          { label: 'Gesendet', value: stats?.totalSent || 0, color: 'text-blue-400' },
          { label: 'Öffnungsrate', value: `${openRate}%`, color: 'text-yellow-400' },
          { label: 'Antwortrate', value: `${replyRate}%`, color: 'text-green-400' },
          { label: 'Bouncerate', value: `${bounceRate}%`, color: 'text-red-400' },
          { label: 'MRR', value: `${account.monthly_fee.toLocaleString('de-DE')} €`, color: 'text-elvora-accent' },
        ].map(k => (
          <div key={k.label} className="card-glass p-4 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-bold ${k.color} mt-1`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Sending Capacity + Daily Chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats && stats.dailyCapacity > 0 && (
          <div className="card-glass p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Heutiger Versand</h3>
            <div className="flex justify-between text-xs text-elvora-text-muted mb-2">
              <span>{stats.sentToday} gesendet</span>
              <span>{stats.dailyCapacity} Kapazität</span>
            </div>
            <div className="w-full h-3 bg-elvora-darker rounded-full overflow-hidden">
              <div className="h-full bg-elvora-accent rounded-full transition-all"
                style={{ width: `${Math.min(100, (stats.sentToday / stats.dailyCapacity) * 100)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div><p className="text-xs text-elvora-text-muted">Domains</p><p className="text-sm font-medium text-white">{stats.activeDomains}</p></div>
              <div><p className="text-xs text-elvora-text-muted">Sequences</p><p className="text-sm font-medium text-white">{stats.activeSequences}</p></div>
              <div><p className="text-xs text-elvora-text-muted">Blacklist</p><p className="text-sm font-medium text-white">{stats.blacklistCount}</p></div>
            </div>
          </div>
        )}

        {dailySends.length > 0 && (
          <div className="card-glass p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-3">Versand letzte 7 Tage</h3>
            <div className="flex items-end gap-1 h-24">
              {dailySends.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-elvora-text-muted">{d.count}</span>
                  <div className="w-full bg-elvora-accent/80 rounded-t" style={{ height: `${(d.count / maxSend) * 80}px` }} />
                  <span className="text-[10px] text-elvora-text-muted">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Campaigns + Domains side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Campaigns */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
            <h3 className="text-sm font-semibold text-white">Kampagnen ({campaigns.length})</h3>
            <span className="text-xs text-elvora-text-muted">{stats?.activeCampaigns || 0} aktiv</span>
          </div>
          {campaigns.length === 0 ? (
            <div className="p-4 text-elvora-text-muted text-sm text-center">Keine Kampagnen</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {campaigns.map(c => (
                <div key={c.id} className="px-4 py-2.5 border-b border-white/5 hover:bg-white/5 transition">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm">{c.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${c.status === 'running' ? 'bg-green-500/20 text-green-400' : c.status === 'completed' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>{c.status}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-elvora-text-muted">
                    <span>{c.sent_count} gesendet</span>
                    <span className="text-yellow-400">{c.open_count} geöffnet</span>
                    <span className="text-green-400">{c.reply_count} Antworten</span>
                    <span className="text-red-400">{c.bounce_count} Bounces</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Domains */}
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Domains ({domains.length})</h3>
          </div>
          {domains.length === 0 ? (
            <div className="p-4 text-elvora-text-muted text-sm text-center">Keine Domains</div>
          ) : (
            <div className="max-h-64 overflow-y-auto">
              {domains.map((d: Domain) => (
                <div key={d.id} className="px-4 py-2.5 border-b border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm">{d.domain}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${d.status === 'active' ? 'bg-green-500/20 text-green-400' : d.status === 'warming' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>{d.status}</span>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-elvora-text-muted">
                    <span>Health: {d.health_score}%</span>
                    <span>{d.sent_today}/{d.daily_limit} heute</span>
                    <span>{d.sent_total} gesamt</span>
                    {d.status === 'warming' && <span className="text-yellow-400">Tag {d.warm_current_day}/15</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sequences */}
      {sequences.length > 0 && (
        <div className="card-glass rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white">Sequences ({sequences.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            {sequences.map((s: Sequence) => (
              <div key={s.id} className="px-4 py-3 border-b border-white/5 md:border-r md:border-white/5">
                <p className="text-white text-sm font-medium">{s.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-elvora-text-muted">
                  <span className="text-blue-400">{s.active_count} aktiv</span>
                  <span className="text-green-400">{s.completed_count} fertig</span>
                  <span className="text-purple-400">{s.replied_count} Antworten</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Leads */}
      <div className="card-glass rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center">
          <h3 className="text-sm font-semibold text-white">Letzte Leads</h3>
          <span className="text-xs text-elvora-text-muted">{stats?.totalLeads || 0} gesamt, {stats?.leadsWithEmail || 0} mit E-Mail</span>
        </div>
        {leads.length === 0 ? (
          <div className="p-4 text-elvora-text-muted text-sm text-center">Keine Leads</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-elvora-text-muted text-xs uppercase">
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Firma</th>
                <th className="px-4 py-2">Ort</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Score</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l: Lead) => (
                <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => router.push(`/leads?id=${l.id}`)}>
                  <td className="px-4 py-2">
                    <div className="text-white">{l.name}</div>
                    {l.email && <div className="text-elvora-text-muted text-xs">{l.email}</div>}
                  </td>
                  <td className="px-4 py-2 text-elvora-text-muted">{l.company || '—'}</td>
                  <td className="px-4 py-2 text-elvora-text-muted">{l.city || '—'}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs ${CONTACT_COLORS[l.contact_status] || 'text-gray-400'}`}>{l.contact_status}</span>
                  </td>
                  <td className="px-4 py-2 text-white">{l.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
