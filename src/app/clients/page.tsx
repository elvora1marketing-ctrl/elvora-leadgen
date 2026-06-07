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
  dashboard_enabled?: number;
  lead_value?: number;
  form_slugs?: string;
  chat_widget_ids?: string;
}

interface FormOption { slug: string; name: string }
interface WidgetOption { id: number; name: string }

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
  const [configClient, setConfigClient] = useState<Client | null>(null);
  const [formOptions, setFormOptions] = useState<FormOption[]>([]);
  const [widgetOptions, setWidgetOptions] = useState<WidgetOption[]>([]);

  const reloadClients = () => fetch('/api/clients').then(r => r.json()).then(d => setClients(d.clients || [])).catch(() => {});

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then(r => r.json()),
      fetch('/api/mrr').then(r => r.json()),
    ]).then(([clientsData, mrrData]) => {
      setClients(clientsData.clients || []);
      setMrr(mrrData);
    }).catch(() => {}).finally(() => setLoading(false));

    // Load available lead sources for dashboard config
    fetch('/api/contact-form?action=forms').then(r => r.json())
      .then(d => setFormOptions((d.forms || []).map((f: { slug: string; name: string }) => ({ slug: f.slug, name: f.name }))))
      .catch(() => {});
    fetch('/api/chat?action=widgets').then(r => r.json())
      .then(d => setWidgetOptions((d.widgets || []).map((w: { id: number; name: string }) => ({ id: w.id, name: w.name }))))
      .catch(() => {});
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
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/client/${c.token}`); setCopiedLink(c.id); setTimeout(() => setCopiedLink(null), 2000); }}
                            className="text-xs text-elvora-purple-light hover:underline"
                          >
                            {copiedLink === c.id ? '✓' : 'Link'}
                          </button>
                          <button
                            onClick={() => setConfigClient(c)}
                            className={`text-xs hover:underline ${c.dashboard_enabled ? 'text-elvora-success' : 'text-elvora-text-dim'}`}
                            title="Live-ROI Dashboard konfigurieren"
                          >
                            {c.dashboard_enabled ? '📊 Aktiv' : '📊 Dashboard'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {configClient && (
        <DashboardConfigModal
          client={configClient}
          formOptions={formOptions}
          widgetOptions={widgetOptions}
          onClose={() => setConfigClient(null)}
          onSaved={() => { setConfigClient(null); reloadClients(); }}
        />
      )}
    </div>
  );
}

function parseJsonArr(s: string | undefined): (string | number)[] {
  try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

function DashboardConfigModal({ client, formOptions, widgetOptions, onClose, onSaved }: {
  client: Client;
  formOptions: FormOption[];
  widgetOptions: WidgetOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(!!client.dashboard_enabled);
  const [leadValue, setLeadValue] = useState(String(client.lead_value || 0));
  const [slugs, setSlugs] = useState<string[]>(parseJsonArr(client.form_slugs) as string[]);
  const [widgetIds, setWidgetIds] = useState<number[]>(parseJsonArr(client.chat_widget_ids) as number[]);
  const [saving, setSaving] = useState(false);

  const toggleSlug = (slug: string) => setSlugs(p => p.includes(slug) ? p.filter(s => s !== slug) : [...p, slug]);
  const toggleWidget = (id: number) => setWidgetIds(p => p.includes(id) ? p.filter(w => w !== id) : [...p, id]);

  const save = async () => {
    setSaving(true);
    try {
      await fetch(`/api/clients/${client.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboard_enabled: enabled,
          lead_value: Number(leadValue) || 0,
          form_slugs: slugs,
          chat_widget_ids: widgetIds,
        }),
      });
      onSaved();
    } catch { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">Live-ROI Dashboard</h2>
          <button onClick={onClose} className="text-elvora-text-dim hover:text-white text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-elvora-text-dim mb-5">{client.company_name}</p>

        <div className="space-y-5">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium text-elvora-text">Dashboard aktivieren</div>
              <div className="text-xs text-elvora-text-dim">Kunde sieht Leads & ROI im Portal</div>
            </div>
            <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="w-4 h-4 accent-elvora-purple" />
          </label>

          <div>
            <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Wert pro Lead (€)</label>
            <input type="number" min="0" value={leadValue} onChange={e => setLeadValue(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-elvora-bg-alt border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none" />
            <p className="text-[11px] text-elvora-text-dim mt-1">Geschätzter Umsatzwert eines Leads — für die ROI-Anzeige.</p>
          </div>

          <div>
            <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Formulare dieses Kunden</label>
            {formOptions.length === 0 ? (
              <p className="text-xs text-elvora-text-dim">Keine Formulare vorhanden.</p>
            ) : (
              <div className="space-y-1.5">
                {formOptions.map(f => (
                  <label key={f.slug} className="flex items-center gap-2 cursor-pointer text-sm text-elvora-text">
                    <input type="checkbox" checked={slugs.includes(f.slug)} onChange={() => toggleSlug(f.slug)} className="w-4 h-4 accent-elvora-purple" />
                    {f.name} <span className="text-elvora-text-dim text-xs">({f.slug})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Chat-Widgets dieses Kunden</label>
            {widgetOptions.length === 0 ? (
              <p className="text-xs text-elvora-text-dim">Keine Chat-Widgets vorhanden.</p>
            ) : (
              <div className="space-y-1.5">
                {widgetOptions.map(w => (
                  <label key={w.id} className="flex items-center gap-2 cursor-pointer text-sm text-elvora-text">
                    <input type="checkbox" checked={widgetIds.includes(w.id)} onChange={() => toggleWidget(w.id)} className="w-4 h-4 accent-elvora-purple" />
                    {w.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <button onClick={save} disabled={saving}
            className="w-full h-10 rounded-lg text-sm font-semibold bg-gradient-to-r from-elvora-purple to-elvora-pink text-white hover:brightness-110 disabled:opacity-50 transition-all">
            {saving ? 'Speichert…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
