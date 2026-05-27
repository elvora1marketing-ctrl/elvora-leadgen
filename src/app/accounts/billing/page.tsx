'use client';

import { useState, useEffect } from 'react';

interface AccountBilling {
  id: number; name: string; company: string | null; status: string;
  monthly_fee: number; contract_start: string | null; contract_end: string | null;
  total_invoices: number; paid_total: number; outstanding: number; overdue: number;
  emails_sent: number; replies: number; lead_count: number;
  cost_per_lead: number; cost_per_reply: number;
}

interface Summary {
  totalMRR: number; arr: number; totalPaid: number;
  totalOutstanding: number; totalOverdue: number;
  activeAccounts: number; totalAccounts: number;
}

const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function BillingDashboardPage() {
  const [accounts, setAccounts] = useState<AccountBilling[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/accounts/billing')
      .then(r => r.json())
      .then(data => {
        setAccounts(data.accounts || []);
        setSummary(data.summary || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-elvora-text-muted text-center py-12">Laden...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing Dashboard</h1>
        <p className="text-elvora-text-muted text-sm mt-1">Umsatz und Marge pro Account</p>
      </div>

      {/* Summary KPIs */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">MRR</p>
            <p className="text-2xl font-bold text-elvora-accent mt-1">{fmt(summary.totalMRR)} €</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">ARR</p>
            <p className="text-2xl font-bold text-white mt-1">{fmt(summary.arr)} €</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Bezahlt</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{fmt(summary.totalPaid)} €</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Offen</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{fmt(summary.totalOutstanding)} €</p>
          </div>
          <div className="card-glass p-4 rounded-xl text-center">
            <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Überfällig</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{fmt(summary.totalOverdue)} €</p>
          </div>
        </div>
      )}

      {/* Account Table */}
      {accounts.length === 0 ? (
        <div className="card-glass p-12 rounded-xl text-center text-elvora-text-muted">Keine Konten vorhanden.</div>
      ) : (
        <div className="card-glass rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead>
              <tr className="border-b border-white/10 text-elvora-text-muted text-xs uppercase tracking-wider">
                <th className="px-4 py-3">Konto</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">MRR</th>
                <th className="px-4 py-3 text-right">Bezahlt</th>
                <th className="px-4 py-3 text-right">Offen</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Mails</th>
                <th className="px-4 py-3 text-right">Antworten</th>
                <th className="px-4 py-3 text-right">€/Lead</th>
                <th className="px-4 py-3 text-right">€/Antwort</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{a.name}</div>
                    {a.company && <div className="text-elvora-text-muted text-xs">{a.company}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${a.status === 'active' ? 'bg-green-500/20 text-green-400' : a.status === 'churned' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-elvora-accent font-medium">{fmt(a.monthly_fee)} €</td>
                  <td className="px-4 py-3 text-right text-green-400">{fmt(a.paid_total)} €</td>
                  <td className="px-4 py-3 text-right">
                    <span className={a.overdue > 0 ? 'text-red-400' : 'text-yellow-400'}>
                      {fmt(a.outstanding + a.overdue)} €
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white">{a.lead_count}</td>
                  <td className="px-4 py-3 text-right text-white">{a.emails_sent}</td>
                  <td className="px-4 py-3 text-right text-green-400">{a.replies}</td>
                  <td className="px-4 py-3 text-right text-elvora-text-muted">{a.cost_per_lead > 0 ? `${fmt(a.cost_per_lead)} €` : '—'}</td>
                  <td className="px-4 py-3 text-right text-elvora-text-muted">{a.cost_per_reply > 0 ? `${fmt(a.cost_per_reply)} €` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
