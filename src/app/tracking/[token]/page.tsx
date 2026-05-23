'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

interface Phase {
  key: string;
  label: string;
  icon: string;
}

interface ProjectUpdate {
  id: number;
  phase: string;
  title: string;
  description: string | null;
  created_at: string;
}

interface ProjectData {
  title: string;
  description: string | null;
  client_name: string;
  current_phase: string;
  phases: string;
  status: string;
  start_date: string | null;
  estimated_end_date: string | null;
  created_at: string;
  updated_at: string;
}

interface Agency {
  agency_name?: string;
  agency_email?: string;
  agency_phone?: string;
  agency_address?: string;
}

const PHASE_ICONS: Record<string, JSX.Element> = {
  inbox: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>,
  clipboard: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  palette: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
  code: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  search: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  check: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  rocket: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  flag: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>,
};

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

export default function TrackingPage() {
  const params = useParams();
  const token = params.token as string;

  const [project, setProject] = useState<ProjectData | null>(null);
  const [updates, setUpdates] = useState<ProjectUpdate[]>([]);
  const [agency, setAgency] = useState<Agency>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/public/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Projekt nicht gefunden');
          return;
        }
        const data = await res.json();
        setProject(data.project);
        setUpdates(data.updates || []);
        setAgency(data.agency || {});
      } catch {
        setError('Netzwerkfehler');
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const phases: Phase[] = useMemo(() => {
    if (!project) return [];
    try {
      return typeof project.phases === 'string' ? JSON.parse(project.phases) : project.phases;
    } catch {
      return [];
    }
  }, [project]);

  const currentPhaseIndex = useMemo(() => {
    if (!project) return -1;
    return phases.findIndex(p => p.key === project.current_phase);
  }, [project, phases]);

  const progressPercent = useMemo(() => {
    if (phases.length <= 1) return 100;
    if (currentPhaseIndex < 0) return 0;
    return Math.round((currentPhaseIndex / (phases.length - 1)) * 100);
  }, [currentPhaseIndex, phases]);

  if (loading) {
    return (
      <div className="min-h-screen bg-elvora-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-elvora-text-dim">Projekt wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-elvora-bg flex items-center justify-center">
        <div className="card rounded-xl p-8 max-w-md text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-elvora-text mb-2">Projekt nicht gefunden</h2>
          <p className="text-sm text-elvora-text-dim">{error || 'Dieses Projekt existiert nicht oder wurde entfernt.'}</p>
        </div>
      </div>
    );
  }

  const agencyName = agency.agency_name || 'Elvora';
  const isCompleted = project.status === 'completed';

  return (
    <div className="min-h-screen bg-elvora-bg py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="card rounded-xl p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">{agencyName}</p>
              <h1 className="text-2xl font-bold text-elvora-text mb-1">{project.title}</h1>
              {project.description && (
                <p className="text-sm text-elvora-text-dim mt-2">{project.description}</p>
              )}
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                isCompleted
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : project.status === 'paused'
                  ? 'bg-yellow-500/15 text-yellow-400'
                  : project.status === 'cancelled'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-elvora-purple/15 text-elvora-purple-light'
              }`}>
                {isCompleted ? 'Abgeschlossen' : project.status === 'paused' ? 'Pausiert' : project.status === 'cancelled' ? 'Storniert' : 'In Bearbeitung'}
              </span>
            </div>
          </div>

          {/* Project info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-elvora-bg-alt border border-elvora-border mb-6">
            <div>
              <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Kunde</p>
              <p className="text-sm text-elvora-text font-medium mt-0.5">{project.client_name}</p>
            </div>
            <div>
              <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Start</p>
              <p className="text-sm text-elvora-text mt-0.5">{fmtDate(project.start_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Geplant bis</p>
              <p className="text-sm text-elvora-text mt-0.5">{fmtDate(project.estimated_end_date)}</p>
            </div>
            <div>
              <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Fortschritt</p>
              <p className="text-sm text-elvora-text font-medium mt-0.5">{progressPercent}%</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-2">
            <div className="h-2 bg-elvora-bg-alt rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: isCompleted
                    ? 'linear-gradient(90deg, #10b981, #34d399)'
                    : 'linear-gradient(90deg, #7c3aed, #a855f7, #ec4899)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Phases stepper */}
        <div className="card rounded-xl p-6 lg:p-8">
          <h2 className="text-sm font-semibold text-elvora-text mb-6 uppercase tracking-wider">Projektphasen</h2>
          <div className="space-y-0">
            {phases.map((phase, i) => {
              const isDone = i < currentPhaseIndex || isCompleted;
              const isCurrent = i === currentPhaseIndex && !isCompleted;
              const isFuture = i > currentPhaseIndex && !isCompleted;

              return (
                <div key={phase.key} className="flex gap-4">
                  {/* Vertical line + circle */}
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30'
                        : isCurrent
                        ? 'bg-elvora-purple/20 text-elvora-purple-light ring-2 ring-elvora-purple/50 shadow-lg shadow-elvora-purple/20'
                        : 'bg-elvora-bg-alt text-elvora-text-dim border border-elvora-border'
                    }`}>
                      {isDone ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        PHASE_ICONS[phase.icon] || PHASE_ICONS.flag
                      )}
                    </div>
                    {i < phases.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[32px] ${
                        isDone ? 'bg-emerald-500/40' : isCurrent ? 'bg-elvora-purple/30' : 'bg-elvora-border'
                      }`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className={`pb-6 ${i === phases.length - 1 ? 'pb-0' : ''}`}>
                    <p className={`text-sm font-semibold ${
                      isDone ? 'text-emerald-400' : isCurrent ? 'text-elvora-text' : 'text-elvora-text-dim'
                    }`}>
                      {phase.label}
                      {isCurrent && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-elvora-purple/15 text-elvora-purple-light font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-elvora-purple animate-pulse" />
                          Aktuell
                        </span>
                      )}
                    </p>
                    {isDone && (
                      <p className="text-xs text-elvora-text-dim mt-0.5">Abgeschlossen</p>
                    )}
                    {isFuture && (
                      <p className="text-xs text-elvora-text-dim mt-0.5">Ausstehend</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Updates timeline */}
        {updates.length > 0 && (
          <div className="card rounded-xl p-6 lg:p-8">
            <h2 className="text-sm font-semibold text-elvora-text mb-6 uppercase tracking-wider">Verlauf</h2>
            <div className="space-y-4">
              {[...updates].reverse().map((update) => {
                const phaseInfo = phases.find(p => p.key === update.phase);
                return (
                  <div key={update.id} className="flex gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-elvora-bg-alt border border-elvora-border flex items-center justify-center flex-shrink-0 text-elvora-text-dim">
                      {phaseInfo ? (PHASE_ICONS[phaseInfo.icon] || <span className="text-xs">{phaseInfo.label[0]}</span>) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <p className="text-sm font-medium text-elvora-text">{update.title}</p>
                        {phaseInfo && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-elvora-bg-alt text-elvora-text-dim border border-elvora-border">
                            {phaseInfo.label}
                          </span>
                        )}
                      </div>
                      {update.description && (
                        <p className="text-sm text-elvora-text-dim mt-1">{update.description}</p>
                      )}
                      <p className="text-xs text-elvora-text-dim mt-1">{fmtDateTime(update.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-elvora-text-dim pb-4">
          <p>{agencyName} {agency.agency_email ? `| ${agency.agency_email}` : ''}</p>
          <p className="mt-1 text-elvora-text-dim/60">Letzte Aktualisierung: {fmtDateTime(project.updated_at)}</p>
        </div>
      </div>
    </div>
  );
}
