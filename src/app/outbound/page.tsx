'use client';

import { useState, useEffect, useCallback } from 'react';

interface Domain {
  id: number;
  domain: string;
  status: string;
  health_score: number;
  daily_limit: number;
  sent_today: number;
  total_sent: number;
  warming_day: number;
  dns_status: string;
  resend_domain_id: string | null;
  notes: string | null;
}

interface Inbox {
  id: number;
  domain_id: number;
  email: string;
  display_name: string | null;
  status: string;
  daily_limit: number;
  sent_today: number;
  domain?: string;
}

interface Stats {
  active_domains: number;
  warming_domains: number;
  sent_today: number;
  daily_limit: number;
}

type Tab = 'domains' | 'inboxes' | 'domain-hinzufuegen' | 'inbox-hinzufuegen';

function StatusBadge({ status, warmingDay }: { status: string; warmingDay?: number }) {
  const map: Record<string, { bg: string; label: string }> = {
    active: { bg: 'bg-green-500/15 text-green-400', label: 'Aktiv' },
    warming: { bg: 'bg-amber-500/15 text-amber-400', label: `Warming Tag ${warmingDay || 0}/15` },
    paused: { bg: 'bg-gray-500/15 text-gray-400', label: 'Pausiert' },
    burned: { bg: 'bg-red-500/15 text-red-400', label: 'Verbrannt' },
  };
  const s = map[status] || map.paused;
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${s.bg}`}>{s.label}</span>;
}

function DnsBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
      {label} {ok ? '✓' : '✗'}
    </span>
  );
}

function parseDns(raw: string): { spf: boolean; dkim: boolean; dmarc: boolean } {
  try {
    const obj = JSON.parse(raw);
    return { spf: !!obj.spf, dkim: !!obj.dkim, dmarc: !!obj.dmarc };
  } catch {
    return { spf: false, dkim: false, dmarc: false };
  }
}

export default function OutboundPage() {
  const [tab, setTab] = useState<Tab>('domains');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);

  // Add domain form
  const [newDomain, setNewDomain] = useState('');
  const [newDomainLimit, setNewDomainLimit] = useState(50);
  const [newDomainResendId, setNewDomainResendId] = useState('');
  const [newDomainNotes, setNewDomainNotes] = useState('');

  // Add inbox form
  const [newInboxDomainId, setNewInboxDomainId] = useState<number | ''>('');
  const [newInboxEmail, setNewInboxEmail] = useState('');
  const [newInboxDisplayName, setNewInboxDisplayName] = useState('');
  const [newInboxLimit, setNewInboxLimit] = useState(50);

  const inputCls = 'w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors';
  const btnPrimary = 'px-4 py-2 rounded-lg bg-elvora-accent text-white text-sm font-medium hover:bg-elvora-accent/90 transition-colors';
  const btnSecondary = 'px-4 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm font-medium hover:bg-white/5 transition-colors';

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch('/api/outbound/stats');
      if (res.ok) setStats(await res.json());
    } catch { /* silent */ }
  }, []);

  const loadDomains = useCallback(async () => {
    try {
      const res = await fetch('/api/outbound/domains');
      if (res.ok) {
        const data = await res.json();
        setDomains(Array.isArray(data) ? data : data.domains || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadInboxes = useCallback(async () => {
    try {
      const res = await fetch('/api/outbound/inboxes');
      if (res.ok) {
        const data = await res.json();
        setInboxes(Array.isArray(data) ? data : data.inboxes || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadStats();
    loadDomains();
  }, [loadStats, loadDomains]);

  useEffect(() => {
    if (tab === 'inboxes') loadInboxes();
  }, [tab, loadInboxes]);

  async function patchDomain(id: number, status: string) {
    try {
      const res = await fetch(`/api/outbound/domains/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) { loadDomains(); loadStats(); }
    } catch { /* silent */ }
  }

  async function patchInbox(id: number, status: string) {
    try {
      const res = await fetch(`/api/outbound/inboxes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) loadInboxes();
    } catch { /* silent */ }
  }

  async function deleteInbox(id: number) {
    if (!confirm('Inbox wirklich löschen?')) return;
    try {
      const res = await fetch(`/api/outbound/inboxes/${id}`, { method: 'DELETE' });
      if (res.ok) loadInboxes();
    } catch { /* silent */ }
  }

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/outbound/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain,
          daily_limit: newDomainLimit,
          resend_domain_id: newDomainResendId || null,
          notes: newDomainNotes || null,
        }),
      });
      if (res.ok) {
        setNewDomain(''); setNewDomainLimit(50); setNewDomainResendId(''); setNewDomainNotes('');
        setTab('domains');
        loadDomains(); loadStats();
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleAddInbox(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/outbound/inboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_id: newInboxDomainId,
          email: newInboxEmail,
          display_name: newInboxDisplayName || null,
          daily_limit: newInboxLimit,
        }),
      });
      if (res.ok) {
        setNewInboxEmail(''); setNewInboxDisplayName(''); setNewInboxLimit(50); setNewInboxDomainId('');
        setTab('inboxes');
        loadInboxes();
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'domains', label: 'Domains-Übersicht' },
    { key: 'inboxes', label: 'Postfächer' },
    { key: 'domain-hinzufuegen', label: 'Domain hinzufügen' },
    { key: 'inbox-hinzufuegen', label: 'Inbox hinzufügen' },
  ];

  function healthColor(score: number) {
    if (score > 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-elvora-text">Outbound-Infrastruktur</h1>
        {stats && (
          <p className="text-sm text-elvora-text-dim mt-1">
            {stats.active_domains} Domains aktiv &middot; {stats.warming_domains} warming &middot; Heute gesendet: {stats.sent_today}/{stats.daily_limit}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-elvora-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-elvora-purple text-elvora-text'
                : 'border-transparent text-elvora-text-dim hover:text-elvora-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Domains */}
      {tab === 'domains' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {domains.map(d => {
            const dns = parseDns(d.dns_status || '{}');
            const pct = d.daily_limit > 0 ? Math.min((d.sent_today / d.daily_limit) * 100, 100) : 0;
            return (
              <div key={d.id} className="card rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-base font-semibold text-elvora-text">{d.domain}</h3>
                  <StatusBadge status={d.status} warmingDay={d.warming_day} />
                </div>

                {/* Health score */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-elvora-text-dim">Gesundheitswert</span>
                    <span className="text-xs font-medium text-elvora-text">{d.health_score}</span>
                  </div>
                  <div className="w-full h-1.5 bg-elvora-border rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${healthColor(d.health_score)}`} style={{ width: `${d.health_score}%` }} />
                  </div>
                </div>

                {/* Sent today */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-elvora-text-dim">Heute: {d.sent_today}/{d.daily_limit} gesendet</span>
                  </div>
                  <div className="w-full h-1.5 bg-elvora-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-elvora-purple" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* DNS Status */}
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-xs text-elvora-text-dim mr-1">DNS:</span>
                  <DnsBadge ok={dns.spf} label="SPF" />
                  <DnsBadge ok={dns.dkim} label="DKIM" />
                  <DnsBadge ok={dns.dmarc} label="DMARC" />
                </div>

                {/* Total sent */}
                <div className="text-xs text-elvora-text-dim mb-4">
                  Total gesendet: <span className="text-elvora-text font-medium">{d.total_sent}</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {(d.status === 'warming' || d.status === 'active') && (
                    <button onClick={() => patchDomain(d.id, 'paused')} className={btnSecondary}>
                      Pausieren
                    </button>
                  )}
                  {d.status === 'paused' && (
                    <button onClick={() => patchDomain(d.id, 'active')} className={btnPrimary}>
                      Fortsetzen
                    </button>
                  )}
                  {d.status !== 'burned' && (
                    <button
                      onClick={() => patchDomain(d.id, 'burned')}
                      className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
                    >
                      Als verbrannt markieren
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {domains.length === 0 && (
            <div className="col-span-full text-center py-12 text-elvora-text-dim text-sm">
              Keine Domains vorhanden. F&uuml;gen Sie eine neue Domain hinzu.
            </div>
          )}
        </div>
      )}

      {/* Tab: Inboxes */}
      {tab === 'inboxes' && (
        <div className="card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-elvora-border">
                  <th className="text-left px-4 py-3 text-elvora-text-dim font-medium text-xs">E-Mail</th>
                  <th className="text-left px-4 py-3 text-elvora-text-dim font-medium text-xs">Domain</th>
                  <th className="text-left px-4 py-3 text-elvora-text-dim font-medium text-xs">Status</th>
                  <th className="text-left px-4 py-3 text-elvora-text-dim font-medium text-xs">Heute</th>
                  <th className="text-left px-4 py-3 text-elvora-text-dim font-medium text-xs">Limit</th>
                  <th className="text-left px-4 py-3 text-elvora-text-dim font-medium text-xs">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {inboxes.map(inbox => (
                  <tr key={inbox.id} className="border-b border-elvora-border last:border-0">
                    <td className="px-4 py-3 text-elvora-text">{inbox.email}</td>
                    <td className="px-4 py-3 text-elvora-text-dim">{inbox.domain || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inbox.status} />
                    </td>
                    <td className="px-4 py-3 text-elvora-text">{inbox.sent_today}</td>
                    <td className="px-4 py-3 text-elvora-text-dim">{inbox.daily_limit}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inbox.status === 'active' ? (
                          <button onClick={() => patchInbox(inbox.id, 'paused')} className="text-xs text-elvora-text-dim hover:text-elvora-text transition-colors">
                            Pausieren
                          </button>
                        ) : (
                          <button onClick={() => patchInbox(inbox.id, 'active')} className="text-xs text-elvora-purple hover:text-elvora-purple-light transition-colors">
                            Fortsetzen
                          </button>
                        )}
                        <button onClick={() => deleteInbox(inbox.id)} className="text-xs text-red-400 hover:text-red-300 transition-colors">
                          L&ouml;schen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {inboxes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-elvora-text-dim text-sm">
                      Keine Postf&auml;cher vorhanden.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Add Domain */}
      {tab === 'domain-hinzufuegen' && (
        <div className="card rounded-xl p-5 max-w-lg">
          <h2 className="text-lg font-semibold text-elvora-text mb-4">Domain hinzuf&uuml;gen</h2>
          <form onSubmit={handleAddDomain} className="space-y-4">
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">Domain</label>
              <input
                type="text"
                required
                value={newDomain}
                onChange={e => setNewDomain(e.target.value)}
                placeholder="z.B. getelvora.io"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">Tageslimit</label>
              <input
                type="number"
                value={newDomainLimit}
                onChange={e => setNewDomainLimit(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">Resend Domain-ID</label>
              <input
                type="text"
                value={newDomainResendId}
                onChange={e => setNewDomainResendId(e.target.value)}
                placeholder="Optional"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">Notizen</label>
              <textarea
                value={newDomainNotes}
                onChange={e => setNewDomainNotes(e.target.value)}
                rows={3}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Wird hinzugefügt...' : 'Domain hinzufügen'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Add Inbox */}
      {tab === 'inbox-hinzufuegen' && (
        <div className="card rounded-xl p-5 max-w-lg">
          <h2 className="text-lg font-semibold text-elvora-text mb-4">Inbox hinzuf&uuml;gen</h2>
          <form onSubmit={handleAddInbox} className="space-y-4">
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">Domain</label>
              <select
                required
                value={newInboxDomainId}
                onChange={e => setNewInboxDomainId(e.target.value ? Number(e.target.value) : '')}
                className={inputCls}
              >
                <option value="">Domain w&auml;hlen...</option>
                {domains.map(d => (
                  <option key={d.id} value={d.id}>{d.domain}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">E-Mail-Adresse</label>
              <input
                type="email"
                required
                value={newInboxEmail}
                onChange={e => setNewInboxEmail(e.target.value)}
                placeholder="z.B. luan@getelvora.io"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">Anzeigename</label>
              <input
                type="text"
                value={newInboxDisplayName}
                onChange={e => setNewInboxDisplayName(e.target.value)}
                placeholder="z.B. Luan von Elvora"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm text-elvora-text-dim mb-1.5">Tageslimit</label>
              <input
                type="number"
                value={newInboxLimit}
                onChange={e => setNewInboxLimit(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? 'Wird hinzugefügt...' : 'Inbox hinzufügen'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
