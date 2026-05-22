'use client';

import { useState, useEffect, useCallback } from 'react';

interface SequenceStep {
  type: 'email' | 'task';
  delay_days: number;
  subject?: string;
  body?: string;
  task_type?: 'call' | 'email' | 'meeting' | 'todo';
  title?: string;
}

interface Sequence {
  id: number;
  name: string;
  is_active: number;
  steps: SequenceStep[];
  enrolled_count: number;
  completed_count: number;
  reply_count: number;
  created_at: string;
}

const TEMPLATES: { name: string; label: string; description: string; steps: SequenceStep[] }[] = [
  {
    name: 'erstansprache',
    label: 'Erstansprache 4-Step',
    description: 'E-Mail, Follow-Up, Anruf, letzte E-Mail',
    steps: [
      { type: 'email', delay_days: 0, subject: 'Erstansprache', body: '' },
      { type: 'email', delay_days: 3, subject: 'Kurzes Follow-Up', body: '' },
      { type: 'task', delay_days: 5, task_type: 'call', title: 'Telefonisches Follow-Up' },
      { type: 'email', delay_days: 7, subject: 'Letzte Nachricht', body: '' },
    ],
  },
  {
    name: 'nachfass',
    label: 'Nachfass-Sequenz',
    description: '3 E-Mails mit steigendem Abstand',
    steps: [
      { type: 'email', delay_days: 0, subject: 'Erste Nachricht', body: '' },
      { type: 'email', delay_days: 5, subject: 'Erinnerung', body: '' },
      { type: 'email', delay_days: 10, subject: 'Letztes Follow-Up', body: '' },
    ],
  },
  {
    name: 'reaktivierung',
    label: 'Reaktivierung',
    description: 'E-Mail, Anruf, 2 weitere E-Mails',
    steps: [
      { type: 'email', delay_days: 0, subject: 'Wieder da!', body: '' },
      { type: 'task', delay_days: 3, task_type: 'call', title: 'Reaktivierungs-Anruf' },
      { type: 'email', delay_days: 7, subject: 'Neues Angebot', body: '' },
      { type: 'email', delay_days: 14, subject: 'Letzte Chance', body: '' },
    ],
  },
];

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formSteps, setFormSteps] = useState<SequenceStep[]>([
    { type: 'email', delay_days: 0, subject: '', body: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [enrollingId, setEnrollingId] = useState<number | null>(null);
  const [enrollLeadIds, setEnrollLeadIds] = useState('');

  const loadSequences = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sequences');
      if (res.ok) {
        const data = await res.json();
        setSequences(data.sequences || data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSequences(); }, [loadSequences]);

  const resetForm = () => {
    setFormName('');
    setFormSteps([{ type: 'email', delay_days: 0, subject: '', body: '' }]);
    setEditingId(null);
    setShowForm(false);
  };

  const applyTemplate = (tpl: typeof TEMPLATES[number]) => {
    setFormName(tpl.label);
    setFormSteps(tpl.steps.map(s => ({ ...s })));
  };

  const updateStep = (idx: number, updates: Partial<SequenceStep>) => {
    setFormSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...updates } : s));
  };

  const addStep = () => {
    const lastDelay = formSteps.length > 0 ? formSteps[formSteps.length - 1].delay_days : 0;
    setFormSteps(prev => [...prev, { type: 'email', delay_days: lastDelay + 3, subject: '', body: '' }]);
  };

  const removeStep = (idx: number) => {
    if (formSteps.length <= 1) return;
    setFormSteps(prev => prev.filter((_, i) => i !== idx));
  };

  const saveSequence = async () => {
    if (!formName.trim() || formSteps.length === 0) return;
    setSaving(true);
    try {
      const url = editingId ? `/api/sequences/${editingId}` : '/api/sequences';
      const method = editingId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName.trim(), steps: formSteps }),
      });
      if (res.ok) {
        resetForm();
        loadSequences();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const deleteSequence = async (id: number) => {
    try {
      await fetch(`/api/sequences/${id}`, { method: 'DELETE' });
      loadSequences();
    } catch { /* silent */ }
  };

  const toggleActive = async (seq: Sequence) => {
    try {
      await fetch(`/api/sequences/${seq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: seq.is_active ? 0 : 1 }),
      });
      loadSequences();
    } catch { /* silent */ }
  };

  const enrollLeads = async (seqId: number) => {
    const ids = enrollLeadIds.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    if (ids.length === 0) return;
    try {
      await fetch(`/api/sequences/${seqId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_ids: ids }),
      });
      setEnrollingId(null);
      setEnrollLeadIds('');
      loadSequences();
    } catch { /* silent */ }
  };

  const startEdit = (seq: Sequence) => {
    setEditingId(seq.id);
    setFormName(seq.name);
    setFormSteps(seq.steps && seq.steps.length > 0 ? seq.steps.map(s => ({ ...s })) : [{ type: 'email', delay_days: 0, subject: '', body: '' }]);
    setShowForm(true);
  };

  const activeCount = sequences.filter(s => s.is_active).length;
  const totalEnrolled = sequences.reduce((sum, s) => sum + (s.enrolled_count || 0), 0);
  const totalCompleted = sequences.reduce((sum, s) => sum + (s.completed_count || 0), 0);

  const getDelayLabel = (days: number) => {
    if (days === 0) return 'Tag 0';
    return `+${days} ${days === 1 ? 'Tag' : 'Tage'}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Sequences</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Sequenz
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {[
          { label: 'Aktive Sequences', value: activeCount, color: 'text-elvora-success' },
          { label: 'Eingeschrieben', value: totalEnrolled, color: 'text-elvora-purple-light' },
          { label: 'Abgeschlossen', value: totalCompleted, color: 'text-elvora-accent' },
        ].map((stat, i) => (
          <div key={i} className="card rounded-xl p-4">
            <div className="text-[11px] text-elvora-text-dim uppercase tracking-wider mb-1">{stat.label}</div>
            <div className={`text-2xl font-semibold stat-number ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-elvora-text">
              {editingId ? 'Sequenz bearbeiten' : 'Neue Sequenz erstellen'}
            </h2>
            <button onClick={resetForm} className="text-elvora-text-dim hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Templates */}
          {!editingId && (
            <div>
              <div className="text-[11px] text-elvora-text-dim uppercase tracking-wider mb-2">Vorlagen</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.name}
                    onClick={() => applyTemplate(tpl)}
                    className="card rounded-xl p-3 card-hover text-left border border-elvora-border hover:border-elvora-purple/40 transition-all"
                  >
                    <div className="text-sm font-medium text-elvora-text mb-1">{tpl.label}</div>
                    <div className="text-[11px] text-elvora-text-dim">{tpl.description}</div>
                    <div className="flex items-center gap-1 mt-2">
                      {tpl.steps.map((s, j) => (
                        <div key={j} className="flex items-center gap-1">
                          {j > 0 && <div className="w-3 h-px bg-elvora-border" />}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                            s.type === 'email' ? 'bg-elvora-pink/15 text-elvora-pink' : 'bg-elvora-accent/15 text-elvora-accent'
                          }`}>
                            {s.type === 'email' ? (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <input
            type="text"
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Sequenz-Name..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
          />

          {/* Steps Builder */}
          <div>
            <div className="text-[11px] text-elvora-text-dim uppercase tracking-wider mb-2">Steps</div>
            <div className="space-y-3">
              {formSteps.map((step, idx) => (
                <div key={idx} className="bg-elvora-bg-alt rounded-xl p-4 border border-elvora-border">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-elvora-primary/20 text-elvora-purple-light text-xs font-semibold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs text-elvora-text-muted font-medium">{getDelayLabel(step.delay_days)}</span>
                    </div>
                    {formSteps.length > 1 && (
                      <button
                        onClick={() => removeStep(idx)}
                        className="text-elvora-text-dim hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <select
                      value={step.type}
                      onChange={e => {
                        const t = e.target.value as 'email' | 'task';
                        updateStep(idx, {
                          type: t,
                          subject: t === 'email' ? (step.subject || '') : undefined,
                          body: t === 'email' ? (step.body || '') : undefined,
                          task_type: t === 'task' ? (step.task_type || 'call') : undefined,
                          title: t === 'task' ? (step.title || '') : undefined,
                        });
                      }}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
                    >
                      <option value="email">E-Mail</option>
                      <option value="task">Aufgabe</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      value={step.delay_days}
                      onChange={e => updateStep(idx, { delay_days: parseInt(e.target.value) || 0 })}
                      placeholder="Verzögerung (Tage)"
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                    />
                  </div>

                  {step.type === 'email' ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={step.subject || ''}
                        onChange={e => updateStep(idx, { subject: e.target.value })}
                        placeholder="Betreff..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                      />
                      <textarea
                        value={step.body || ''}
                        onChange={e => updateStep(idx, { body: e.target.value })}
                        placeholder="Nachricht..."
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={step.title || ''}
                        onChange={e => updateStep(idx, { title: e.target.value })}
                        placeholder="Aufgaben-Titel..."
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                      />
                      <select
                        value={step.task_type || 'call'}
                        onChange={e => updateStep(idx, { task_type: e.target.value as SequenceStep['task_type'] })}
                        className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
                      >
                        <option value="call">Anruf</option>
                        <option value="email">E-Mail</option>
                        <option value="meeting">Meeting</option>
                        <option value="todo">To-Do</option>
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addStep}
              className="mt-3 w-full py-2 rounded-lg border border-dashed border-elvora-border text-sm text-elvora-text-muted hover:border-elvora-purple/40 hover:text-elvora-purple-light transition-all flex items-center justify-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Step hinzufügen
            </button>
          </div>

          {/* Save */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors">
              Abbrechen
            </button>
            <button
              onClick={saveSequence}
              disabled={saving || !formName.trim()}
              className="px-5 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Speichern...' : editingId ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Sequence List */}
      {loading ? (
        <div className="text-center py-12 text-elvora-text-dim text-sm">Laden...</div>
      ) : sequences.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <div className="text-elvora-text-dim text-sm mb-2">Noch keine Sequences erstellt</div>
          <button
            onClick={() => setShowForm(true)}
            className="text-elvora-purple-light text-sm hover:underline"
          >
            Erste Sequenz erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sequences.map(seq => {
            const steps: SequenceStep[] = Array.isArray(seq.steps) ? seq.steps : [];
            return (
              <div key={seq.id} className="card rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-elvora-text">{seq.name}</h3>
                      <span className="text-[11px] text-elvora-text-dim">{steps.length} Steps</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-elvora-text-muted">
                      <span>{seq.enrolled_count || 0} Eingeschrieben</span>
                      <span>{seq.completed_count || 0} Abgeschlossen</span>
                      <span>{seq.reply_count || 0} Antworten</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Active Toggle */}
                    <button
                      onClick={() => toggleActive(seq)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        seq.is_active ? 'bg-elvora-success' : 'bg-white/10'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        seq.is_active ? 'left-5' : 'left-0.5'
                      }`} />
                    </button>
                    <span className={`text-[10px] font-medium ${seq.is_active ? 'text-elvora-success' : 'text-elvora-text-dim'}`}>
                      {seq.is_active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </div>
                </div>

                {/* Step Timeline */}
                {steps.length > 0 && (
                  <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
                    {steps.map((step, j) => (
                      <div key={j} className="flex items-center gap-1 flex-shrink-0">
                        {j > 0 && (
                          <div className="flex items-center gap-0.5">
                            <div className="w-4 h-px bg-elvora-border" />
                            <span className="text-[9px] text-elvora-text-dim whitespace-nowrap">{getDelayLabel(step.delay_days)}</span>
                            <div className="w-4 h-px bg-elvora-border" />
                          </div>
                        )}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${
                          step.type === 'email' ? 'bg-elvora-pink/15 text-elvora-pink' : 'bg-elvora-accent/15 text-elvora-accent'
                        }`}>
                          {step.type === 'email' ? (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          )}
                        </div>
                        {j === 0 && (
                          <span className="text-[9px] text-elvora-text-dim ml-0.5">Tag 0</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => startEdit(seq)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-elvora-text-muted hover:bg-white/10 hover:text-white transition-all flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Bearbeiten
                  </button>
                  <button
                    onClick={() => { setEnrollingId(enrollingId === seq.id ? null : seq.id); setEnrollLeadIds(''); }}
                    className="px-3 py-1.5 rounded-lg bg-elvora-primary/10 text-xs text-elvora-purple-light hover:bg-elvora-primary/20 transition-all flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Einschreiben
                  </button>
                  <button
                    onClick={() => deleteSequence(seq.id)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-elvora-text-dim hover:bg-red-500/10 hover:text-red-400 transition-all flex items-center gap-1"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Löschen
                  </button>
                </div>

                {/* Enroll Form */}
                {enrollingId === seq.id && (
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={enrollLeadIds}
                      onChange={e => setEnrollLeadIds(e.target.value)}
                      placeholder="Lead-IDs (kommagetrennt, z.B. 1, 5, 12)"
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                    />
                    <button
                      onClick={() => enrollLeads(seq.id)}
                      className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors"
                    >
                      Einschreiben
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
