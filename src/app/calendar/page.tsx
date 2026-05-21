'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Task {
  id: number;
  title: string;
  type: string;
  due_date: string;
  due_time: string | null;
  is_completed: number;
  lead_id: number | null;
  lead_name: string | null;
}

interface Followup {
  id: number;
  step: number;
  scheduled_at: string;
  status: string;
  lead_id: number;
  lead_name: string;
}

interface Meeting {
  id: number;
  content: string;
  created_at: string;
  lead_id: number;
  lead_name: string;
}

export default function CalendarPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickType, setQuickType] = useState('todo');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/calendar?month=${month}`);
    if (res.ok) {
      const d = await res.json();
      setTasks(d.tasks || []);
      setFollowups(d.followups || []);
      setMeetings(d.meetings || []);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const [y, m] = month.split('-').map(Number);
  const firstDay = new Date(y, m - 1, 1).getDay() || 7;
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const isCurrentMonth = month === new Date().toISOString().slice(0, 7);

  const cells: Array<string | null> = [];
  const prevMonthDays = new Date(y, m - 1, 0).getDate();
  for (let i = firstDay - 1; i >= 1; i--) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, '0')}`);
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) for (let i = 0; i < remaining; i++) cells.push(null);

  const eventsForDay = (date: string) => {
    return [
      ...tasks.filter(t => t.due_date === date).map(t => ({ kind: 'task' as const, item: t })),
      ...followups.filter(f => f.scheduled_at.startsWith(date)).map(f => ({ kind: 'followup' as const, item: f })),
      ...meetings.filter(m => m.created_at.startsWith(date)).map(m => ({ kind: 'meeting' as const, item: m })),
    ];
  };

  const prevMonth = () => {
    const d = new Date(y, m - 2, 1);
    setMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(y, m, 1);
    setMonth(d.toISOString().slice(0, 7));
  };
  const goToday = () => {
    setMonth(new Date().toISOString().slice(0, 7));
    setSelectedDay(today);
  };

  const quickAddTask = async () => {
    if (!quickTitle.trim() || !selectedDay) return;
    setSaving(true);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickTitle.trim(),
          type: quickType,
          due_date: selectedDay,
        }),
      });
      setQuickTitle('');
      setShowQuickAdd(false);
      load();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const toggleTask = async (taskId: number) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: true }),
    });
    load();
  };

  const monthName = new Date(y, m - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const totalEvents = tasks.length + followups.length + meetings.length;
  const openTasks = tasks.filter(t => !t.is_completed).length;
  const pendingFollowups = followups.filter(f => f.status === 'pending').length;

  const typeLabels: Record<string, string> = {
    todo: 'To-Do', call: 'Anruf', email: 'E-Mail', meeting: 'Meeting', follow_up: 'Follow-Up',
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Kalender</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">
            {totalEvents > 0 ? `${totalEvents} Termine in ${monthName}` : `${monthName}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isCurrentMonth && (
            <button onClick={goToday} className="px-3 py-1.5 rounded-lg bg-elvora-primary/15 text-elvora-purple-light text-xs font-medium border border-elvora-primary/20 hover:bg-elvora-primary/25 transition-all">
              Heute
            </button>
          )}
          <div className="flex items-center gap-1 bg-elvora-bg-alt rounded-lg border border-elvora-border p-0.5">
            <button onClick={prevMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-elvora-text-muted transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-sm font-medium text-white min-w-[140px] text-center capitalize px-2">{monthName}</span>
            <button onClick={nextMonth} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-white/10 text-elvora-text-muted transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Month Stats */}
      {totalEvents > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-elvora-primary/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{openTasks}</div>
              <div className="text-[10px] text-elvora-text-dim">Offene Aufgaben</div>
            </div>
          </div>
          <div className="card rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-elvora-accent/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-elvora-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{pendingFollowups}</div>
              <div className="text-[10px] text-elvora-text-dim">Follow-ups</div>
            </div>
          </div>
          <div className="card rounded-xl p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-elvora-success/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <div className="text-lg font-semibold text-white">{meetings.length}</div>
              <div className="text-[10px] text-elvora-text-dim">Meetings</div>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="card rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-elvora-border">
          {dayNames.map(d => (
            <div key={d} className="text-[10px] uppercase tracking-wider text-elvora-text-dim text-center font-semibold py-2.5">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} className="min-h-[90px] lg:min-h-[100px] border-b border-r border-elvora-border/50 bg-elvora-bg-alt/30" />;
            const dayNum = parseInt(date.split('-')[2]);
            const events = eventsForDay(date);
            const isToday = date === today;
            const isSelected = date === selectedDay;
            const isPast = date < today;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(selectedDay === date ? null : date)}
                className={`min-h-[90px] lg:min-h-[100px] p-1.5 text-left border-b border-r border-elvora-border/50 transition-all relative ${
                  isSelected ? 'bg-elvora-primary/10 ring-1 ring-inset ring-elvora-primary/30' :
                  isToday ? 'bg-elvora-accent/5' :
                  isPast ? 'hover:bg-white/[0.02]' :
                  'hover:bg-white/[0.03]'
                }`}
              >
                <div className={`text-xs font-bold inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  isToday ? 'bg-elvora-primary text-white' :
                  isPast ? 'text-elvora-text-dim' :
                  'text-elvora-text-muted'
                }`}>{dayNum}</div>
                {events.length > 0 && (
                  <div className="mt-0.5 space-y-0.5">
                    {events.slice(0, 3).map((e, i) => {
                      const colors = {
                        task: 'bg-elvora-purple/20 text-elvora-purple-light border-elvora-purple/30',
                        followup: 'bg-elvora-accent/20 text-elvora-accent border-elvora-accent/30',
                        meeting: 'bg-elvora-success/20 text-elvora-success border-elvora-success/30',
                      };
                      return (
                        <div key={i} className={`text-[9px] lg:text-[10px] px-1 py-0.5 rounded border truncate ${colors[e.kind]}`}>
                          {e.kind === 'task' ? (e.item as Task).title.substring(0, 15) :
                           e.kind === 'followup' ? `FU ${(e.item as Followup).step} - ${(e.item as Followup).lead_name.split(' ')[0]}` :
                           (e.item as Meeting).lead_name}
                        </div>
                      );
                    })}
                    {events.length > 3 && (
                      <div className="text-[9px] text-elvora-text-dim pl-1">+{events.length - 3}</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Day Detail */}
      {selectedDay && (
        <div className="card rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-elvora-border">
            <h3 className="text-sm font-semibold text-white">
              {new Date(selectedDay).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowQuickAdd(!showQuickAdd); setQuickTitle(''); }}
                className="px-3 py-1.5 rounded-lg bg-elvora-primary/15 text-elvora-purple-light text-[11px] font-semibold border border-elvora-primary/20 hover:bg-elvora-primary/25 transition-all flex items-center gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Aufgabe
              </button>
              <button onClick={() => setSelectedDay(null)} className="text-elvora-text-dim hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Add */}
          {showQuickAdd && (
            <div className="px-5 py-3 border-b border-elvora-border bg-elvora-primary/5">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={quickTitle}
                  onChange={e => setQuickTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && quickAddTask()}
                  placeholder="Neue Aufgabe..."
                  className="flex-1 px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-primary/50"
                  autoFocus
                />
                <select
                  value={quickType}
                  onChange={e => setQuickType(e.target.value)}
                  className="px-2 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-xs focus:outline-none"
                >
                  {Object.entries(typeLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button
                  onClick={quickAddTask}
                  disabled={saving || !quickTitle.trim()}
                  className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-xs font-medium hover:bg-elvora-primary-dark transition-colors disabled:opacity-50"
                >
                  {saving ? '...' : 'Hinzuf.'}
                </button>
              </div>
            </div>
          )}

          {/* Events list */}
          <div className="p-5 space-y-2">
            {eventsForDay(selectedDay).length === 0 && !showQuickAdd ? (
              <div className="text-center py-6">
                <svg className="w-8 h-8 text-elvora-text-dim/30 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div className="text-sm text-elvora-text-dim">Keine Termine an diesem Tag</div>
                <button
                  onClick={() => setShowQuickAdd(true)}
                  className="text-elvora-purple-light text-xs hover:underline mt-2"
                >
                  Aufgabe erstellen
                </button>
              </div>
            ) : eventsForDay(selectedDay).map((e, i) => {
              const colors = {
                task: 'border-l-elvora-purple',
                followup: 'border-l-elvora-accent',
                meeting: 'border-l-elvora-success',
              };
              const labels = { task: 'Aufgabe', followup: 'Follow-up', meeting: 'Meeting' };
              const isCompleted = e.kind === 'task' && (e.item as Task).is_completed;
              return (
                <div key={i} className={`rounded-lg p-3 border border-elvora-border/50 border-l-[3px] ${colors[e.kind]} bg-elvora-bg-alt/30 ${isCompleted ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-elvora-text-dim">{labels[e.kind]}</span>
                      {e.kind === 'task' && (e.item as Task).due_time && (
                        <span className="text-[10px] text-elvora-accent font-medium">{(e.item as Task).due_time}</span>
                      )}
                    </div>
                    {e.kind === 'task' && !isCompleted && (
                      <button
                        onClick={() => toggleTask((e.item as Task).id)}
                        className="w-5 h-5 rounded border border-elvora-border-light hover:border-elvora-success hover:bg-elvora-success/10 transition-colors flex items-center justify-center"
                        title="Erledigen"
                      >
                        <svg className="w-3 h-3 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className={`text-sm mt-1 ${isCompleted ? 'text-elvora-text-dim line-through' : 'text-white'}`}>
                    {e.kind === 'task' ? (e.item as Task).title :
                     e.kind === 'followup' ? `Follow-up Stufe ${(e.item as Followup).step}` :
                     (e.item as Meeting).content.substring(0, 150)}
                  </div>
                  {(() => {
                    const leadId = e.kind === 'task' ? (e.item as Task).lead_id : e.kind === 'followup' ? (e.item as Followup).lead_id : (e.item as Meeting).lead_id;
                    const leadName = e.kind === 'task' ? (e.item as Task).lead_name : e.kind === 'followup' ? (e.item as Followup).lead_name : (e.item as Meeting).lead_name;
                    if (!leadId) return null;
                    return (
                      <Link
                        href={`/crm/${leadId}`}
                        className="text-xs text-elvora-purple-light hover:underline mt-1.5 inline-flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {leadName}
                      </Link>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 px-2 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-elvora-purple/40 border border-elvora-purple/30" /><span className="text-elvora-text-dim">Aufgaben</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-elvora-accent/40 border border-elvora-accent/30" /><span className="text-elvora-text-dim">Follow-ups</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded bg-elvora-success/40 border border-elvora-success/30" /><span className="text-elvora-text-dim">Meetings</span></div>
      </div>
    </div>
  );
}
