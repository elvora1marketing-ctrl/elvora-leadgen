'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Account {
  id: number;
  name: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  status: string;
  icp_description: string | null;
  monthly_fee: number;
  portal_token: string | null;
  onboarding_completed: number;
  contract_start: string | null;
  contract_end: string | null;
  notes: string | null;
  created_at: string;
  stats?: AccountStats;
}

interface AccountStats {
  totalLeads: number;
  leadsWithEmail: number;
  totalCampaigns: number;
  activeCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalBounced: number;
  activeDomains: number;
  activeSequences: number;
  blacklistCount: number;
  sentToday: number;
  dailyCapacity: number;
}

interface BlacklistEntry {
  id: number;
  email: string;
  domain: string | null;
  reason: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  active: 'Aktiv',
  paused: 'Pausiert',
  churned: 'Abgewandert',
};

const STATUS_COLORS: Record<string, string> = {
  onboarding: 'bg-yellow-500/20 text-yellow-400',
  active: 'bg-green-500/20 text-green-400',
  paused: 'bg-gray-500/20 text-gray-400',
  churned: 'bg-red-500/20 text-red-400',
};

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [view, setView] = useState<'list' | 'add' | 'detail'>('list');
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '', company: '', contact_name: '', contact_email: '', contact_phone: '',
    monthly_fee: '', notes: '', icp_description: '',
  });

  const [saving, setSaving] = useState(false);
  const [blacklistInput, setBlacklistInput] = useState('');

  const loadAccounts = useCallback(async (showLoading = false) => {
    if (showLoading) setInitialLoad(true);
    try {
      const url = statusFilter ? `/api/accounts?stats=1&status=${statusFilter}` : '/api/accounts?stats=1';
      const res = await fetch(url);
      if (res.ok) setAccounts(await res.json());
    } catch {}
    setInitialLoad(false);
  }, [statusFilter]);

  useEffect(() => { loadAccounts(true); }, [loadAccounts]);

  const loadBlacklist = async (accountId: number) => {
    const res = await fetch(`/api/accounts/${accountId}/blacklist`);
    if (res.ok) setBlacklist(await res.json());
  };

  const createAccount = async () => {
    if (!form.name.trim()) { setError('Kontoname ist erforderlich'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          company: form.company.trim() || null,
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          monthly_fee: parseFloat(form.monthly_fee) || 0,
          notes: form.notes.trim() || null,
          icp_description: form.icp_description.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Fehler: HTTP ${res.status}`);
        setSaving(false);
        return;
      }
      const newAccount = await res.json();
      setAccounts(prev => [{ ...newAccount, stats: { totalLeads: 0, leadsWithEmail: 0, totalCampaigns: 0, activeCampaigns: 0, totalSent: 0, totalOpened: 0, totalReplied: 0, totalBounced: 0, activeDomains: 0, activeSequences: 0, blacklistCount: 0, sentToday: 0, dailyCapacity: 0 } }, ...prev]);
      setForm({ name: '', company: '', contact_name: '', contact_email: '', contact_phone: '', monthly_fee: '', notes: '', icp_description: '' });
      setView('list');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Netzwerkfehler');
    }
    setSaving(false);
  };

  const updateStatus = async (id: number, newStatus: string) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
    if (selectedAccount?.id === id) {
      setSelectedAccount(prev => prev ? { ...prev, status: newStatus } : null);
    }
    await fetch(`/api/accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
  };

  const deleteAccount = async (id: number) => {
    if (!confirm('Konto wirklich löschen? Leads werden entkoppelt, nicht gelöscht.')) return;
    setAccounts(prev => prev.filter(a => a.id !== id));
    setView('list');
    setSelectedAccount(null);
    await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
  };

  const addToBlacklist = async () => {
    if (!selectedAccount || !blacklistInput.trim()) return;
    const emails = blacklistInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    const tempEntries: BlacklistEntry[] = emails.map((email, i) => ({
      id: -(i + 1), email, domain: email.includes('@') ? email.split('@')[1] : null, reason: null, created_at: new Date().toISOString(),
    }));
    setBlacklist(prev => [...tempEntries, ...prev]);
    setBlacklistInput('');
    await fetch(`/api/accounts/${selectedAccount.id}/blacklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    loadBlacklist(selectedAccount.id);
  };

  const removeFromBlacklist = async (email: string) => {
    if (!selectedAccount) return;
    setBlacklist(prev => prev.filter(b => b.email !== email));
    await fetch(`/api/accounts/${selectedAccount.id}/blacklist?email=${encodeURIComponent(email)}`, { method: 'DELETE' });
  };

  const openDetail = (account: Account) => {
    setSelectedAccount(account);
    setView('detail');
    loadBlacklist(account.id);
  };

  const openDashboard = (account: Account) => {
    router.push(`/accounts/${account.id}`);
  };

  const totalMRR = accounts.filter(a => a.status === 'active').reduce((s, a) => s + a.monthly_fee, 0);
  const activeCount = accounts.filter(a => a.status === 'active').length;
  const onboardingCount = accounts.filter(a => a.status === 'onboarding').length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Konten</h1>
          <p className="text-elvora-text-muted text-sm mt-1">Outbound-as-a-Service Kundenverwaltung</p>
        </div>
        <div className="flex gap-2">
          {view !== 'list' && (
            <button onClick={() => { setView('list'); setSelectedAccount(null); setError(''); }} className="px-4 py-2 rounded-lg bg-elvora-darker text-elvora-text-muted hover:text-white transition">
              ← Zurück
            </button>
          )}
          {view === 'list' && (
            <button onClick={() => { setView('add'); setError(''); }} className="px-4 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition">
              + Neues Konto
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card-glass p-4 rounded-xl">
          <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Gesamt</p>
          <p className="text-2xl font-bold text-white mt-1">{accounts.length}</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Aktiv</p>
          <p className="text-2xl font-bold text-green-400 mt-1">{activeCount}</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Onboarding</p>
          <p className="text-2xl font-bold text-yellow-400 mt-1">{onboardingCount}</p>
        </div>
        <div className="card-glass p-4 rounded-xl">
          <p className="text-elvora-text-muted text-xs uppercase tracking-wider">MRR</p>
          <p className="text-2xl font-bold text-elvora-accent mt-1">{totalMRR.toLocaleString('de-DE')} €</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-300 ml-4">✕</button>
        </div>
      )}

      {/* Add Form */}
      {view === 'add' && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white">Neues Konto erstellen</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder="Kontoname *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted"
              onKeyDown={e => e.key === 'Enter' && createAccount()} />
            <input placeholder="Firma" value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" />
            <input placeholder="Ansprechpartner" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" />
            <input placeholder="E-Mail" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" />
            <input placeholder="Telefon" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" />
            <input placeholder="Monatliche Gebühr (€)" value={form.monthly_fee} onChange={e => setForm(f => ({ ...f, monthly_fee: e.target.value }))}
              className="px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" type="number" />
          </div>
          <textarea placeholder="ICP-Beschreibung (Zielgruppe)" value={form.icp_description} onChange={e => setForm(f => ({ ...f, icp_description: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted h-20" />
          <textarea placeholder="Notizen" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted h-20" />
          <button onClick={createAccount} disabled={saving || !form.name.trim()}
            className="px-6 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition disabled:opacity-50">
            {saving ? 'Speichern...' : 'Konto erstellen'}
          </button>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <>
          <div className="flex gap-2">
            {['', 'active', 'onboarding', 'paused', 'churned'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm transition ${statusFilter === s ? 'bg-elvora-accent text-white' : 'bg-elvora-darker text-elvora-text-muted hover:text-white'}`}>
                {s ? STATUS_LABELS[s] : 'Alle'}
              </button>
            ))}
          </div>

          {initialLoad ? (
            <div className="text-elvora-text-muted text-center py-12">Laden...</div>
          ) : accounts.length === 0 ? (
            <div className="card-glass p-12 rounded-xl text-center">
              <p className="text-elvora-text-muted">Noch keine Konten vorhanden.</p>
              <button onClick={() => setView('add')} className="mt-4 px-4 py-2 rounded-lg bg-elvora-accent text-white">
                Erstes Konto erstellen
              </button>
            </div>
          ) : (
            <div className="card-glass rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-elvora-text-muted text-xs uppercase tracking-wider">
                    <th className="px-4 py-3">Konto</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Leads</th>
                    <th className="px-4 py-3">Gesendet</th>
                    <th className="px-4 py-3">Antworten</th>
                    <th className="px-4 py-3">MRR</th>
                    <th className="px-4 py-3">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition" onClick={() => openDashboard(a)}>
                      <td className="px-4 py-3">
                        <div className="text-white font-medium">{a.name}</div>
                        {a.company && <div className="text-elvora-text-muted text-xs">{a.company}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status]}`}>
                          {STATUS_LABELS[a.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white">{a.stats?.totalLeads || 0}</td>
                      <td className="px-4 py-3 text-white">{a.stats?.totalSent || 0}</td>
                      <td className="px-4 py-3 text-white">{a.stats?.totalReplied || 0}</td>
                      <td className="px-4 py-3 text-elvora-accent font-medium">{a.monthly_fee.toLocaleString('de-DE')} €</td>
                      <td className="px-4 py-3">
                        <select
                          value={a.status}
                          onChange={e => { e.stopPropagation(); updateStatus(a.id, e.target.value); }}
                          onClick={e => e.stopPropagation()}
                          className="bg-elvora-darker border border-white/10 text-white text-xs rounded px-2 py-1">
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Detail View */}
      {view === 'detail' && selectedAccount && (
        <div className="space-y-6">
          <div className="card-glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selectedAccount.name}</h2>
                {selectedAccount.company && <p className="text-elvora-text-muted text-sm">{selectedAccount.company}</p>}
              </div>
              <div className="flex gap-2 items-center">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[selectedAccount.status]}`}>
                  {STATUS_LABELS[selectedAccount.status]}
                </span>
                {!selectedAccount.onboarding_completed && (
                  <button onClick={() => router.push(`/accounts/onboarding?id=${selectedAccount.id}`)}
                    className="px-3 py-1.5 rounded-lg bg-elvora-accent/20 text-elvora-accent hover:bg-elvora-accent/30 text-xs transition">
                    Onboarding starten
                  </button>
                )}
                <button onClick={() => deleteAccount(selectedAccount.id)}
                  className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs transition">
                  Löschen
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-elvora-text-muted">Kontakt:</span> <span className="text-white">{selectedAccount.contact_name || '—'}</span></div>
              <div><span className="text-elvora-text-muted">E-Mail:</span> <span className="text-white">{selectedAccount.contact_email || '—'}</span></div>
              <div><span className="text-elvora-text-muted">Telefon:</span> <span className="text-white">{selectedAccount.contact_phone || '—'}</span></div>
              <div><span className="text-elvora-text-muted">MRR:</span> <span className="text-elvora-accent font-medium">{selectedAccount.monthly_fee.toLocaleString('de-DE')} €</span></div>
            </div>
            {selectedAccount.portal_token && (
              <div className="mt-4 p-3 rounded-lg bg-elvora-darker border border-white/10">
                <p className="text-xs text-elvora-text-muted mb-1">Portal-Link (für Kunden):</p>
                <code className="text-xs text-elvora-accent break-all">
                  {typeof window !== 'undefined' ? `${window.location.origin}/account-portal/${selectedAccount.portal_token}` : `/account-portal/${selectedAccount.portal_token}`}
                </code>
              </div>
            )}
          </div>

          {selectedAccount.stats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: 'Leads', value: selectedAccount.stats.totalLeads, color: 'text-white' },
                { label: 'Gesendet', value: selectedAccount.stats.totalSent, color: 'text-blue-400' },
                { label: 'Geöffnet', value: selectedAccount.stats.totalOpened, color: 'text-yellow-400' },
                { label: 'Antworten', value: selectedAccount.stats.totalReplied, color: 'text-green-400' },
                { label: 'Bounces', value: selectedAccount.stats.totalBounced, color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="card-glass p-3 rounded-xl text-center">
                  <p className="text-elvora-text-muted text-xs">{s.label}</p>
                  <p className={`text-xl font-bold ${s.color} mt-1`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {selectedAccount.stats && selectedAccount.stats.dailyCapacity > 0 && (
            <div className="card-glass p-4 rounded-xl">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-elvora-text-muted">Heute gesendet</span>
                <span className="text-white">{selectedAccount.stats.sentToday} / {selectedAccount.stats.dailyCapacity}</span>
              </div>
              <div className="w-full h-2 bg-elvora-darker rounded-full overflow-hidden">
                <div className="h-full bg-elvora-accent rounded-full transition-all" style={{ width: `${Math.min(100, (selectedAccount.stats.sentToday / selectedAccount.stats.dailyCapacity) * 100)}%` }} />
              </div>
            </div>
          )}

          <div className="card-glass p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Blacklist ({blacklist.length})</h3>
            <div className="flex gap-2 mb-4">
              <textarea placeholder="E-Mails eingeben (eine pro Zeile, oder kommagetrennt)" value={blacklistInput}
                onChange={e => setBlacklistInput(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted text-sm h-16" />
              <button onClick={addToBlacklist} disabled={!blacklistInput.trim()}
                className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition self-end disabled:opacity-50">
                Hinzufügen
              </button>
            </div>
            {blacklist.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {blacklist.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-1.5 rounded bg-elvora-darker text-sm">
                    <span className="text-white">{b.email}</span>
                    <button onClick={() => removeFromBlacklist(b.email)} className="text-red-400 hover:text-red-300 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
