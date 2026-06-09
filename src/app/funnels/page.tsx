'use client';

import { useState, useEffect, useCallback } from 'react';

interface Funnel {
  id: number;
  slug: string;
  name: string;
  is_active: number;
  lead_count: number;
  created_at: string;
  updated_at: string;
}

interface StepStat {
  step: string;
  views: number;
  completes: number;
  drops: number;
}

export default function FunnelsPage() {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [selectedFunnel, setSelectedFunnel] = useState<Funnel | null>(null);
  const [stepStats, setStepStats] = useState<StepStat[]>([]);
  const [configJson, setConfigJson] = useState('');
  const [editTab, setEditTab] = useState<'analytics' | 'config' | 'embed'>('analytics');
  const [saving, setSaving] = useState(false);
  const [copyDone, setCopyDone] = useState('');

  const loadFunnels = useCallback(async () => {
    try {
      const res = await fetch('/api/funnel');
      if (res.ok) {
        const data = await res.json();
        setFunnels(data.funnels || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadFunnels(); }, [loadFunnels]);

  const loadAnalytics = async (funnelId: number) => {
    try {
      const res = await fetch(`/api/funnel/analytics?funnelId=${funnelId}`);
      if (res.ok) {
        const data = await res.json();
        setStepStats(data.steps || []);
      }
    } catch { setStepStats([]); }
  };

  const selectFunnel = async (f: Funnel) => {
    setSelectedFunnel(f);
    setEditTab('analytics');
    loadAnalytics(f.id);
    try {
      const res = await fetch(`/api/funnel/${f.slug}`);
      if (res.ok) {
        const data = await res.json();
        setConfigJson(JSON.stringify(data.config, null, 2));
      }
    } catch { /* silent */ }
  };

  const createFunnel = async () => {
    setError('');
    if (!newName.trim() || !newSlug.trim()) { setError('Name und Slug erforderlich'); return; }
    setCreating(true);
    try {
      const defaultConfig = {
        branding: { companyName: newName, primaryColor: '#8B5CF6' },
        meta: { title: newName, privacyUrl: '/datenschutz' },
        steps: [
          { id: 'interesse', type: 'single-choice', question: 'Was interessiert Sie?', options: [{ value: 'beratung', label: 'Beratung' }, { value: 'angebot', label: 'Angebot' }] },
          { id: 'kontakt', type: 'contact', question: 'Wie erreichen wir Sie?', fields: { name: true, email: { required: true }, phone: true } },
        ],
        submitButton: { label: 'Absenden' },
        thankYou: { headline: 'Vielen Dank!', body: 'Wir melden uns in Kürze.' },
        notify: {},
        retentionDays: 90,
      };
      const res = await fetch('/api/funnel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, slug: newSlug, config: defaultConfig }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Fehler');
      } else {
        setShowCreate(false);
        setNewName('');
        setNewSlug('');
        loadFunnels();
      }
    } catch { setError('Netzwerkfehler'); }
    setCreating(false);
  };

  const toggleActive = async (f: Funnel) => {
    await fetch(`/api/funnel/${f.slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: f.is_active ? 0 : 1 }),
    });
    loadFunnels();
  };

  const deleteFunnel = async (f: Funnel) => {
    if (!confirm(`"${f.name}" wirklich löschen?`)) return;
    await fetch(`/api/funnel/${f.slug}`, { method: 'DELETE' });
    if (selectedFunnel?.id === f.id) setSelectedFunnel(null);
    loadFunnels();
  };

  const saveConfig = async () => {
    if (!selectedFunnel) return;
    setSaving(true);
    setError('');
    try {
      const parsed = JSON.parse(configJson);
      const res = await fetch(`/api/funnel/${selectedFunnel.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: parsed }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error || 'Fehler');
      } else {
        setError('');
      }
    } catch { setError('Ungültiges JSON'); }
    setSaving(false);
  };

  const copyEmbed = (mode: 'inline' | 'popup') => {
    if (!selectedFunnel) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    let code: string;
    if (mode === 'inline') {
      code = `<div id="elvora-funnel"></div>\n<script src="${origin}/elvora-funnel.js" data-url="${origin}" data-slug="${selectedFunnel.slug}" data-mode="inline" data-target="#elvora-funnel" defer><\/script>`;
    } else {
      code = `<script src="${origin}/elvora-funnel.js" data-url="${origin}" data-slug="${selectedFunnel.slug}" data-mode="popup" defer><\/script>`;
    }
    navigator.clipboard.writeText(code);
    setCopyDone(mode);
    setTimeout(() => setCopyDone(''), 2000);
  };

  const maxViews = Math.max(1, ...stepStats.map(s => s.views));

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Funnels</h1>
          <p className="text-sm text-elvora-text-muted mt-0.5">Lead-Funnels verwalten und analysieren</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-9 px-4 rounded-lg text-sm font-semibold bg-gradient-to-r from-elvora-purple to-elvora-pink text-white hover:brightness-110 transition-all"
        >
          + Neuer Funnel
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 bg-elvora-card border border-elvora-border rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">Neuen Funnel erstellen</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-elvora-text-muted mb-1 block">Name</label>
              <input
                value={newName}
                onChange={e => { setNewName(e.target.value); setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')); }}
                className="w-full h-9 px-3 text-sm bg-elvora-bg border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none"
                placeholder="Mein Funnel"
              />
            </div>
            <div>
              <label className="text-xs text-elvora-text-muted mb-1 block">Slug</label>
              <input
                value={newSlug}
                onChange={e => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full h-9 px-3 text-sm bg-elvora-bg border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none font-mono"
                placeholder="mein-funnel"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
          <div className="flex gap-2">
            <button onClick={createFunnel} disabled={creating} className="h-8 px-4 rounded-lg text-xs font-semibold bg-elvora-purple text-white hover:bg-elvora-purple/80 disabled:opacity-50">
              {creating ? 'Erstelle...' : 'Erstellen'}
            </button>
            <button onClick={() => { setShowCreate(false); setError(''); }} className="h-8 px-4 rounded-lg text-xs text-elvora-text-muted hover:text-white hover:bg-elvora-card transition-colors">
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Funnel list */}
        <div className="xl:col-span-1 space-y-2">
          {loading ? (
            <div className="text-sm text-elvora-text-dim py-8 text-center">Laden...</div>
          ) : funnels.length === 0 ? (
            <div className="text-sm text-elvora-text-dim py-8 text-center">Noch keine Funnels erstellt.</div>
          ) : funnels.map(f => (
            <div
              key={f.id}
              onClick={() => selectFunnel(f)}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                selectedFunnel?.id === f.id
                  ? 'bg-elvora-purple/[0.08] border-elvora-purple/30'
                  : 'bg-elvora-card border-elvora-border hover:border-elvora-border-hover'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white truncate">{f.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                  f.is_active ? 'bg-green-500/10 text-green-400' : 'bg-elvora-text-dim/10 text-elvora-text-dim'
                }`}>
                  {f.is_active ? 'Aktiv' : 'Inaktiv'}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-elvora-text-muted">
                <span className="font-mono text-elvora-text-dim">/{f.slug}</span>
                <span>{f.lead_count} Leads</span>
              </div>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div className="xl:col-span-2">
          {selectedFunnel ? (
            <div className="bg-elvora-card border border-elvora-border rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-elvora-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">{selectedFunnel.name}</h2>
                  <p className="text-xs text-elvora-text-dim font-mono mt-0.5">/{selectedFunnel.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/funnel/${selectedFunnel.slug}`}
                    target="_blank"
                    className="h-7 px-3 rounded-md text-[11px] font-medium bg-elvora-bg border border-elvora-border text-elvora-text-muted hover:text-white transition-colors inline-flex items-center gap-1"
                  >
                    Vorschau
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                  </a>
                  <button
                    onClick={() => toggleActive(selectedFunnel)}
                    className={`h-7 px-3 rounded-md text-[11px] font-medium transition-colors ${
                      selectedFunnel.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                    }`}
                  >
                    {selectedFunnel.is_active ? 'Deaktivieren' : 'Aktivieren'}
                  </button>
                  <button
                    onClick={() => deleteFunnel(selectedFunnel)}
                    className="h-7 px-3 rounded-md text-[11px] font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    Löschen
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-elvora-border">
                {(['analytics', 'config', 'embed'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setEditTab(tab)}
                    className={`px-5 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                      editTab === tab ? 'border-elvora-purple text-white' : 'border-transparent text-elvora-text-muted hover:text-white'
                    }`}
                  >
                    {tab === 'analytics' ? 'Analytics' : tab === 'config' ? 'Config' : 'Einbetten'}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {editTab === 'analytics' && (
                  <div>
                    <h3 className="text-xs font-semibold text-elvora-text-muted uppercase tracking-wider mb-4">Step-Analyse (Drop-Off)</h3>
                    {stepStats.length === 0 ? (
                      <p className="text-sm text-elvora-text-dim">Noch keine Events erfasst.</p>
                    ) : (
                      <div className="space-y-3">
                        {stepStats.map((s, i) => {
                          const dropRate = s.views > 0 ? ((s.drops / s.views) * 100).toFixed(1) : '0';
                          const convRate = s.views > 0 ? ((s.completes / s.views) * 100).toFixed(1) : '0';
                          return (
                            <div key={s.step}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm text-white font-medium">
                                  <span className="text-elvora-text-dim mr-1.5">{i + 1}.</span>
                                  {s.step}
                                </span>
                                <div className="flex items-center gap-3 text-xs">
                                  <span className="text-elvora-text-muted">{s.views} Views</span>
                                  <span className="text-green-400">{convRate}% weiter</span>
                                  <span className="text-red-400">{dropRate}% Abbruch</span>
                                </div>
                              </div>
                              <div className="h-2 bg-elvora-bg rounded-full overflow-hidden">
                                <div className="h-full bg-elvora-purple/60 rounded-full transition-all" style={{ width: `${(s.views / maxViews) * 100}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {editTab === 'config' && (
                  <div>
                    <textarea
                      value={configJson}
                      onChange={e => setConfigJson(e.target.value)}
                      className="w-full h-[400px] p-3 text-xs font-mono bg-elvora-bg border border-elvora-border rounded-lg text-elvora-text focus:border-elvora-purple/50 focus:outline-none resize-y"
                      spellCheck={false}
                    />
                    {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
                    <button
                      onClick={saveConfig}
                      disabled={saving}
                      className="mt-3 h-8 px-4 rounded-lg text-xs font-semibold bg-elvora-purple text-white hover:bg-elvora-purple/80 disabled:opacity-50"
                    >
                      {saving ? 'Speichern...' : 'Config speichern'}
                    </button>
                  </div>
                )}

                {editTab === 'embed' && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="text-xs font-semibold text-white mb-2">Standalone-Seite</h4>
                      <p className="text-xs text-elvora-text-muted mb-2">
                        Link teilen — der Funnel läuft als eigenständige Seite:
                      </p>
                      <code className="block text-xs font-mono text-elvora-purple bg-elvora-bg border border-elvora-border rounded-lg px-3 py-2 break-all">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/funnel/{selectedFunnel.slug}
                      </code>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-white mb-2">Inline-Embed</h4>
                      <p className="text-xs text-elvora-text-muted mb-2">
                        Funnel direkt in eine bestehende Seite einbetten:
                      </p>
                      <button onClick={() => copyEmbed('inline')} className="h-7 px-3 rounded-md text-[11px] font-medium bg-elvora-purple/10 text-elvora-purple hover:bg-elvora-purple/20 transition-colors">
                        {copyDone === 'inline' ? 'Kopiert!' : 'Code kopieren'}
                      </button>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-white mb-2">Popup-Embed</h4>
                      <p className="text-xs text-elvora-text-muted mb-2">
                        Floating-Button unten rechts — Funnel öffnet als Overlay:
                      </p>
                      <button onClick={() => copyEmbed('popup')} className="h-7 px-3 rounded-md text-[11px] font-medium bg-elvora-purple/10 text-elvora-purple hover:bg-elvora-purple/20 transition-colors">
                        {copyDone === 'popup' ? 'Kopiert!' : 'Code kopieren'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-sm text-elvora-text-dim">
              Funnel auswählen, um Details zu sehen.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
