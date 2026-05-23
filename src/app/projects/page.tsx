'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

interface Phase {
  key: string;
  label: string;
  icon: string;
}

interface Project {
  id: number;
  token: string;
  title: string;
  description: string | null;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  client_id: number | null;
  lead_id: number | null;
  status: string;
  current_phase: string;
  phases: string;
  total_value: number | null;
  start_date: string | null;
  estimated_end_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectUpdate {
  id: number;
  phase: string;
  title: string;
  description: string | null;
  is_public: number;
  created_at: string;
}

interface Client {
  id: number;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
}

const DEFAULT_PHASES: Phase[] = [
  { key: 'received', label: 'Auftrag erhalten', icon: 'inbox' },
  { key: 'planning', label: 'Planung', icon: 'clipboard' },
  { key: 'design', label: 'Design', icon: 'palette' },
  { key: 'development', label: 'Entwicklung', icon: 'code' },
  { key: 'seo', label: 'SEO-Optimierung', icon: 'search' },
  { key: 'review', label: 'Review & QA', icon: 'check' },
  { key: 'launch', label: 'Launch', icon: 'rocket' },
  { key: 'done', label: 'Abgeschlossen', icon: 'flag' },
];

const PHASE_ICON_OPTIONS = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'clipboard', label: 'Clipboard' },
  { value: 'palette', label: 'Palette' },
  { value: 'code', label: 'Code' },
  { value: 'search', label: 'Suche' },
  { value: 'check', label: 'Check' },
  { value: 'rocket', label: 'Rakete' },
  { value: 'flag', label: 'Flagge' },
];

const fmtDate = (d: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const fmtDateTime = (d: string) => {
  return new Date(d).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const fmtCurrency = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('active');

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    client_id: '',
    total_value: '',
    start_date: new Date().toISOString().split('T')[0],
    estimated_end_date: '',
    notes: '',
  });
  const [createPhases, setCreatePhases] = useState<Phase[]>([...DEFAULT_PHASES]);

  // Detail view
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectUpdates, setProjectUpdates] = useState<ProjectUpdate[]>([]);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateForm, setUpdateForm] = useState({ phase: '', title: '', description: '', is_public: true });

  // Copy feedback
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch('/api/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadProjects(); loadClients(); }, [loadProjects, loadClients]);

  const loadProjectDetail = async (project: Project) => {
    setSelectedProject(project);
    try {
      const res = await fetch(`/api/projects/${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setProjectUpdates(data.updates || []);
      }
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          client_id: createForm.client_id ? parseInt(createForm.client_id) : null,
          total_value: createForm.total_value ? parseFloat(createForm.total_value) : null,
          phases: createPhases,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ title: '', description: '', client_name: '', client_email: '', client_phone: '', client_id: '', total_value: '', start_date: new Date().toISOString().split('T')[0], estimated_end_date: '', notes: '' });
        setCreatePhases([...DEFAULT_PHASES]);
        loadProjects();
      }
    } catch { /* silent */ }
  };

  const handleStatusUpdate = async () => {
    if (!selectedProject || !updateForm.phase) return;
    try {
      const res = await fetch(`/api/projects/${selectedProject.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm),
      });
      if (res.ok) {
        setShowUpdateForm(false);
        setUpdateForm({ phase: '', title: '', description: '', is_public: true });
        loadProjects();
        const detailRes = await fetch(`/api/projects/${selectedProject.id}`);
        if (detailRes.ok) {
          const data = await detailRes.json();
          setSelectedProject(data.project);
          setProjectUpdates(data.updates || []);
        }
      }
    } catch { /* silent */ }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Projekt wirklich löschen?')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (selectedProject?.id === id) setSelectedProject(null);
      loadProjects();
    } catch { /* silent */ }
  };

  const copyTrackingLink = (project: Project) => {
    const url = `${window.location.origin}/tracking/${project.token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(project.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClientSelect = (clientId: string) => {
    setCreateForm(f => ({ ...f, client_id: clientId }));
    if (clientId) {
      const client = clients.find(c => c.id === parseInt(clientId));
      if (client) {
        setCreateForm(f => ({
          ...f,
          client_id: clientId,
          client_name: client.company_name,
          client_email: client.contact_email || '',
        }));
      }
    }
  };

  const addPhase = () => {
    const key = `phase_${Date.now()}`;
    setCreatePhases(p => [...p.slice(0, -1), { key, label: 'Neue Phase', icon: 'check' }, p[p.length - 1]]);
  };

  const removePhase = (index: number) => {
    if (createPhases.length <= 2) return;
    setCreatePhases(p => p.filter((_, i) => i !== index));
  };

  const updatePhase = (index: number, field: keyof Phase, value: string) => {
    setCreatePhases(p => p.map((ph, i) => i === index ? { ...ph, [field]: value, ...(field === 'label' ? { key: value.toLowerCase().replace(/[^a-z0-9]/g, '_') } : {}) } : ph));
  };

  const getPhases = (project: Project): Phase[] => {
    try {
      return typeof project.phases === 'string' ? JSON.parse(project.phases) : project.phases;
    } catch {
      return [];
    }
  };

  const getProgress = (project: Project): number => {
    const phases = getPhases(project);
    if (phases.length <= 1) return 100;
    const idx = phases.findIndex(p => p.key === project.current_phase);
    if (idx < 0) return 0;
    return Math.round((idx / (phases.length - 1)) * 100);
  };

  const filteredProjects = useMemo(() => {
    if (filter === 'all') return projects;
    return projects.filter(p => p.status === filter);
  }, [projects, filter]);

  const stats = useMemo(() => {
    return {
      active: projects.filter(p => p.status === 'active').length,
      total: projects.length,
      totalValue: projects.reduce((sum, p) => sum + (p.total_value || 0), 0),
    };
  }, [projects]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-elvora-text">Projekte</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Auftragsverfolgung & Kundenprojekte</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2 rounded-lg"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Projekt
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card rounded-xl p-4">
          <p className="text-xs text-elvora-text-dim">Aktive Projekte</p>
          <p className="stat-number mt-1">{stats.active}</p>
        </div>
        <div className="card rounded-xl p-4">
          <p className="text-xs text-elvora-text-dim">Gesamt</p>
          <p className="stat-number mt-1">{stats.total}</p>
        </div>
        <div className="card rounded-xl p-4">
          <p className="text-xs text-elvora-text-dim">Gesamtwert</p>
          <p className="stat-number mt-1">{fmtCurrency(stats.totalValue)} &euro;</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: 'active', label: 'Aktiv' },
          { key: 'completed', label: 'Abgeschlossen' },
          { key: 'paused', label: 'Pausiert' },
          { key: 'all', label: 'Alle' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.key ? 'bg-elvora-purple/15 text-elvora-purple-light' : 'text-elvora-text-dim hover:text-elvora-text hover:bg-white/5'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Project list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="card rounded-xl p-8 text-center">
              <div className="w-6 h-6 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="card rounded-xl p-8 text-center">
              <p className="text-sm text-elvora-text-dim">Keine Projekte gefunden</p>
            </div>
          ) : (
            filteredProjects.map(project => {
              const progress = getProgress(project);
              const phases = getPhases(project);
              const currentPhase = phases.find(p => p.key === project.current_phase);
              const isSelected = selectedProject?.id === project.id;

              return (
                <div
                  key={project.id}
                  onClick={() => loadProjectDetail(project)}
                  className={`card rounded-xl p-4 cursor-pointer transition-all hover:border-elvora-purple/30 ${
                    isSelected ? 'border-elvora-purple/50 bg-elvora-purple/5' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-elvora-text truncate">{project.title}</h3>
                      <p className="text-xs text-elvora-text-dim mt-0.5">{project.client_name}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      project.status === 'completed' ? 'bg-emerald-500/15 text-emerald-400' :
                      project.status === 'paused' ? 'bg-yellow-500/15 text-yellow-400' :
                      project.status === 'cancelled' ? 'bg-red-500/15 text-red-400' :
                      'bg-elvora-purple/15 text-elvora-purple-light'
                    }`}>
                      {project.status === 'completed' ? 'Fertig' : project.status === 'paused' ? 'Pausiert' : project.status === 'cancelled' ? 'Storniert' : 'Aktiv'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-2">
                    <div className="h-1.5 bg-elvora-bg-alt rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progress}%`,
                          background: project.status === 'completed' ? '#10b981' : 'linear-gradient(90deg, #7c3aed, #a855f7)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-elvora-text-dim">
                      {currentPhase?.label || project.current_phase} &middot; {progress}%
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyTrackingLink(project); }}
                        className="w-6 h-6 flex items-center justify-center rounded text-elvora-text-dim hover:text-elvora-text hover:bg-white/5"
                        title="Tracking-Link kopieren"
                      >
                        {copiedId === project.id ? (
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {selectedProject ? (
            <div className="card rounded-xl p-5 space-y-5">
              {/* Project header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-elvora-text">{selectedProject.title}</h2>
                  <p className="text-sm text-elvora-text-dim">{selectedProject.client_name}</p>
                  {selectedProject.description && (
                    <p className="text-sm text-elvora-text-dim mt-2">{selectedProject.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyTrackingLink(selectedProject)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-elvora-purple/10 text-elvora-purple-light hover:bg-elvora-purple/20 transition-colors flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    {copiedId === selectedProject.id ? 'Kopiert!' : 'Tracking-Link'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedProject.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10"
                    title="Löschen"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-elvora-bg-alt">
                  <p className="text-[10px] text-elvora-text-dim uppercase">Start</p>
                  <p className="text-elvora-text mt-0.5">{fmtDate(selectedProject.start_date)}</p>
                </div>
                <div className="p-3 rounded-lg bg-elvora-bg-alt">
                  <p className="text-[10px] text-elvora-text-dim uppercase">Geplant bis</p>
                  <p className="text-elvora-text mt-0.5">{fmtDate(selectedProject.estimated_end_date)}</p>
                </div>
                <div className="p-3 rounded-lg bg-elvora-bg-alt">
                  <p className="text-[10px] text-elvora-text-dim uppercase">Wert</p>
                  <p className="text-elvora-text mt-0.5">{selectedProject.total_value ? `${fmtCurrency(selectedProject.total_value)} €` : '-'}</p>
                </div>
                <div className="p-3 rounded-lg bg-elvora-bg-alt">
                  <p className="text-[10px] text-elvora-text-dim uppercase">Fortschritt</p>
                  <p className="text-elvora-text mt-0.5">{getProgress(selectedProject)}%</p>
                </div>
              </div>

              {/* Phase stepper mini */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider">Phasen</h3>
                  <button
                    onClick={() => {
                      const phases = getPhases(selectedProject);
                      const currentIdx = phases.findIndex(p => p.key === selectedProject.current_phase);
                      const nextPhase = phases[currentIdx + 1];
                      if (nextPhase) {
                        setUpdateForm({ phase: nextPhase.key, title: `Phase: ${nextPhase.label}`, description: '', is_public: true });
                        setShowUpdateForm(true);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium btn-primary flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    Status aktualisieren
                  </button>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {getPhases(selectedProject).map((phase, i) => {
                    const phases = getPhases(selectedProject);
                    const currentIdx = phases.findIndex(p => p.key === selectedProject.current_phase);
                    const isDone = i < currentIdx || selectedProject.status === 'completed';
                    const isCurrent = i === currentIdx && selectedProject.status !== 'completed';

                    return (
                      <div key={phase.key} className="flex items-center">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                          isDone ? 'bg-emerald-500/20 text-emerald-400' :
                          isCurrent ? 'bg-elvora-purple/20 text-elvora-purple-light ring-1 ring-elvora-purple/50' :
                          'bg-elvora-bg-alt text-elvora-text-dim border border-elvora-border'
                        }`} title={phase.label}>
                          {isDone ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          ) : (
                            i + 1
                          )}
                        </div>
                        {i < phases.length - 1 && (
                          <div className={`w-4 h-0.5 ${isDone ? 'bg-emerald-500/40' : 'bg-elvora-border'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-elvora-text-dim mt-2">
                  Aktuelle Phase: <span className="text-elvora-text font-medium">
                    {getPhases(selectedProject).find(p => p.key === selectedProject.current_phase)?.label || selectedProject.current_phase}
                  </span>
                </p>
              </div>

              {/* Status update form */}
              {showUpdateForm && (
                <div className="p-4 rounded-lg bg-elvora-bg-alt border border-elvora-border space-y-3">
                  <h3 className="text-sm font-semibold text-elvora-text">Status aktualisieren</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-elvora-text-dim mb-1 block">Phase</label>
                      <select
                        value={updateForm.phase}
                        onChange={e => setUpdateForm(f => ({ ...f, phase: e.target.value }))}
                        className="input-field w-full text-sm"
                      >
                        <option value="">Phase wählen...</option>
                        {getPhases(selectedProject).map(p => (
                          <option key={p.key} value={p.key}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-elvora-text-dim mb-1 block">Titel</label>
                      <input
                        type="text"
                        value={updateForm.title}
                        onChange={e => setUpdateForm(f => ({ ...f, title: e.target.value }))}
                        className="input-field w-full text-sm"
                        placeholder="z.B. Design fertiggestellt"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-elvora-text-dim mb-1 block">Beschreibung (optional)</label>
                    <textarea
                      value={updateForm.description}
                      onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))}
                      className="input-field w-full text-sm"
                      rows={2}
                      placeholder="Details zum Update..."
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs text-elvora-text-dim cursor-pointer">
                      <input
                        type="checkbox"
                        checked={updateForm.is_public}
                        onChange={e => setUpdateForm(f => ({ ...f, is_public: e.target.checked }))}
                        className="rounded border-elvora-border"
                      />
                      Für Kunde sichtbar
                    </label>
                    <div className="flex-1" />
                    <button onClick={() => setShowUpdateForm(false)} className="px-3 py-1.5 text-xs text-elvora-text-dim hover:text-elvora-text">Abbrechen</button>
                    <button onClick={handleStatusUpdate} disabled={!updateForm.phase} className="btn-primary px-4 py-1.5 text-xs rounded-lg disabled:opacity-50">Speichern</button>
                  </div>
                </div>
              )}

              {/* Updates timeline */}
              <div>
                <h3 className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">Verlauf</h3>
                {projectUpdates.length === 0 ? (
                  <p className="text-sm text-elvora-text-dim">Noch keine Updates</p>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {projectUpdates.map(update => {
                      const phases = getPhases(selectedProject);
                      const phaseInfo = phases.find(p => p.key === update.phase);
                      return (
                        <div key={update.id} className="flex gap-3">
                          <div className="w-2 h-2 rounded-full bg-elvora-purple/50 mt-1.5 flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <p className="text-sm font-medium text-elvora-text">{update.title}</p>
                              {phaseInfo && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-elvora-bg-alt text-elvora-text-dim">{phaseInfo.label}</span>
                              )}
                              {!update.is_public && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400">Intern</span>
                              )}
                            </div>
                            {update.description && <p className="text-xs text-elvora-text-dim mt-0.5">{update.description}</p>}
                            <p className="text-[10px] text-elvora-text-dim mt-0.5">{fmtDateTime(update.created_at)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Contact info */}
              {(selectedProject.client_email || selectedProject.client_phone) && (
                <div className="p-3 rounded-lg bg-elvora-bg-alt text-sm">
                  <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-1">Kontakt</p>
                  {selectedProject.client_email && <p className="text-elvora-text-dim">{selectedProject.client_email}</p>}
                  {selectedProject.client_phone && <p className="text-elvora-text-dim">{selectedProject.client_phone}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="card rounded-xl p-12 text-center">
              <svg className="w-12 h-12 text-elvora-text-dim/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-elvora-text-dim">Projekt auswählen oder neues erstellen</p>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-elvora-card rounded-xl border border-elvora-border w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-elvora-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-elvora-text">Neues Projekt erstellen</h2>
              <button onClick={() => setShowCreate(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-elvora-text-dim hover:text-elvora-text hover:bg-white/5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Client selection */}
              {clients.length > 0 && (
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">Bestehender Kunde (optional)</label>
                  <select
                    value={createForm.client_id}
                    onChange={e => handleClientSelect(e.target.value)}
                    className="input-field w-full text-sm"
                  >
                    <option value="">Keinen Kunden auswählen...</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">Projekttitel *</label>
                  <input type="text" value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} className="input-field w-full text-sm" placeholder="z.B. Website Relaunch" />
                </div>
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">Kundenname *</label>
                  <input type="text" value={createForm.client_name} onChange={e => setCreateForm(f => ({ ...f, client_name: e.target.value }))} className="input-field w-full text-sm" placeholder="Firma / Name" />
                </div>
              </div>

              <div>
                <label className="text-xs text-elvora-text-dim mb-1 block">Beschreibung</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} className="input-field w-full text-sm" rows={2} placeholder="Projektbeschreibung..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">E-Mail</label>
                  <input type="email" value={createForm.client_email} onChange={e => setCreateForm(f => ({ ...f, client_email: e.target.value }))} className="input-field w-full text-sm" placeholder="email@firma.de" />
                </div>
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">Telefon</label>
                  <input type="text" value={createForm.client_phone} onChange={e => setCreateForm(f => ({ ...f, client_phone: e.target.value }))} className="input-field w-full text-sm" placeholder="01234 567890" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">Projektwert (&euro;)</label>
                  <input type="number" value={createForm.total_value} onChange={e => setCreateForm(f => ({ ...f, total_value: e.target.value }))} className="input-field w-full text-sm" placeholder="2500" />
                </div>
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">Start</label>
                  <input type="date" value={createForm.start_date} onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} className="input-field w-full text-sm" />
                </div>
                <div>
                  <label className="text-xs text-elvora-text-dim mb-1 block">Geplantes Ende</label>
                  <input type="date" value={createForm.estimated_end_date} onChange={e => setCreateForm(f => ({ ...f, estimated_end_date: e.target.value }))} className="input-field w-full text-sm" />
                </div>
              </div>

              {/* Custom phases */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-elvora-text-dim">Projektphasen</label>
                  <button onClick={addPhase} className="text-xs text-elvora-purple-light hover:text-elvora-purple flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Phase hinzufügen
                  </button>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {createPhases.map((phase, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-elvora-text-dim w-5 text-center flex-shrink-0">{i + 1}</span>
                      <input
                        type="text"
                        value={phase.label}
                        onChange={e => updatePhase(i, 'label', e.target.value)}
                        className="input-field flex-1 text-sm"
                        placeholder="Phasenname"
                      />
                      <select
                        value={phase.icon}
                        onChange={e => updatePhase(i, 'icon', e.target.value)}
                        className="input-field w-24 text-xs"
                      >
                        {PHASE_ICON_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => removePhase(i)}
                        disabled={createPhases.length <= 2}
                        className="w-6 h-6 flex items-center justify-center rounded text-elvora-text-dim hover:text-red-400 disabled:opacity-30"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-elvora-text-dim mb-1 block">Notizen</label>
                <textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))} className="input-field w-full text-sm" rows={2} placeholder="Interne Notizen..." />
              </div>
            </div>
            <div className="p-5 border-t border-elvora-border flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-elvora-text-dim hover:text-elvora-text">Abbrechen</button>
              <button
                onClick={handleCreate}
                disabled={!createForm.title || !createForm.client_name}
                className="btn-primary px-6 py-2 text-sm rounded-lg disabled:opacity-50"
              >
                Projekt erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
