'use client';

import { useState, useEffect } from 'react';

interface Client {
  id: number;
  lead_id: number;
  token: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  project_type: string | null;
  project_value: number | null;
  monthly_value: number;
  status: string;
  progress_phase: string;
  questionnaire_data: string | null;
  created_at: string;
  lead_name: string;
  lead_city: string;
  lead_website: string | null;
}

interface MrrData {
  current_mrr: number;
  active_clients: number;
  churned_clients: number;
  churn_rate: number;
  annual_projection: number;
  goal: {
    target: number;
    progress: number;
    on_track: boolean;
    months_left: number;
    won_value: number;
    projected_total: number;
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  onboarding: { label: 'Onboarding', color: 'bg-elvora-accent/15 text-elvora-accent' },
  active: { label: 'Aktiv', color: 'bg-elvora-success/15 text-elvora-success' },
  paused: { label: 'Pausiert', color: 'bg-elvora-warning/15 text-elvora-warning' },
  completed: { label: 'Abgeschlossen', color: 'bg-elvora-purple/15 text-elvora-purple-light' },
  churned: { label: 'Churned', color: 'bg-red-500/15 text-red-400' },
};

const phaseLabels: Record<string, string> = {
  kickoff: 'Kickoff',
  design: 'Design',
  development: 'Entwicklung',
  review: 'Review',
  launch: 'Launch',
  done: 'Fertig',
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [mrr, setMrr] = useState<MrrData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [copiedLink, setCopiedLink] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/mrr').then(r => r.json()),
    ]).then(([clientsData, mrrData]) => {
      setClients(clientsData.clients || []);
      setMrr(mrrData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = filter === 'all' ? clients : clients.filter(c => c.status === filter);
  const avgValue = clients.length > 0 ? clients.reduce((sum, c) => sum + (c.monthly_value || 0), 0) / clients.filter(c => c.monthly_value > 0).length || 0 : 0;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Kunden</h1>
        <p className="text-sm text-elvora-text-dim mt-0.5">Alle Kunden-Projekte und Recurring Revenue</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Aktive Kunden</div>
          <div className="text-2xl font-bold text-white mt-1">{mrr?.active_clients || 0}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">MRR</div>
          <div className="text-2xl font-bold text-elvora-success mt-1">{(mrr?.current_mrr || 0).toLocaleString('de-DE')} €</div>
          <div className="text-[10px] text-elvora-text-dim mt-0.5">= {(mrr?.annual_projection || 0).toLocaleString('de-DE')} €/Jahr</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Ø Monatswert</div>
          <div className="text-2xl font-bold text-white mt-1">{Math.round(avgValue).toLocaleString('de-DE')} €</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Churn-Rate</div>
          <div className={`text-2xl font-bold mt-1 ${(mrr?.churn_rate || 0) > 10 ? 'text-red-400' : 'text-elvora-success'}`}>
            {mrr?.churn_rate || 0}%
          </div>
        </div>
      </div>

      {/* 50k Goal */}
      {mrr?.goal && (
        <div className="card rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-elvora-text-dim font-medium">50k-Ziel bis Mai 2027</span>
            <span className={`text-xs font-bold ${mrr.goal.on_track ? 'text-elvora-success' : 'text-elvora-warning'}`}>
              {mrr.goal.on_track ? 'Auf Kurs' : 'Mehr Kunden nötig'} · {mrr.goal.progress}%
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-elvora-purple to-elvora-success transition-all" style={{ width: `${Math.min(100, mrr.goal.progress)}%` }} />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-elvora-text-dim">
            <span>Won: {mrr.goal.won_value.toLocaleString('de-DE')} € + MRR-Projektion: {Math.round(mrr.goal.projected_total - mrr.goal.won_value).toLocaleString('de-DE')} €</span>
            <span>50.000 €</span>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1.5 flex-wrap">
        {[{ key: 'all', label: 'Alle' }, ...Object.entries(statusConfig).map(([key, v]) => ({ key, label: v.label }))].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-elvora-purple/15 text-elvora-purple-light' : 'bg-white/5 text-elvora-text-dim hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Client Table */}
      {filtered.length === 0 ? (
        <div className="card rounded-xl p-8 text-center">
          <p className="text-elvora-text-dim text-sm">Noch keine Kunden</p>
          <p className="text-elvora-text-dim text-xs mt-1">Kunden werden automatisch erstellt, wenn du einen Lead auf &quot;Gewonnen&quot; setzt.</p>
        </div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-elvora-border">
                  <th className="text-left px-4 py-3 text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold">Kunde</th>
                  <th className="text-left px-4 py-3 text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold">Phase</th>
                  <th className="text-right px-4 py-3 text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold">Einmalig</th>
                  <th className="text-right px-4 py-3 text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold">MRR</th>
                  <th className="text-center px-4 py-3 text-[10px] text-elvora-text-dim uppercase tracking-wider font-semibold">Portal</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const sc = statusConfig[c.status] || statusConfig.onboarding;
                  return (
                    <tr key={c.id} className="border-b border-elvora-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-sm text-white font-medium">{c.company_name}</div>
                        <div className="text-[10px] text-elvora-text-dim">{c.lead_city}{c.contact_email ? ` · ${c.contact_email}` : ''}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-elvora-text-muted">{phaseLabels[c.progress_phase] || c.progress_phase}</td>
                      <td className="px-4 py-3 text-right text-xs text-white font-mono">{c.project_value ? `${c.project_value.toLocaleString('de-DE')} €` : '-'}</td>
                      <td className="px-4 py-3 text-right text-xs font-mono font-bold text-elvora-success">{c.monthly_value > 0 ? `${c.monthly_value.toLocaleString('de-DE')} €` : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/client/${c.token}`); setCopiedLink(c.id); setTimeout(() => setCopiedLink(null), 2000); }}
                          className="text-xs text-elvora-purple-light hover:underline"
                        >
                          {copiedLink === c.id ? '✓' : 'Link'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
