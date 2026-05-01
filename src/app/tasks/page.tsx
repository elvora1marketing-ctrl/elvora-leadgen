'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Task {
  id: number;
  lead_id: number | null;
  title: string;
  description: string | null;
  type: string;
  due_date: string | null;
  due_time: string | null;
  completed_at: string | null;
  is_completed: number;
  created_at: string;
  lead_name: string | null;
  lead_city: string | null;
}

interface TaskCounts {
  total: number;
  open: number;
  overdue: number;
  due_today: number;
}

const typeConfig: Record<string, { label: string; color: string; icon: string }> = {
  todo: { label: 'To-Do', color: 'bg-elvora-purple/15 text-elvora-purple-light', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  call: { label: 'Anruf', color: 'bg-elvora-accent/15 text-elvora-accent', icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z' },
  email: { label: 'E-Mail', color: 'bg-elvora-pink/15 text-elvora-pink', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  meeting: { label: 'Meeting', color: 'bg-elvora-success/15 text-elvora-success', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  follow_up: { label: 'Follow-Up', color: 'bg-elvora-warning/15 text-elvora-warning', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<TaskCounts>({ total: 0, open: 0, overdue: 0, due_today: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'open' | 'completed' | 'all'>('open');
  const [typeFilter, setTypeFilter] = useState('');

  // New task form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('todo');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === 'open') params.set('completed', '0');
      else if (filter === 'completed') params.set('completed', '1');
      if (typeFilter) params.set('type', typeFilter);
      params.set('limit', '200');

      const res = await fetch(`/api/tasks?${params}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        setCounts(data.counts || { total: 0, open: 0, overdue: 0, due_today: 0 });
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filter, typeFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const toggleComplete = async (taskId: number, currentState: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: currentState === 0 }),
      });
      loadTasks();
    } catch { /* silent */ }
  };

  const deleteTask = async (taskId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      loadTasks();
    } catch { /* silent */ }
  };

  const createTask = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          type: newType,
          due_date: newDueDate || undefined,
          description: newDescription.trim() || undefined,
        }),
      });
      setNewTitle('');
      setNewType('todo');
      setNewDueDate('');
      setNewDescription('');
      setShowForm(false);
      loadTasks();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const isOverdue = (task: Task) => {
    if (task.is_completed || !task.due_date) return false;
    return task.due_date < new Date().toISOString().split('T')[0];
  };

  const isDueToday = (task: Task) => {
    if (task.is_completed || !task.due_date) return false;
    return task.due_date === new Date().toISOString().split('T')[0];
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Aufgaben</h1>
          <p className="text-sm text-elvora-text-dim mt-1">
            {counts.open} offen{counts.overdue > 0 && <span className="text-red-400 font-semibold"> ({counts.overdue} überfällig)</span>}
            {counts.due_today > 0 && <span className="text-elvora-warning font-semibold"> ({counts.due_today} heute fällig)</span>}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-xl bg-elvora-gradient text-white text-sm font-semibold shadow-elvora hover:opacity-90 transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neue Aufgabe
        </button>
      </div>

      {/* New Task Form */}
      {showForm && (
        <div className="glass rounded-2xl p-5 border border-white/5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Aufgabe..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
              onKeyDown={e => e.key === 'Enter' && createTask()}
              autoFocus
            />
            <div className="flex gap-2">
              <select
                value={newType}
                onChange={e => setNewType(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
              >
                {Object.entries(typeConfig).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
              />
            </div>
          </div>
          <textarea
            value={newDescription}
            onChange={e => setNewDescription(e.target.value)}
            placeholder="Beschreibung (optional)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 mb-3"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors">
              Abbrechen
            </button>
            <button
              onClick={createTask}
              disabled={saving || !newTitle.trim()}
              className="px-4 py-1.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple-light transition-colors disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {(['open', 'completed', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f ? 'bg-elvora-purple/20 text-elvora-purple-light border border-elvora-purple/30' : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 border border-transparent'
            }`}
          >
            {f === 'open' ? 'Offen' : f === 'completed' ? 'Erledigt' : 'Alle'}
          </button>
        ))}
        <div className="w-px h-5 bg-white/10 mx-1" />
        {Object.entries(typeConfig).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setTypeFilter(typeFilter === key ? '' : key)}
            className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
              typeFilter === key ? cfg.color + ' ring-1 ring-white/20' : 'bg-white/5 text-elvora-text-dim hover:bg-white/10'
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="text-center py-12 text-elvora-text-dim text-sm">Laden...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-elvora-text-dim text-sm mb-2">Keine Aufgaben</div>
          <button onClick={() => setShowForm(true)} className="text-elvora-purple-light text-sm hover:underline">
            Erste Aufgabe erstellen
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tasks.map(task => {
            const cfg = typeConfig[task.type] || typeConfig.todo;
            const overdue = isOverdue(task);
            const today = isDueToday(task);
            return (
              <div
                key={task.id}
                className={`glass rounded-xl p-4 border transition-all group ${
                  task.is_completed ? 'border-white/3 opacity-50' : overdue ? 'border-red-500/30' : today ? 'border-elvora-warning/20' : 'border-white/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleComplete(task.id, task.is_completed)}
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      task.is_completed ? 'bg-elvora-success border-elvora-success' : 'border-white/20 hover:border-elvora-purple'
                    }`}
                  >
                    {task.is_completed === 1 && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${task.is_completed ? 'line-through text-elvora-text-dim' : 'text-white'}`}>
                        {task.title}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-elvora-text-dim mt-0.5">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5">
                      {task.lead_name && (
                        <Link href={`/crm/${task.lead_id}`} className="text-[11px] text-elvora-purple-light hover:underline flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {task.lead_name}
                        </Link>
                      )}
                      {task.due_date && (
                        <span className={`text-[11px] flex items-center gap-1 ${
                          overdue ? 'text-red-400 font-semibold' : today ? 'text-elvora-warning font-semibold' : 'text-elvora-text-dim'
                        }`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {overdue ? 'Überfällig: ' : today ? 'Heute: ' : ''}
                          {new Date(task.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-elvora-text-dim hover:text-red-400 transition-all p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
