'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface LeadSample {
  id: number;
  name: string;
  city: string;
  score: number;
  email: string | null;
  entscheider_email: string | null;
  entscheider_name: string | null;
  contact_status: string;
}

interface OutreachJob {
  id: string;
  status: 'pending' | 'running' | 'paused' | 'done' | 'cancelled' | 'error';
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  currentIndex: number;
  results: Array<{ leadId: number; recipient: string | null; type: string | null; success: boolean; error?: string; at: string }>;
  throttleMs: number;
  preferEntscheider: boolean;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface RenderedEmail {
  recipient: string | null;
  recipientType: string | null;
  ansprechpartner: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
  error?: string;
}

export default function OutreachPage() {
  // Filter state
  const [city, setCity] = useState('');
  const [keyword, setKeyword] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState<number | ''>(60);
  const [contactStatus, setContactStatus] = useState('not_contacted');
  const [onlyWithEmail, setOnlyWithEmail] = useState(true);
  const [preferEntscheider, setPreferEntscheider] = useState(true);
  const [mailsPerHour, setMailsPerHour] = useState(60);

  // Data state
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<LeadSample[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewLead, setPreviewLead] = useState<LeadSample | null>(null);
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Job state
  const [job, setJob] = useState<OutreachJob | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadFilterCount = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: 'count' });
      if (city) params.set('city', city);
      if (keyword) params.set('keyword', keyword);
      if (minScore !== '') params.set('minScore', String(minScore));
      if (maxScore !== '') params.set('maxScore', String(maxScore));
      if (contactStatus) params.set('contactStatus', contactStatus);
      params.set('onlyWithEmail', String(onlyWithEmail));

      const res = await fetch(`/api/email/outreach?${params}`);
      if (!res.ok) { setError('Filter-Abfrage fehlgeschlagen'); return; }
      const data = await res.json();
      setCount(data.count);
      setSample(data.sample || []);
      if (data.sample && data.sample.length > 0 && !previewLead) {
        setPreviewLead(data.sample[0]);
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }, [city, keyword, minScore, maxScore, contactStatus, onlyWithEmail, previewLead]);

  useEffect(() => {
    const t = setTimeout(() => loadFilterCount(), 400);
    return () => clearTimeout(t);
  }, [loadFilterCount]);

  const loadPreview = useCallback(async (leadId: number) => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/email/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: { leadId }, preferEntscheider }),
      });
      const data = await res.json();
      setPreview(data);
    } catch {
      setPreview(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [preferEntscheider]);

  useEffect(() => { if (previewLead) loadPreview(previewLead.id); }, [previewLead, loadPreview]);

  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/email/outreach/${jobId}`);
      if (!res.ok) return;
      const data = await res.json();
      setJob(data.job);
      if (data.job.status === 'done' || data.job.status === 'cancelled' || data.job.status === 'error') {
        if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
      }
    } catch { /* silent */ }
  }, []);

  const startSending = async () => {
    setError(null);
    setShowConfirm(false);
    try {
      const res = await fetch('/api/email/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filter: {
            city: city || undefined,
            keyword: keyword || undefined,
            minScore: minScore !== '' ? minScore : undefined,
            maxScore: maxScore !== '' ? maxScore : undefined,
            contactStatus: contactStatus || undefined,
            onlyWithEmail,
          },
          mailsPerHour,
          preferEntscheider,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fehler beim Starten'); return; }
      setJob(data.job);
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = setInterval(() => pollJob(data.job.id), 2000);
    } catch {
      setError('Netzwerkfehler beim Starten');
    }
  };

  const cancelJob = async () => {
    if (!job) return;
    await fetch(`/api/email/outreach/${job.id}`, { method: 'DELETE' });
    pollJob(job.id);
  };

  const pauseJob = async () => {
    if (!job) return;
    await fetch(`/api/email/outreach/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'pause' }),
    });
    pollJob(job.id);
  };

  const resumeJob = async () => {
    if (!job) return;
    await fetch(`/api/email/outreach/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resume' }),
    });
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => pollJob(job.id), 2000);
  };

  useEffect(() => () => { if (pollTimer.current) clearInterval(pollTimer.current); }, []);

  const progress = job ? Math.round((job.currentIndex / Math.max(1, job.total)) * 100) : 0;
  const estimateMinutes = count && count > 0 ? Math.ceil((count * (3600 / mailsPerHour)) / 60) : 0;
  const isRunning = job && (job.status === 'running' || job.status === 'paused');

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pt-16 lg:pt-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Email Outreach</h1>
        <p className="text-sm text-elvora-text-dim mt-0.5">Personalisierte Mails an alle deine Leads – mit Throttling & Entscheider-Targeting</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Live Job */}
      {job && (
        <div className="mb-6 card rounded-xl p-5 border border-elvora-purple/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">
                Job {job.id.split('_')[2]} · {job.status === 'running' ? 'Läuft' : job.status === 'paused' ? 'Pausiert' : job.status === 'done' ? 'Fertig' : job.status === 'cancelled' ? 'Abgebrochen' : 'Fehler'}
              </div>
              <div className="text-lg font-semibold text-elvora-text">
                {job.currentIndex} / {job.total} Mails · ✓ {job.sent} gesendet · ✗ {job.failed} fehler · ⊘ {job.skipped} übersprungen
              </div>
            </div>
            <div className="flex gap-2">
              {job.status === 'running' && (
                <button onClick={pauseJob} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-elvora-text">Pause</button>
              )}
              {job.status === 'paused' && (
                <button onClick={resumeJob} className="px-3 py-1.5 rounded-lg bg-elvora-purple/20 hover:bg-elvora-purple/30 text-sm text-elvora-purple-light">Fortsetzen</button>
              )}
              {isRunning && (
                <button onClick={cancelJob} className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-sm text-red-400">Abbrechen</button>
              )}
              {!isRunning && (
                <button onClick={() => setJob(null)} className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-elvora-text-dim">Schließen</button>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div className="h-full bg-elvora-gradient transition-all" style={{ width: `${progress}%` }} />
          </div>
          {job.results.length > 0 && (
            <div className="mt-4 max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
              {job.results.slice(-15).reverse().map((r, i) => (
                <div key={i} className={`px-2 py-1 rounded ${r.success ? 'text-elvora-success' : 'text-red-400'}`}>
                  {r.success ? '✓' : '✗'} #{r.leadId} → {r.recipient || 'keine Email'} {r.type ? `(${r.type})` : ''} {r.error ? `· ${r.error}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        {/* Left: Filters + Stats */}
        <div className="space-y-5">
          <div className="card rounded-xl p-5">
            <h2 className="text-sm font-semibold text-elvora-text mb-4">Zielgruppe filtern</h2>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Stadt</label>
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="z.B. Berlin" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text focus:border-elvora-purple/40 focus:outline-none" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Branche/Keyword</label>
                <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="z.B. Friseur" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text focus:border-elvora-purple/40 focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Score min</label>
                <input type="number" value={minScore} onChange={e => setMinScore(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="z.B. 1" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Score max</label>
                <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="z.B. 60" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Kontakt-Status</label>
                <select value={contactStatus} onChange={e => setContactStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text">
                  <option value="">Alle</option>
                  <option value="not_contacted">Nicht kontaktiert</option>
                  <option value="email_sent">Bereits gesendet</option>
                  <option value="called">Angerufen</option>
                  <option value="meeting">Meeting</option>
                  <option value="proposal">Angebot</option>
                </select>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <label className="flex items-center gap-2 text-sm text-elvora-text cursor-pointer">
                  <input type="checkbox" checked={onlyWithEmail} onChange={e => setOnlyWithEmail(e.target.checked)} className="accent-elvora-purple" />
                  Nur Leads mit Email
                </label>
                <label className="flex items-center gap-2 text-sm text-elvora-text cursor-pointer">
                  <input type="checkbox" checked={preferEntscheider} onChange={e => setPreferEntscheider(e.target.checked)} className="accent-elvora-purple" />
                  Entscheider bevorzugen
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">
                Versandgeschwindigkeit: <span className="text-elvora-purple-light font-semibold">{mailsPerHour} Mails/Stunde</span>
              </label>
              <input type="range" min="6" max="600" value={mailsPerHour} onChange={e => setMailsPerHour(parseInt(e.target.value))} className="w-full accent-elvora-purple" />
              <div className="flex justify-between text-[10px] text-elvora-text-dim mt-1">
                <span>6/h (langsam)</span>
                <span>60/h (empfohlen)</span>
                <span>600/h (max)</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-elvora-text">Treffer</h2>
              <button onClick={loadFilterCount} disabled={loading} className="text-xs text-elvora-purple-light hover:text-elvora-purple disabled:opacity-50">
                {loading ? 'Lade...' : 'Aktualisieren'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim mb-1">Leads</div>
                <div className="text-2xl font-bold text-elvora-text">{count ?? '–'}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim mb-1">Geschätzte Dauer</div>
                <div className="text-2xl font-bold text-elvora-text">
                  {estimateMinutes > 60 ? `${Math.round(estimateMinutes / 60)}h` : `${estimateMinutes}m`}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={!count || count === 0 || !!isRunning}
              className="w-full px-4 py-3 rounded-lg bg-elvora-gradient text-white font-semibold text-sm shadow-elvora hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isRunning ? 'Job läuft bereits' : count === 0 ? 'Keine Leads' : `${count} Mails versenden →`}
            </button>
          </div>

          {/* Sample */}
          <div className="card rounded-xl p-5">
            <h2 className="text-sm font-semibold text-elvora-text mb-3">Vorschau ({sample.length} von {count ?? 0})</h2>
            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {sample.map(l => {
                const emailToUse = preferEntscheider && l.entscheider_email ? l.entscheider_email : l.email || l.entscheider_email;
                const isSelected = previewLead?.id === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => setPreviewLead(l)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-elvora-purple/15 border border-elvora-purple/30' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-elvora-text truncate">{l.name}</div>
                        <div className="text-[11px] text-elvora-text-dim truncate font-mono">{emailToUse || 'keine Email'}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.score < 30 ? 'bg-red-500/15 text-red-400' : l.score < 60 ? 'bg-orange-500/15 text-orange-400' : 'bg-green-500/15 text-green-400'}`}>
                          {l.score}
                        </span>
                        {l.entscheider_name && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-elvora-purple/15 text-elvora-purple-light" title={l.entscheider_name}>GF</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Email Preview */}
        <div className="card rounded-xl p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <h2 className="text-sm font-semibold text-elvora-text mb-3">Mail-Vorschau</h2>
          {!previewLead && <p className="text-sm text-elvora-text-dim">Wähle einen Lead aus der Liste</p>}
          {previewLoading && <div className="text-sm text-elvora-text-dim">Lade...</div>}
          {preview && !previewLoading && (
            <>
              <div className="space-y-2 mb-4 text-xs">
                <div className="flex gap-2"><span className="text-elvora-text-dim w-20 flex-shrink-0">An:</span><span className="text-elvora-text font-mono break-all">{preview.recipient}{preview.recipientType && <span className="ml-1 text-elvora-purple-light">({preview.recipientType})</span>}</span></div>
                <div className="flex gap-2"><span className="text-elvora-text-dim w-20 flex-shrink-0">Von:</span><span className="text-elvora-text font-mono">{preview.fromName} &lt;{preview.fromEmail}&gt;</span></div>
                <div className="flex gap-2"><span className="text-elvora-text-dim w-20 flex-shrink-0">Anrede:</span><span className="text-elvora-text">{preview.ansprechpartner}</span></div>
                <div className="flex gap-2"><span className="text-elvora-text-dim w-20 flex-shrink-0">Betreff:</span><span className="text-elvora-text">{preview.subject}</span></div>
              </div>
              <div className="border border-white/10 rounded-lg overflow-hidden bg-white">
                <iframe srcDoc={preview.html} className="w-full h-[600px]" sandbox="" title="Email Preview" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-elvora-bg-alt border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-elvora-text mb-2">Bulk-Versand starten?</h3>
            <p className="text-sm text-elvora-text-dim mb-4">
              Du sendest <span className="text-elvora-purple-light font-semibold">{count} personalisierte Mails</span> mit <span className="text-elvora-purple-light font-semibold">{mailsPerHour}/Stunde</span>.
              Geschätzte Dauer: <span className="text-elvora-text">{estimateMinutes > 60 ? `${Math.round(estimateMinutes / 60)}h` : `${estimateMinutes}m`}</span>.
            </p>
            <p className="text-xs text-elvora-text-dim mb-5">
              Du kannst den Versand jederzeit pausieren oder abbrechen. Bei {preferEntscheider ? 'Leads mit erkanntem Geschäftsführer wird die Entscheider-Email bevorzugt' : 'allen Leads wird die Haupt-Email verwendet'}.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-elvora-text">Abbrechen</button>
              <button onClick={startSending} className="flex-1 px-4 py-2.5 rounded-lg bg-elvora-gradient text-white text-sm font-semibold shadow-elvora">Starten</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
