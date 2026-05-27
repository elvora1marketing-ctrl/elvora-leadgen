'use client';

import { useState, useEffect } from 'react';

interface WarmingDomain {
  id: number;
  domain: string;
  day: number;
  totalDays: number;
  todayTarget: number;
  todaySent: number;
  totalSent: number;
  healthScore: number;
  inboxCount: number;
  accountId: number | null;
  startDate: string;
  progress: number;
}

interface ScheduleEntry { day: number; limit: number; }

export default function WarmupMonitoringPage() {
  const [domains, setDomains] = useState<WarmingDomain[]>([]);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; errors?: string[] } | null>(null);

  const loadData = () => {
    fetch('/api/outbound/warmup')
      .then(r => r.json())
      .then(data => {
        setDomains(data.warmingDomains || []);
        setSchedule(data.schedule || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const runWarmup = async () => {
    setRunning(true);
    setLastResult(null);
    const res = await fetch('/api/outbound/warmup', { method: 'POST' });
    const data = await res.json();
    setLastResult(data);
    setRunning(false);
    loadData();
  };

  const maxScheduleLimit = Math.max(...schedule.map(s => s.limit), 1);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Warmup-Monitoring</h1>
          <p className="text-elvora-text-muted text-sm mt-1">{domains.length} Domain{domains.length !== 1 ? 's' : ''} im Warmup</p>
        </div>
        <button onClick={runWarmup} disabled={running || domains.length === 0}
          className="px-4 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition disabled:opacity-50">
          {running ? 'Sendet...' : 'Warmup jetzt ausführen'}
        </button>
      </div>

      {lastResult && (
        <div className={`card-glass p-4 rounded-xl ${lastResult.errors?.length ? 'border border-yellow-500/30' : 'border border-green-500/30'}`}>
          <p className="text-white text-sm">
            {lastResult.sent} Warmup-Mails gesendet.
            {lastResult.errors?.length ? ` ${lastResult.errors.length} Fehler.` : ''}
          </p>
          {lastResult.errors?.map((e, i) => (
            <p key={i} className="text-red-400 text-xs mt-1">{e}</p>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-elvora-text-muted text-center py-12">Laden...</div>
      ) : domains.length === 0 ? (
        <div className="card-glass p-12 rounded-xl text-center">
          <p className="text-elvora-text-muted">Keine Domains im Warmup.</p>
          <p className="text-elvora-text-muted text-sm mt-2">Neue Domains starten automatisch im Warming-Modus.</p>
        </div>
      ) : (
        <>
          {/* Domain Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {domains.map(d => {
              const pct = Math.min(100, d.todayTarget > 0 ? (d.todaySent / d.todayTarget) * 100 : 0);
              return (
                <div key={d.id} className="card-glass p-5 rounded-xl">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-white font-medium">{d.domain}</h3>
                      <p className="text-elvora-text-muted text-xs mt-0.5">
                        Tag {d.day} / {d.totalDays} — seit {new Date(d.startDate).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm font-bold ${d.healthScore >= 80 ? 'text-green-400' : d.healthScore >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {d.healthScore}%
                      </div>
                      <p className="text-elvora-text-muted text-[10px]">Health</p>
                    </div>
                  </div>

                  {/* Progress bar (overall warmup) */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-elvora-text-muted mb-1">
                      <span>Warmup-Fortschritt</span>
                      <span>{d.progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-elvora-darker rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-yellow-500 to-green-500 rounded-full transition-all"
                        style={{ width: `${d.progress}%` }} />
                    </div>
                  </div>

                  {/* Today's sending progress */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-elvora-text-muted mb-1">
                      <span>Heute</span>
                      <span>{d.todaySent} / {d.todayTarget}</span>
                    </div>
                    <div className="w-full h-2 bg-elvora-darker rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-elvora-accent'}`}
                        style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  </div>

                  <div className="flex gap-4 text-xs text-elvora-text-muted">
                    <span>{d.inboxCount} Inbox{d.inboxCount !== 1 ? 'es' : ''}</span>
                    <span>{d.totalSent} gesamt gesendet</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Schedule Reference */}
          <div className="card-glass p-5 rounded-xl">
            <h3 className="text-sm font-semibold text-white mb-4">Warmup-Schedule (15 Tage)</h3>
            <div className="flex items-end gap-1 h-32">
              {schedule.map(s => {
                const active = domains.some(d => d.day === s.day);
                return (
                  <div key={s.day} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-elvora-text-muted">{s.limit}</span>
                    <div className={`w-full rounded-t transition-all ${active ? 'bg-elvora-accent' : 'bg-white/10'}`}
                      style={{ height: `${(s.limit / maxScheduleLimit) * 100}px` }} />
                    <span className={`text-[10px] ${active ? 'text-elvora-accent font-bold' : 'text-elvora-text-muted'}`}>
                      {s.day}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-elvora-text-muted mt-3 text-center">E-Mails pro Tag — aktive Tage sind hervorgehoben</p>
          </div>
        </>
      )}
    </div>
  );
}
