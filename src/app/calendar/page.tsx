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
  const firstDay = new Date(y, m - 1, 1).getDay() || 7; // Mon=1, Sun=7
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const cells: Array<string | null> = [];
  for (let i = 1; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${month}-${String(d).padStart(2, '0')}`);
  }

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

  const monthName = new Date(y, m - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
  const dayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Kalender</h1>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-elvora-text-muted">←</button>
          <span className="text-sm font-medium text-white min-w-[140px] text-center capitalize">{monthName}</span>
          <button onClick={nextMonth} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-elvora-text-muted">→</button>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 border border-white/5">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(d => (
            <div key={d} className="text-[10px] uppercase tracking-wider text-elvora-text-dim text-center font-semibold">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-2">
          {cells.map((date, idx) => {
            if (!date) return <div key={idx} className="min-h-[80px]" />;
            const dayNum = parseInt(date.split('-')[2]);
            const events = eventsForDay(date);
            const isToday = date === today;
            const isSelected = date === selectedDay;
            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(date)}
                className={`min-h-[80px] rounded-lg p-1.5 text-left border transition-all ${
                  isSelected ? 'bg-elvora-purple/20 border-elvora-purple/40' :
                  isToday ? 'bg-white/10 border-elvora-accent/30' :
                  events.length > 0 ? 'bg-white/5 border-white/5 hover:bg-white/10' :
                  'border-transparent hover:bg-white/5'
                }`}
              >
                <div className={`text-xs font-bold ${isToday ? 'text-elvora-accent' : 'text-white'}`}>{dayNum}</div>
                {events.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {events.slice(0, 3).map((e, i) => {
                      const colors = { task: 'bg-elvora-purple', followup: 'bg-elvora-accent', meeting: 'bg-elvora-success' };
                      return (
                        <div key={i} className="flex items-center gap-1">
                          <div className={`w-1.5 h-1.5 rounded-full ${colors[e.kind]}`} />
                          <span className="text-[9px] text-elvora-text-muted truncate flex-1">
                            {e.kind === 'task' ? (e.item as Task).title : e.kind === 'followup' ? `FU ${(e.item as Followup).step}` : 'Meeting'}
                          </span>
                        </div>
                      );
                    })}
                    {events.length > 3 && (
                      <div className="text-[9px] text-elvora-text-dim">+{events.length - 3} mehr</div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day panel */}
      {selectedDay && (
        <div className="glass rounded-2xl p-4 border border-white/5 mt-4">
          <h3 className="text-sm font-semibold text-white mb-3">
            {new Date(selectedDay).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
          </h3>
          <div className="space-y-2">
            {eventsForDay(selectedDay).length === 0 ? (
              <div className="text-sm text-elvora-text-dim">Keine Termine</div>
            ) : eventsForDay(selectedDay).map((e, i) => {
              const colors = { task: 'border-elvora-purple/30 bg-elvora-purple/5', followup: 'border-elvora-accent/30 bg-elvora-accent/5', meeting: 'border-elvora-success/30 bg-elvora-success/5' };
              const labels = { task: 'Aufgabe', followup: 'Follow-up', meeting: 'Meeting' };
              return (
                <div key={i} className={`rounded-lg p-3 border ${colors[e.kind]}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider font-bold text-elvora-text-dim">{labels[e.kind]}</span>
                    {e.kind === 'task' && (e.item as Task).due_time && (
                      <span className="text-[10px] text-elvora-text-dim">{(e.item as Task).due_time}</span>
                    )}
                  </div>
                  <div className="text-sm text-white mt-1">
                    {e.kind === 'task' ? (e.item as Task).title :
                     e.kind === 'followup' ? `Follow-up Stufe ${(e.item as Followup).step}` :
                     (e.item as Meeting).content.substring(0, 100)}
                  </div>
                  {(e.kind === 'task' ? (e.item as Task).lead_id : e.kind === 'followup' ? (e.item as Followup).lead_id : (e.item as Meeting).lead_id) && (
                    <Link
                      href={`/crm/${e.kind === 'task' ? (e.item as Task).lead_id : e.kind === 'followup' ? (e.item as Followup).lead_id : (e.item as Meeting).lead_id}`}
                      className="text-xs text-elvora-purple-light hover:underline mt-1 inline-block"
                    >
                      → {e.kind === 'task' ? (e.item as Task).lead_name : e.kind === 'followup' ? (e.item as Followup).lead_name : (e.item as Meeting).lead_name}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 px-2 text-xs flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-elvora-purple" /><span className="text-elvora-text-dim">Aufgaben</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-elvora-accent" /><span className="text-elvora-text-dim">Follow-ups</span></div>
        <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-elvora-success" /><span className="text-elvora-text-dim">Meetings</span></div>
      </div>
    </div>
  );
}
