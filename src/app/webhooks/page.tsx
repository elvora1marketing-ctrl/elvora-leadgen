'use client';

import { useState, useEffect } from 'react';

interface Webhook {
  id: number;
  url: string;
  events: string;
  secret: string | null;
  active: number;
  account_id: number | null;
  last_triggered_at: string | null;
  last_status: number | null;
  failure_count: number;
  created_at: string;
}

const ALL_EVENTS = [
  { key: '*', label: 'Alle Events' },
  { key: 'lead.created', label: 'Lead erstellt' },
  { key: 'lead.status_changed', label: 'Lead-Status geändert' },
  { key: 'lead.replied', label: 'Lead hat geantwortet' },
  { key: 'lead.meeting_booked', label: 'Meeting gebucht' },
  { key: 'lead.won', label: 'Deal gewonnen' },
  { key: 'campaign.started', label: 'Kampagne gestartet' },
  { key: 'campaign.completed', label: 'Kampagne fertig' },
  { key: 'email.sent', label: 'E-Mail gesendet' },
  { key: 'email.opened', label: 'E-Mail geöffnet' },
  { key: 'email.replied', label: 'E-Mail beantwortet' },
  { key: 'email.bounced', label: 'E-Mail bounced' },
];

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>(['*']);
  const [saving, setSaving] = useState(false);
  const [revealSecret, setRevealSecret] = useState<number | null>(null);

  const loadWebhooks = () => {
    fetch('/api/webhooks/outgoing')
      .then(r => r.json())
      .then(data => { setWebhooks(data.webhooks || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadWebhooks(); }, []);

  const addWebhook = async () => {
    if (!newUrl.trim()) return;
    setSaving(true);
    const res = await fetch('/api/webhooks/outgoing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: newUrl.trim(), events: selectedEvents }),
    });
    if (res.ok) {
      setNewUrl('');
      setSelectedEvents(['*']);
      setShowAdd(false);
      loadWebhooks();
    }
    setSaving(false);
  };

  const toggleActive = async (wh: Webhook) => {
    await fetch('/api/webhooks/outgoing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: wh.id, active: !wh.active }),
    });
    loadWebhooks();
  };

  const deleteWebhook = async (id: number) => {
    if (!confirm('Webhook wirklich löschen?')) return;
    await fetch(`/api/webhooks/outgoing?id=${id}`, { method: 'DELETE' });
    loadWebhooks();
  };

  const toggleEvent = (key: string) => {
    if (key === '*') {
      setSelectedEvents(['*']);
      return;
    }
    setSelectedEvents(prev => {
      const filtered = prev.filter(e => e !== '*');
      return filtered.includes(key) ? filtered.filter(e => e !== key) : [...filtered, key];
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Webhooks</h1>
          <p className="text-elvora-text-muted text-sm mt-1">Benachrichtigungen an externe URLs bei Events</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition">
          {showAdd ? 'Abbrechen' : '+ Webhook'}
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <input placeholder="https://example.com/webhook" value={newUrl} onChange={e => setNewUrl(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" />

          <div>
            <p className="text-sm text-elvora-text-muted mb-2">Events</p>
            <div className="flex flex-wrap gap-2">
              {ALL_EVENTS.map(ev => (
                <button key={ev.key} onClick={() => toggleEvent(ev.key)}
                  className={`px-3 py-1 rounded-full text-xs transition ${selectedEvents.includes(ev.key) ? 'bg-elvora-accent text-white' : 'bg-elvora-darker text-elvora-text-muted border border-white/10 hover:text-white'}`}>
                  {ev.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={addWebhook} disabled={saving || !newUrl.trim()}
            className="px-6 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition disabled:opacity-50">
            {saving ? 'Speichern...' : 'Webhook erstellen'}
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-elvora-text-muted text-center py-12">Laden...</div>
      ) : webhooks.length === 0 ? (
        <div className="card-glass p-12 rounded-xl text-center">
          <p className="text-elvora-text-muted">Keine Webhooks konfiguriert.</p>
          <p className="text-elvora-text-muted text-sm mt-2">Webhooks senden HTTP-POST Requests an externe URLs wenn Events eintreten (z.B. Lead antwortet, Meeting gebucht).</p>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(wh => {
            const events: string[] = JSON.parse(wh.events || '[]');
            const eventLabels = events.map(e => ALL_EVENTS.find(ae => ae.key === e)?.label || e);

            return (
              <div key={wh.id} className={`card-glass p-4 rounded-xl ${!wh.active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-mono text-sm truncate">{wh.url}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {eventLabels.map(l => (
                        <span key={l} className="px-2 py-0.5 rounded-full bg-elvora-darker text-elvora-text-muted text-[10px]">{l}</span>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-elvora-text-muted">
                      {wh.last_triggered_at && <span>Zuletzt: {new Date(wh.last_triggered_at).toLocaleString('de-DE')}</span>}
                      {wh.last_status && (
                        <span className={wh.last_status >= 200 && wh.last_status < 300 ? 'text-green-400' : 'text-red-400'}>
                          HTTP {wh.last_status}
                        </span>
                      )}
                      {wh.failure_count > 0 && <span className="text-red-400">{wh.failure_count} Fehler</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button onClick={() => setRevealSecret(revealSecret === wh.id ? null : wh.id)}
                      className="px-2 py-1 rounded bg-elvora-darker text-elvora-text-muted text-xs hover:text-white transition">
                      Secret
                    </button>
                    <button onClick={() => toggleActive(wh)}
                      className={`px-2 py-1 rounded text-xs transition ${wh.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {wh.active ? 'Aktiv' : 'Inaktiv'}
                    </button>
                    <button onClick={() => deleteWebhook(wh.id)}
                      className="px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs hover:bg-red-500/30 transition">
                      Löschen
                    </button>
                  </div>
                </div>
                {revealSecret === wh.id && wh.secret && (
                  <div className="mt-3 p-2 rounded bg-elvora-darker">
                    <p className="text-xs text-elvora-text-muted mb-1">HMAC-SHA256 Secret (X-Webhook-Signature Header):</p>
                    <code className="text-xs text-elvora-accent break-all">{wh.secret}</code>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Documentation */}
      <div className="card-glass p-5 rounded-xl">
        <h3 className="text-sm font-semibold text-white mb-2">Integration</h3>
        <p className="text-elvora-text-muted text-xs leading-relaxed">
          Jeder Webhook sendet einen HTTP POST mit JSON Body: <code className="text-elvora-accent">{'{ event, data, timestamp }'}</code>.
          Der <code className="text-elvora-accent">X-Webhook-Signature</code> Header enthält eine HMAC-SHA256 Signatur des Body mit dem Secret.
          Nach 10 aufeinanderfolgenden Fehlern wird der Webhook automatisch deaktiviert.
        </p>
      </div>
    </div>
  );
}
