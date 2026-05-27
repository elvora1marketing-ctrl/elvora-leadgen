'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface PortalData {
  account: { name: string; company: string | null; status: string };
  stats: {
    totalLeads: number;
    leadsWithEmail: number;
    totalCampaigns: number;
    activeCampaigns: number;
    totalSent: number;
    totalOpened: number;
    totalReplied: number;
    totalBounced: number;
    sentToday: number;
    dailyCapacity: number;
  };
  campaigns: {
    id: number;
    name: string;
    status: string;
    sent_count: number;
    open_count: number;
    reply_count: number;
    bounce_count: number;
    created_at: string;
  }[];
}

export default function AccountPortalPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/account-portal/${token}`)
      .then(r => {
        if (!r.ok) throw new Error('Portal nicht gefunden');
        return r.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-elvora-darker flex items-center justify-center">
        <div className="text-elvora-text-muted">Laden...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-elvora-darker flex items-center justify-center">
        <div className="card-glass p-8 rounded-xl text-center max-w-md">
          <h1 className="text-xl font-bold text-white mb-2">Portal nicht verfügbar</h1>
          <p className="text-elvora-text-muted">{error || 'Ungültiger Link'}</p>
        </div>
      </div>
    );
  }

  const { account, stats, campaigns } = data;
  const openRate = stats.totalSent > 0 ? ((stats.totalOpened / stats.totalSent) * 100).toFixed(1) : '0';
  const replyRate = stats.totalSent > 0 ? ((stats.totalReplied / stats.totalSent) * 100).toFixed(1) : '0';
  const bounceRate = stats.totalSent > 0 ? ((stats.totalBounced / stats.totalSent) * 100).toFixed(1) : '0';

  return (
    <div className="min-h-screen bg-elvora-darker">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="text-center py-6">
          <h1 className="text-3xl font-bold text-white">{account.company || account.name}</h1>
          <p className="text-elvora-text-muted mt-1">Outreach Report</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-glass p-5 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Gesendet</p>
            <p className="text-3xl font-bold text-white mt-2">{stats.totalSent.toLocaleString('de-DE')}</p>
          </div>
          <div className="card-glass p-5 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Öffnungsrate</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{openRate}%</p>
          </div>
          <div className="card-glass p-5 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Antwortrate</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{replyRate}%</p>
          </div>
          <div className="card-glass p-5 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Bouncerate</p>
            <p className="text-3xl font-bold text-red-400 mt-2">{bounceRate}%</p>
          </div>
        </div>

        {/* Today's Sending */}
        {stats.dailyCapacity > 0 && (
          <div className="card-glass p-5 rounded-xl">
            <div className="flex justify-between text-sm mb-3">
              <span className="text-elvora-text-muted">Heutiger Versand</span>
              <span className="text-white font-medium">{stats.sentToday} / {stats.dailyCapacity} E-Mails</span>
            </div>
            <div className="w-full h-3 bg-elvora-darker rounded-full overflow-hidden">
              <div className="h-full bg-elvora-accent rounded-full transition-all"
                style={{ width: `${Math.min(100, (stats.sentToday / stats.dailyCapacity) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Lead Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="card-glass p-5 rounded-xl">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Leads gesamt</p>
            <p className="text-2xl font-bold text-white mt-2">{stats.totalLeads.toLocaleString('de-DE')}</p>
            <p className="text-elvora-text-muted text-xs mt-1">davon {stats.leadsWithEmail} mit E-Mail</p>
          </div>
          <div className="card-glass p-5 rounded-xl">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Kampagnen</p>
            <p className="text-2xl font-bold text-white mt-2">{stats.totalCampaigns}</p>
            <p className="text-elvora-text-muted text-xs mt-1">davon {stats.activeCampaigns} aktiv</p>
          </div>
        </div>

        {/* Campaigns Table */}
        {campaigns.length > 0 && (
          <div className="card-glass rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-white/10">
              <h2 className="text-sm font-semibold text-white">Kampagnen</h2>
            </div>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-elvora-text-muted text-xs uppercase">
                  <th className="px-5 py-2">Name</th>
                  <th className="px-5 py-2">Status</th>
                  <th className="px-5 py-2">Gesendet</th>
                  <th className="px-5 py-2">Geöffnet</th>
                  <th className="px-5 py-2">Antworten</th>
                  <th className="px-5 py-2">Bounces</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id} className="border-b border-white/5">
                    <td className="px-5 py-3 text-white">{c.name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${c.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-white">{c.sent_count}</td>
                    <td className="px-5 py-3 text-yellow-400">{c.open_count}</td>
                    <td className="px-5 py-3 text-green-400">{c.reply_count}</td>
                    <td className="px-5 py-3 text-red-400">{c.bounce_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-elvora-text-muted text-xs">Powered by Elvora</p>
        </div>
      </div>
    </div>
  );
}
