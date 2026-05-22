'use client';

import { useState, useEffect, useCallback } from 'react';

// --- Types ---

interface Workflow {
  id: number;
  name: string;
  trigger_type: string;
  trigger_config: string;
  conditions: string;
  actions: string;
  is_active: number;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
}

interface WorkflowLog {
  id: number;
  workflow_id: number;
  lead_id: number | null;
  trigger_type: string;
  actions_executed: string;
  status: string;
  error: string | null;
  created_at: string;
  lead_name: string | null;
  workflow_name: string | null;
}

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface ActionItem {
  type: string;
  config: Record<string, string>;
}

interface FormData {
  name: string;
  trigger_type: string;
  trigger_config: Record<string, string | number>;
  conditions: Condition[];
  actions: ActionItem[];
}

// --- Config ---

const triggerTypes: Record<string, string> = {
  score_threshold: 'Score erreicht Schwelle',
  status_change: 'Status-Änderung',
  email_event: 'Email-Event',
  proposal_event: 'Proposal-Event',
  tag_added: 'Tag hinzugefügt',
  new_lead: 'Neuer Lead',
  inactivity: 'Inaktivität',
};

const triggerColors: Record<string, string> = {
  score_threshold: 'bg-elvora-purple/15 text-elvora-purple-light',
  status_change: 'bg-elvora-warning/15 text-elvora-warning',
  email_event: 'bg-elvora-pink/15 text-elvora-pink',
  proposal_event: 'bg-elvora-accent/15 text-elvora-accent',
  tag_added: 'bg-blue-500/15 text-blue-400',
  new_lead: 'bg-elvora-success/15 text-elvora-success',
  inactivity: 'bg-red-500/15 text-red-400',
};

const statusOptions: Record<string, string> = {
  not_contacted: 'Nicht kontaktiert',
  email_sent: 'E-Mail gesendet',
  called: 'Angerufen',
  meeting: 'Meeting',
  proposal: 'Angebot',
  won: 'Gewonnen',
  lost: 'Verloren',
};

const emailEventOptions: Record<string, string> = {
  opened: 'Geöffnet',
  clicked: 'Geklickt',
  replied: 'Geantwortet',
  bounced: 'Bounced',
};

const conditionFields: Record<string, string> = {
  score: 'Score',
  city: 'Stadt',
  contact_status: 'Kontaktstatus',
  email: 'E-Mail',
  priority: 'Priorität',
};

const conditionOperators: Record<string, string> = {
  eq: 'gleich',
  gte: 'größer/gleich',
  lte: 'kleiner/gleich',
  in: 'enthält',
  exists: 'existiert',
};

const actionTypes: Record<string, string> = {
  create_task: 'Task erstellen',
  change_status: 'Status ändern',
  add_tag: 'Tag hinzufügen',
  update_field: 'Feld aktualisieren',
  send_notification: 'Benachrichtigung senden',
};

const taskTypes: Record<string, string> = {
  todo: 'To-Do',
  call: 'Anruf',
  email: 'E-Mail',
  meeting: 'Meeting',
  follow_up: 'Follow-Up',
};

const emptyForm: FormData = {
  name: '',
  trigger_type: 'score_threshold',
  trigger_config: {},
  conditions: [],
  actions: [],
};

// --- Presets ---

const presets = [
  {
    label: 'Lead Nurturing',
    description: 'Erstellt automatisch eine Aufgabe, wenn ein Lead Score 70 erreicht.',
    data: {
      name: 'Lead Nurturing',
      trigger_type: 'score_threshold',
      trigger_config: { threshold: 70 },
      conditions: [],
      actions: [{ type: 'create_task', config: { title: 'Lead nachfassen', task_type: 'follow_up', due_days: '3' } }],
    } as FormData,
  },
  {
    label: 'Follow-up Reminder',
    description: 'Erinnerung nach 7 Tagen Inaktivität mit Benachrichtigung.',
    data: {
      name: 'Follow-up Reminder',
      trigger_type: 'inactivity',
      trigger_config: { days: 7 },
      conditions: [],
      actions: [
        { type: 'create_task', config: { title: 'Follow-up fällig', task_type: 'follow_up', due_days: '1' } },
        { type: 'send_notification', config: { title: 'Follow-up fällig' } },
      ],
    } as FormData,
  },
  {
    label: 'Won-Deal Onboarding',
    description: 'Startet den Onboarding-Prozess, wenn ein Deal gewonnen wird.',
    data: {
      name: 'Won-Deal Onboarding',
      trigger_type: 'status_change',
      trigger_config: { to_status: 'won' },
      conditions: [],
      actions: [{ type: 'create_task', config: { title: 'Onboarding starten', task_type: 'todo', due_days: '1' } }],
    } as FormData,
  },
];

// --- Helpers ---

function parseJson<T>(raw: string | T, fallback: T): T {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function summarizeActions(raw: string): string {
  const actions: ActionItem[] = parseJson(raw, []);
  if (actions.length === 0) return 'Keine Aktionen';
  const labels = actions.map(a => actionTypes[a.type] || a.type);
  return `${actions.length} Aktion${actions.length > 1 ? 'en' : ''}: ${labels.join(', ')}`;
}

// --- Input classes ---

const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50';
const selectCls = 'bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-elvora-purple/50';

// --- Component ---

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });

  // --- Data loading ---

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wfRes, logRes] = await Promise.all([
        fetch('/api/workflows'),
        fetch('/api/workflows/logs?limit=50'),
      ]);
      if (wfRes.ok) setWorkflows(await wfRes.json());
      if (logRes.ok) setLogs(await logRes.json());
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- Stats ---

  const activeCount = workflows.filter((w: Workflow) => w.is_active).length;
  const totalRuns = workflows.reduce((s: number, w: Workflow) => s + (w.run_count || 0), 0);
  const last24h = logs.filter((l: WorkflowLog) => {
    const d = new Date(l.created_at);
    return Date.now() - d.getTime() < 86400000;
  }).length;

  // --- Actions ---

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, trigger_config: {}, conditions: [], actions: [] });
    setShowForm(true);
  };

  const openEdit = (wf: Workflow) => {
    setEditId(wf.id);
    setForm({
      name: wf.name,
      trigger_type: wf.trigger_type,
      trigger_config: parseJson(wf.trigger_config, {}),
      conditions: parseJson(wf.conditions, []),
      actions: parseJson(wf.actions, []),
    });
    setShowForm(true);
  };

  const applyPreset = (preset: FormData) => {
    setEditId(null);
    setForm({
      ...preset,
      trigger_config: { ...preset.trigger_config },
      conditions: [...preset.conditions],
      actions: preset.actions.map(a => ({ ...a, config: { ...a.config } })),
    });
  };

  const saveWorkflow = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        trigger_type: form.trigger_type,
        trigger_config: form.trigger_config,
        conditions: form.conditions,
        actions: form.actions,
      };
      if (editId) {
        await fetch(`/api/workflows/${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      setEditId(null);
      loadData();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const deleteWorkflow = async (id: number) => {
    try {
      await fetch(`/api/workflows/${id}`, { method: 'DELETE' });
      loadData();
    } catch { /* silent */ }
  };

  const toggleActive = async (id: number) => {
    try {
      await fetch(`/api/workflows/${id}/toggle`, { method: 'POST' });
      loadData();
    } catch { /* silent */ }
  };

  // --- Condition helpers ---

  const addCondition = () => {
    setForm((f: FormData) => ({ ...f, conditions: [...f.conditions, { field: 'score', operator: 'gte', value: '' }] }));
  };

  const updateCondition = (idx: number, patch: Partial<Condition>) => {
    setForm((f: FormData) => {
      const c = [...f.conditions];
      c[idx] = { ...c[idx], ...patch };
      return { ...f, conditions: c };
    });
  };

  const removeCondition = (idx: number) => {
    setForm((f: FormData) => ({ ...f, conditions: f.conditions.filter((_: Condition, i: number) => i !== idx) }));
  };

  // --- Action helpers ---

  const addAction = () => {
    setForm((f: FormData) => ({ ...f, actions: [...f.actions, { type: 'create_task', config: {} }] }));
  };

  const updateAction = (idx: number, patch: Partial<ActionItem>) => {
    setForm((f: FormData) => {
      const a = [...f.actions];
      a[idx] = { ...a[idx], ...patch };
      return { ...f, actions: a };
    });
  };

  const updateActionConfig = (idx: number, key: string, value: string) => {
    setForm((f: FormData) => {
      const a = [...f.actions];
      a[idx] = { ...a[idx], config: { ...a[idx].config, [key]: value } };
      return { ...f, actions: a };
    });
  };

  const removeAction = (idx: number) => {
    setForm((f: FormData) => ({ ...f, actions: f.actions.filter((_: ActionItem, i: number) => i !== idx) }));
  };

  // --- Trigger config renderer ---

  const renderTriggerConfig = () => {
    const tt = form.trigger_type;
    if (tt === 'score_threshold') {
      return (
        <div>
          <label className="text-xs text-elvora-text-muted mb-1 block">Schwellenwert</label>
          <input
            type="number"
            value={form.trigger_config.threshold ?? ''}
            onChange={e => setForm((f: FormData) => ({ ...f, trigger_config: { ...f.trigger_config, threshold: e.target.value } }))}
            placeholder="z.B. 70"
            className={inputCls}
          />
        </div>
      );
    }
    if (tt === 'status_change') {
      return (
        <div>
          <label className="text-xs text-elvora-text-muted mb-1 block">Ziel-Status</label>
          <select
            value={(form.trigger_config.to_status as string) || ''}
            onChange={e => setForm((f: FormData) => ({ ...f, trigger_config: { ...f.trigger_config, to_status: e.target.value } }))}
            className={`${selectCls} w-full`}
          >
            <option value="">Auswählen...</option>
            {Object.entries(statusOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      );
    }
    if (tt === 'email_event') {
      return (
        <div>
          <label className="text-xs text-elvora-text-muted mb-1 block">Event-Typ</label>
          <select
            value={(form.trigger_config.event_type as string) || ''}
            onChange={e => setForm((f: FormData) => ({ ...f, trigger_config: { ...f.trigger_config, event_type: e.target.value } }))}
            className={`${selectCls} w-full`}
          >
            <option value="">Auswählen...</option>
            {Object.entries(emailEventOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      );
    }
    if (tt === 'inactivity') {
      return (
        <div>
          <label className="text-xs text-elvora-text-muted mb-1 block">Tage der Inaktivität</label>
          <input
            type="number"
            value={form.trigger_config.days ?? ''}
            onChange={e => setForm((f: FormData) => ({ ...f, trigger_config: { ...f.trigger_config, days: e.target.value } }))}
            placeholder="z.B. 7"
            className={inputCls}
          />
        </div>
      );
    }
    if (tt === 'tag_added') {
      return (
        <div>
          <label className="text-xs text-elvora-text-muted mb-1 block">Tag-Name</label>
          <input
            type="text"
            value={(form.trigger_config.tag_name as string) || ''}
            onChange={e => setForm((f: FormData) => ({ ...f, trigger_config: { ...f.trigger_config, tag_name: e.target.value } }))}
            placeholder="Tag eingeben..."
            className={inputCls}
          />
        </div>
      );
    }
    if (tt === 'proposal_event') {
      return (
        <div>
          <label className="text-xs text-elvora-text-muted mb-1 block">Event</label>
          <input
            type="text"
            value={(form.trigger_config.event as string) || ''}
            onChange={e => setForm((f: FormData) => ({ ...f, trigger_config: { ...f.trigger_config, event: e.target.value } }))}
            placeholder="z.B. accepted, sent..."
            className={inputCls}
          />
        </div>
      );
    }
    return null;
  };

  // --- Action config renderer ---

  const renderActionConfig = (action: ActionItem, idx: number) => {
    if (action.type === 'create_task') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <input
            type="text"
            value={action.config.title || ''}
            onChange={e => updateActionConfig(idx, 'title', e.target.value)}
            placeholder="Titel..."
            className={inputCls}
          />
          <select
            value={action.config.task_type || 'todo'}
            onChange={e => updateActionConfig(idx, 'task_type', e.target.value)}
            className={selectCls}
          >
            {Object.entries(taskTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            type="number"
            value={action.config.due_days || ''}
            onChange={e => updateActionConfig(idx, 'due_days', e.target.value)}
            placeholder="Fällig in Tagen"
            className={inputCls}
          />
        </div>
      );
    }
    if (action.type === 'change_status') {
      return (
        <div className="mt-2">
          <select
            value={action.config.contact_status || ''}
            onChange={e => updateActionConfig(idx, 'contact_status', e.target.value)}
            className={`${selectCls} w-full`}
          >
            <option value="">Status wählen...</option>
            {Object.entries(statusOptions).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      );
    }
    if (action.type === 'add_tag') {
      return (
        <div className="mt-2">
          <input
            type="text"
            value={action.config.tag_id || ''}
            onChange={e => updateActionConfig(idx, 'tag_id', e.target.value)}
            placeholder="Tag-ID..."
            className={inputCls}
          />
        </div>
      );
    }
    if (action.type === 'update_field') {
      return (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <select
            value={action.config.field || ''}
            onChange={e => updateActionConfig(idx, 'field', e.target.value)}
            className={selectCls}
          >
            <option value="">Feld wählen...</option>
            {Object.entries(conditionFields).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            type="text"
            value={action.config.value || ''}
            onChange={e => updateActionConfig(idx, 'value', e.target.value)}
            placeholder="Neuer Wert..."
            className={inputCls}
          />
        </div>
      );
    }
    if (action.type === 'send_notification') {
      return (
        <div className="mt-2">
          <input
            type="text"
            value={action.config.title || ''}
            onChange={e => updateActionConfig(idx, 'title', e.target.value)}
            placeholder="Benachrichtigungstitel..."
            className={inputCls}
          />
        </div>
      );
    }
    return null;
  };

  // --- Render ---

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Workflows</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neuer Workflow
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">Aktive Workflows</div>
          <div className="text-2xl font-bold text-elvora-text">{activeCount}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">Gesamt-Ausführungen</div>
          <div className="text-2xl font-bold text-elvora-text">{totalRuns}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">Letzte 24h</div>
          <div className="text-2xl font-bold text-elvora-text">{last24h}</div>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold text-elvora-text">
            {editId ? 'Workflow bearbeiten' : 'Neuer Workflow'}
          </h2>

          {/* Presets (only on create) */}
          {!editId && (
            <div>
              <div className="text-xs text-elvora-text-dim uppercase tracking-wider mb-2">Vorlagen</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {presets.map(p => (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p.data)}
                    className="text-left card rounded-lg p-3 hover:border-elvora-purple/40 transition-colors"
                  >
                    <div className="text-sm font-medium text-elvora-text">{p.label}</div>
                    <div className="text-xs text-elvora-text-dim mt-0.5">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="text-xs text-elvora-text-muted mb-1 block">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm((f: FormData) => ({ ...f, name: e.target.value }))}
              placeholder="Workflow-Name..."
              className={inputCls}
              autoFocus
            />
          </div>

          {/* Trigger */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-elvora-text-muted mb-1 block">Trigger-Typ</label>
              <select
                value={form.trigger_type}
                onChange={e => setForm((f: FormData) => ({ ...f, trigger_type: e.target.value, trigger_config: {} }))}
                className={`${selectCls} w-full`}
              >
                {Object.entries(triggerTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {renderTriggerConfig()}
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-elvora-text-muted uppercase tracking-wider">Bedingungen</label>
              <button onClick={addCondition} className="text-xs text-elvora-purple-light hover:text-elvora-primary transition-colors">
                + Bedingung
              </button>
            </div>
            {form.conditions.length === 0 && (
              <div className="text-xs text-elvora-text-dim">Keine Bedingungen (Workflow wird immer ausgeführt)</div>
            )}
            {form.conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2 mb-2">
                <select
                  value={cond.field}
                  onChange={e => updateCondition(idx, { field: e.target.value })}
                  className={selectCls}
                >
                  {Object.entries(conditionFields).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select
                  value={cond.operator}
                  onChange={e => updateCondition(idx, { operator: e.target.value })}
                  className={selectCls}
                >
                  {Object.entries(conditionOperators).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input
                  type="text"
                  value={cond.value}
                  onChange={e => updateCondition(idx, { value: e.target.value })}
                  placeholder="Wert..."
                  className={`${inputCls} flex-1`}
                />
                <button onClick={() => removeCondition(idx)} className="text-red-400 hover:text-red-300 p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-elvora-text-muted uppercase tracking-wider">Aktionen</label>
              <button onClick={addAction} className="text-xs text-elvora-purple-light hover:text-elvora-primary transition-colors">
                + Aktion
              </button>
            </div>
            {form.actions.length === 0 && (
              <div className="text-xs text-elvora-text-dim">Keine Aktionen definiert</div>
            )}
            {form.actions.map((action, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg p-3 mb-2">
                <div className="flex items-center gap-2">
                  <select
                    value={action.type}
                    onChange={e => updateAction(idx, { type: e.target.value, config: {} })}
                    className={`${selectCls} flex-1`}
                  >
                    {Object.entries(actionTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <button onClick={() => removeAction(idx)} className="text-red-400 hover:text-red-300 p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                {renderActionConfig(action, idx)}
              </div>
            ))}
          </div>

          {/* Save / Cancel */}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button
              onClick={() => { setShowForm(false); setEditId(null); }}
              className="px-3 py-1.5 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors"
            >
              Abbrechen
            </button>
            <button
              onClick={saveWorkflow}
              disabled={saving || !form.name.trim()}
              className="px-4 py-1.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple-light transition-colors disabled:opacity-50"
            >
              {saving ? 'Speichern...' : editId ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Workflow List */}
      {loading ? (
        <div className="text-center py-12 text-elvora-text-dim text-sm">Laden...</div>
      ) : workflows.length === 0 && !showForm ? (
        <div className="text-center py-16">
          <div className="text-elvora-text-dim text-sm mb-2">Keine Workflows vorhanden</div>
          <button onClick={openCreate} className="text-elvora-purple-light text-sm hover:underline">
            Ersten Workflow erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {workflows.map(wf => {
            const triggerLabel = triggerTypes[wf.trigger_type] || wf.trigger_type;
            const colorCls = triggerColors[wf.trigger_type] || 'bg-white/10 text-elvora-text-muted';
            return (
              <div key={wf.id} className="card rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Top row: name + badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{wf.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorCls}`}>
                        {triggerLabel}
                      </span>
                    </div>

                    {/* Actions summary */}
                    <div className="text-xs text-elvora-text-muted mt-1">
                      {summarizeActions(wf.actions)}
                    </div>

                    {/* Meta row */}
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-elvora-text-dim">
                      <span>{wf.run_count} Ausführung{wf.run_count !== 1 ? 'en' : ''}</span>
                      <span>Letzter Lauf: {formatDate(wf.last_run_at)}</span>
                    </div>
                  </div>

                  {/* Right: status + actions */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Status toggle */}
                    <button
                      onClick={() => toggleActive(wf.id)}
                      className="flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
                    >
                      <span className={`w-2 h-2 rounded-full ${wf.is_active ? 'bg-elvora-success' : 'bg-elvora-text-dim'}`} />
                      <span className={wf.is_active ? 'text-elvora-success' : 'text-elvora-text-dim'}>
                        {wf.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </button>

                    {/* Edit */}
                    <button
                      onClick={() => openEdit(wf)}
                      className="text-elvora-text-dim hover:text-elvora-purple-light transition-colors p-1"
                      title="Bearbeiten"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => deleteWorkflow(wf.id)}
                      className="text-elvora-text-dim hover:text-red-400 transition-colors p-1"
                      title="Löschen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-elvora-text mb-3">Letzte Ausführungen</h2>
          <div className="card rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-elvora-border">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Workflow</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Lead</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Aktionen</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Zeitpunkt</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map(log => {
                  const executedActions: ActionItem[] = parseJson(log.actions_executed, []);
                  const actionSummary = executedActions.length > 0
                    ? executedActions.map(a => actionTypes[a.type] || a.type).join(', ')
                    : '–';
                  return (
                    <tr key={log.id} className="border-b border-elvora-border/50 last:border-0">
                      <td className="px-4 py-2.5 text-elvora-text">{log.workflow_name || '–'}</td>
                      <td className="px-4 py-2.5 text-elvora-text-muted">{log.lead_name || '–'}</td>
                      <td className="px-4 py-2.5 text-elvora-text-muted text-xs">{actionSummary}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          log.status === 'success'
                            ? 'bg-elvora-success/15 text-elvora-success'
                            : log.status === 'error'
                            ? 'bg-red-500/15 text-red-400'
                            : 'bg-white/10 text-elvora-text-muted'
                        }`}>
                          {log.status === 'success' ? 'Erfolg' : log.status === 'error' ? 'Fehler' : log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-elvora-text-dim text-xs">{formatDate(log.created_at)}</td>
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
