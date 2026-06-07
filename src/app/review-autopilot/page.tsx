'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReviewRequest {
  id: number;
  booking_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  channel: string;
  scheduled_at: string;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'skipped' | 'failed';
  created_at: string;
}

interface Counts { pending: number; sent: number; skipped: number; failed: number }

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Geplant', cls: 'text-elvora-warning bg-elvora-warning/10' },
  sent: { label: 'Gesendet', cls: 'text-elvora-success bg-elvora-success/10' },
  skipped: { label: 'Übersprungen', cls: 'text-elvora-text-dim bg-white/5' },
  failed: { label: 'Fehler', cls: 'text-red-400 bg-red-500/10' },
};

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-elvora-purple' : 'bg-elvora-border'}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

function fmt(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T') + 'Z');
  return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ReviewAutopilotPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState('');

  const [enabled, setEnabled] = useState(false);
  const [delay, setDelay] = useState('24');
  const [channel, setChannel] = useState('email');
  const [googleUrl, setGoogleUrl] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [counts, setCounts] = useState<Counts>({ pending: 0, sent: 0, skipped: 0, failed: 0 });

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
      setEnabled(s.review_autopilot_enabled === '1');
      setDelay(s.review_autopilot_delay_hours || '24');
      setChannel(s.review_autopilot_channel || 'email');
      setGoogleUrl(s.review_google_url || '');
      setSubject(s.review_autopilot_subject || 'Wie war Ihr Termin bei uns?');
      setMessage(s.review_autopilot_message || '');
    } catch { /* ignore */ }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch('/api/review-autopilot');
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        setCounts(data.counts || { pending: 0, sent: 0, skipped: 0, failed: 0 });
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    (async () => { await Promise.all([loadSettings(), loadRequests()]); setLoading(false); })();
  }, [loadSettings, loadRequests]);

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_autopilot_enabled: enabled ? '1' : '0',
          review_autopilot_delay_hours: String(parseInt(delay) || 24),
          review_autopilot_channel: channel,
          review_google_url: googleUrl.trim(),
          review_autopilot_subject: subject,
          review_autopilot_message: message,
        }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const runNow = async () => {
    setRunning(true); setRunMsg('');
    try {
      const res = await fetch('/api/cron/review-requests', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRunMsg(`${data.sent} gesendet, ${data.skipped} übersprungen (von ${data.processed} fällig)`);
        await loadRequests();
      } else {
        setRunMsg(data.error || 'Fehler');
      }
    } catch { setRunMsg('Verbindungsfehler'); }
    setRunning(false);
  };

  if (loading) return <div className="p-12 text-center text-elvora-text-dim">Lädt…</div>;

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Bewertungs-Autopilot</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">
            Nach jedem erledigten Termin automatisch um eine Google-Bewertung bitten.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-elvora-text-muted">{enabled ? 'Aktiv' : 'Inaktiv'}</span>
          <Toggle on={enabled} onChange={setEnabled} />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card rounded-xl p-4"><div className="text-xs text-elvora-text-dim">Geplant</div><div className="text-2xl font-bold text-elvora-warning mt-1">{counts.pending}</div></div>
        <div className="card rounded-xl p-4"><div className="text-xs text-elvora-text-dim">Gesendet</div><div className="text-2xl font-bold text-elvora-success mt-1">{counts.sent}</div></div>
        <div className="card rounded-xl p-4"><div className="text-xs text-elvora-text-dim">Übersprungen</div><div className="text-2xl font-bold text-elvora-text-muted mt-1">{counts.skipped}</div></div>
        <div className="card rounded-xl p-4"><div className="text-xs text-elvora-text-dim">Fehler</div><div className="text-2xl font-bold text-red-400 mt-1">{counts.failed}</div></div>
      </div>

      {/* Config */}
      <div className="card rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Einstellungen</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Verzögerung (Stunden nach Termin)</label>
            <input type="number" min="0" value={delay} onChange={e => setDelay(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-elvora-bg-alt border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none" />
          </div>
          <div>
            <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Kanal</label>
            <select value={channel} onChange={e => setChannel(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-elvora-bg-alt border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none">
              <option value="email">E-Mail</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Google-Bewertungslink</label>
          <input value={googleUrl} onChange={e => setGoogleUrl(e.target.value)}
            placeholder="https://g.page/r/.../review"
            className="w-full h-10 px-3 text-sm bg-elvora-bg-alt border border-elvora-border rounded-lg text-white placeholder:text-elvora-text-dim focus:border-elvora-purple/50 focus:outline-none" />
          <p className="text-[11px] text-elvora-text-dim mt-1">
            Den Link findest du in deinem Google-Unternehmensprofil unter „Rezensionen → Mehr Rezensionen erhalten“.
          </p>
        </div>

        {channel === 'email' && (
          <div>
            <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Betreff (E-Mail)</label>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-elvora-bg-alt border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none" />
          </div>
        )}

        <div>
          <label className="text-xs text-elvora-text-muted font-medium mb-1.5 block">Nachricht</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={6}
            className="w-full px-3 py-2 text-sm bg-elvora-bg-alt border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none resize-y" />
          <p className="text-[11px] text-elvora-text-dim mt-1">
            Platzhalter: <code className="text-elvora-text-muted">{'{{name}}'}</code> (Kundenname), <code className="text-elvora-text-muted">{'{{link}}'}</code> (Bewertungslink).
          </p>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button onClick={save} disabled={saving}
            className="h-10 px-5 rounded-lg text-sm font-semibold bg-gradient-to-r from-elvora-purple to-elvora-pink text-white hover:brightness-110 disabled:opacity-50 transition-all">
            {saving ? 'Speichert…' : saved ? '✓ Gespeichert' : 'Speichern'}
          </button>
          <button onClick={runNow} disabled={running}
            className="h-10 px-5 rounded-lg text-sm font-medium bg-elvora-bg-alt border border-elvora-border text-elvora-text hover:border-elvora-border-light disabled:opacity-50 transition-all">
            {running ? 'Verarbeitet…' : 'Fällige jetzt senden'}
          </button>
          {runMsg && <span className="text-xs text-elvora-text-muted">{runMsg}</span>}
        </div>
      </div>

      {/* Requests list */}
      <div className="card rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-elvora-border">
          <h2 className="text-sm font-semibold text-white">Letzte Anfragen</h2>
        </div>
        {requests.length === 0 ? (
          <div className="p-8 text-center text-sm text-elvora-text-dim">
            Noch keine Anfragen. Markiere einen Termin als „erledigt“, um eine zu planen.
          </div>
        ) : (
          <div className="divide-y divide-elvora-border">
            {requests.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-elvora-text font-medium truncate">{r.customer_name || 'Unbekannt'}</div>
                  <div className="text-xs text-elvora-text-dim truncate">
                    {r.channel === 'whatsapp' ? (r.customer_phone || '—') : (r.customer_email || '—')}
                    {' · '}geplant {fmt(r.scheduled_at)}
                    {r.sent_at && ` · gesendet ${fmt(r.sent_at)}`}
                  </div>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-md flex-shrink-0 ml-3 ${STATUS_LABELS[r.status]?.cls || ''}`}>
                  {STATUS_LABELS[r.status]?.label || r.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-elvora-text-dim">
        Hinweis: Damit Anfragen automatisch zur geplanten Zeit rausgehen, sollte ein Cron-Job regelmäßig
        <code className="text-elvora-text-muted mx-1">POST /api/cron/review-requests</code>
        aufrufen (z. B. stündlich). Alternativ hier manuell „Fällige jetzt senden“.
      </p>
    </div>
  );
}
