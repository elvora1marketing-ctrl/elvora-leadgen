'use client';

import { useState, useEffect, useCallback } from 'react';

type SourceKey = 'form' | 'chat' | 'booking';

const SOURCES: { key: SourceKey; label: string; desc: string }[] = [
  { key: 'form', label: 'Kontaktformular', desc: 'Neue Formular-Einsendungen' },
  { key: 'chat', label: 'Live-Chat', desc: 'Neue Chat-Konversationen' },
  { key: 'booking', label: 'Terminbuchung', desc: 'Neue gebuchte Termine' },
];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-elvora-purple' : 'bg-elvora-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function SpeedToLeadPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [email, setEmail] = useState('');
  const [sources, setSources] = useState<SourceKey[]>(['form', 'chat', 'booking']);
  const [resendConfigured, setResendConfigured] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const s = await res.json();
      setEnabled(s.speedlead_enabled === '1');
      setEmailEnabled(s.speedlead_email_enabled !== '0');
      setEmail(s.speedlead_email || '');
      try {
        if (s.speedlead_sources) setSources(JSON.parse(s.speedlead_sources));
      } catch { /* default */ }
      setResendConfigured(!!s.resend_api_key);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSource = (key: SourceKey) => {
    setSources(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setTestMsg(null);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speedlead_enabled: enabled ? '1' : '0',
          speedlead_email_enabled: emailEnabled ? '1' : '0',
          speedlead_email: email.trim(),
          speedlead_sources: JSON.stringify(sources),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const runTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch('/api/speed-to-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTestMsg({ ok: false, text: data.error || 'Test fehlgeschlagen' });
      } else {
        const lines = (data.results || []).map((r: { channel: string; ok: boolean; reason?: string }) =>
          `E-Mail: ${r.ok ? '✓ gesendet' : '✗ ' + (r.reason || 'Fehler')}`
        );
        setTestMsg({ ok: data.success, text: lines.join('  ·  ') });
      }
    } catch {
      setTestMsg({ ok: false, text: 'Verbindungsfehler' });
    }
    setTesting(false);
  };

  if (loading) {
    return <div className="p-12 text-center text-elvora-text-dim">Lädt…</div>;
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Speed-to-Lead</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">
            Sofort-Benachrichtigung bei jedem neuen Lead — wer in unter 5 Min. antwortet, gewinnt.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-elvora-text-muted">{enabled ? 'Aktiv' : 'Inaktiv'}</span>
          <Toggle on={enabled} onChange={setEnabled} />
        </div>
      </div>

      {/* E-Mail-Kanal */}
      <div className="card rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Benachrichtigungs-Kanal</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-elvora-text">E-Mail</div>
              <div className="text-xs text-elvora-text-dim">
                {resendConfigured ? 'Resend verbunden' : 'Resend nicht konfiguriert (Einstellungen)'}
              </div>
            </div>
            <Toggle on={emailEnabled} onChange={setEmailEnabled} />
          </div>
          {emailEnabled && (
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Deine E-Mail für Benachrichtigungen"
              className="w-full h-10 px-3 text-sm bg-elvora-bg-alt border border-elvora-border rounded-lg text-white placeholder:text-elvora-text-dim focus:border-elvora-purple/50 focus:outline-none"
            />
          )}
        </div>
      </div>

      {/* Sources */}
      <div className="card rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Bei welchen Ereignissen benachrichtigen?</h2>
        {SOURCES.map(s => (
          <label key={s.key} className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-sm font-medium text-elvora-text">{s.label}</div>
              <div className="text-xs text-elvora-text-dim">{s.desc}</div>
            </div>
            <input
              type="checkbox"
              checked={sources.includes(s.key)}
              onChange={() => toggleSource(s.key)}
              className="w-4 h-4 accent-elvora-purple"
            />
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="h-10 px-5 rounded-lg text-sm font-semibold bg-gradient-to-r from-elvora-purple to-elvora-pink text-white hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {saving ? 'Speichert…' : saved ? '✓ Gespeichert' : 'Speichern'}
        </button>
        <button
          onClick={runTest}
          disabled={testing}
          className="h-10 px-5 rounded-lg text-sm font-medium bg-elvora-bg-alt border border-elvora-border text-elvora-text hover:border-elvora-border-light disabled:opacity-50 transition-all"
        >
          {testing ? 'Sendet…' : 'Testbenachrichtigung senden'}
        </button>
        {testMsg && (
          <span className={`text-xs ${testMsg.ok ? 'text-elvora-success' : 'text-red-400'}`}>{testMsg.text}</span>
        )}
      </div>

      <p className="text-xs text-elvora-text-dim">
        Tipp: Hinterlege deinen Resend API-Key unter <span className="text-elvora-text-muted">Einstellungen → E-Mail</span>.
        Die Benachrichtigungen werden ausgelöst, sobald ein Besucher ein Formular absendet, einen Chat startet oder einen Termin bucht.
      </p>
    </div>
  );
}
