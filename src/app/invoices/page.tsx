'use client';

import { useState, useEffect, useCallback } from 'react';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  recipient_name: string;
  recipient_address: string;
  recipient_email: string;
  items: InvoiceItem[];
  net_total: number;
  tax_rate: number;
  tax_amount: number;
  gross_total: number;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue';
  due_date: string;
  payment_days: number;
  notes: string;
  is_recurring: boolean;
  recurring_interval: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  draft: { label: 'Entwurf', classes: 'bg-white/10 text-elvora-text-muted' },
  sent: { label: 'Gesendet', classes: 'bg-blue-500/15 text-blue-400' },
  viewed: { label: 'Angesehen', classes: 'bg-yellow-500/15 text-yellow-400' },
  paid: { label: 'Bezahlt', classes: 'bg-emerald-500/15 text-emerald-400' },
  overdue: { label: 'Überfällig', classes: 'bg-red-500/15 text-red-400' },
};

const fmtCurrency = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, unit_price: 0, total: 0 },
  ]);
  const [taxRate, setTaxRate] = useState(19);
  const [paymentDays, setPaymentDays] = useState(14);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('monatlich');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const res = await fetch(`/api/invoices?${params}`);
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const resetForm = () => {
    setRecipientName('');
    setRecipientAddress('');
    setRecipientEmail('');
    setItems([{ description: '', quantity: 1, unit_price: 0, total: 0 }]);
    setTaxRate(19);
    setPaymentDays(14);
    setNotes('');
    setIsRecurring(false);
    setRecurringInterval('monatlich');
    setShowForm(false);
  };

  const updateItem = (idx: number, updates: Partial<InvoiceItem>) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...updates };
      updated.total = updated.quantity * updated.unit_price;
      return updated;
    }));
  };

  const addItem = () => {
    setItems(prev => [...prev, { description: '', quantity: 1, unit_price: 0, total: 0 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const netTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = netTotal * (taxRate / 100);
  const grossTotal = netTotal + taxAmount;

  const createInvoice = async () => {
    if (!recipientName.trim() || items.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_name: recipientName.trim(),
          recipient_address: recipientAddress.trim(),
          recipient_email: recipientEmail.trim(),
          items: items.map(i => ({ ...i, total: i.quantity * i.unit_price })),
          tax_rate: taxRate,
          payment_days: paymentDays,
          notes: notes.trim(),
          is_recurring: isRecurring,
          recurring_interval: isRecurring ? recurringInterval : null,
        }),
      });
      if (res.ok) {
        resetForm();
        loadInvoices();
      }
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  const sendInvoice = async (id: number) => {
    try {
      await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      loadInvoices();
    } catch { /* silent */ }
  };

  const markPaid = async (id: number) => {
    try {
      await fetch(`/api/invoices/${id}/mark-paid`, { method: 'POST' });
      loadInvoices();
    } catch { /* silent */ }
  };

  const deleteInvoice = async (id: number) => {
    try {
      await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      loadInvoices();
    } catch { /* silent */ }
  };

  // Stats
  const openInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'viewed');
  const openTotal = openInvoices.reduce((sum, i) => sum + (i.gross_total || 0), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const paidThisMonth = invoices
    .filter(i => i.status === 'paid' && new Date(i.created_at) >= monthStart)
    .reduce((sum, i) => sum + (i.gross_total || 0), 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  const filterTabs = [
    { key: 'all', label: 'Alle' },
    { key: 'draft', label: 'Entwurf' },
    { key: 'sent', label: 'Gesendet' },
    { key: 'paid', label: 'Bezahlt' },
    { key: 'overdue', label: 'Überfällig' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Rechnungen</h1>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/invoices?format=csv"
            className="px-3 py-2 rounded-lg bg-white/5 text-elvora-text-muted text-sm hover:bg-white/10 hover:text-white transition-all flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV Export
          </a>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Neue Rechnung
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {[
          { label: 'Offene Rechnungen', value: String(openInvoices.length), color: 'text-elvora-purple-light' },
          { label: 'Offen Gesamt', value: `${fmtCurrency(openTotal)} €`, color: 'text-elvora-accent' },
          { label: 'Bezahlt (Monat)', value: `${fmtCurrency(paidThisMonth)} €`, color: 'text-elvora-success' },
          { label: 'Überfällig', value: String(overdueCount), color: overdueCount > 0 ? 'text-red-400' : 'text-elvora-text-dim' },
        ].map((stat, i) => (
          <div key={i} className="card rounded-xl p-4">
            <div className="text-[11px] text-elvora-text-dim uppercase tracking-wider mb-1">{stat.label}</div>
            <div className={`text-2xl font-semibold stat-number ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === tab.key
                ? 'bg-elvora-purple/20 text-elvora-purple-light border border-elvora-purple/30'
                : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 border border-transparent'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-elvora-text">Neue Rechnung</h2>
            <button onClick={resetForm} className="text-elvora-text-dim hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Recipient */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="Empfänger Name"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
            />
            <input
              type="text"
              value={recipientAddress}
              onChange={e => setRecipientAddress(e.target.value)}
              placeholder="Adresse"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
            />
            <input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="E-Mail"
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="text-[11px] text-elvora-text-dim uppercase tracking-wider mb-2">Positionen</div>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-elvora-border">
                    <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2 font-medium">Beschreibung</th>
                    <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2 font-medium w-20">Menge</th>
                    <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2 font-medium w-28">Einzelpreis</th>
                    <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-2 font-medium w-28">Gesamt</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-elvora-border/50">
                      <td className="py-2 pr-2">
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(idx, { description: e.target.value })}
                          placeholder="Beschreibung..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-elvora-purple/50"
                        />
                      </td>
                      <td className="py-2 px-1">
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unit_price}
                          onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-elvora-purple/50"
                        />
                      </td>
                      <td className="py-2 px-1 text-right text-sm text-elvora-text-muted">
                        {fmtCurrency(item.quantity * item.unit_price)} €
                      </td>
                      <td className="py-2 pl-1">
                        {items.length > 1 && (
                          <button
                            onClick={() => removeItem(idx)}
                            className="text-elvora-text-dim hover:text-red-400 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              onClick={addItem}
              className="mt-2 text-xs text-elvora-purple-light hover:text-elvora-purple transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Position hinzufügen
            </button>
          </div>

          {/* Tax + Totals */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-xs text-elvora-text-muted w-24">MwSt</label>
                <select
                  value={taxRate}
                  onChange={e => setTaxRate(parseInt(e.target.value))}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
                >
                  <option value={19}>19%</option>
                  <option value={7}>7%</option>
                  <option value={0}>0%</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-elvora-text-muted w-24">Zahlungsziel</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={paymentDays}
                    onChange={e => setPaymentDays(parseInt(e.target.value) || 14)}
                    className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-right focus:outline-none focus:border-elvora-purple/50"
                  />
                  <span className="text-xs text-elvora-text-dim">Tage</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-elvora-text-muted w-24">Wiederkehrend</label>
                <button
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    isRecurring ? 'bg-elvora-success' : 'bg-white/10'
                  }`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                    isRecurring ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
                {isRecurring && (
                  <select
                    value={recurringInterval}
                    onChange={e => setRecurringInterval(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
                  >
                    <option value="monatlich">Monatlich</option>
                    <option value="quartalsweise">Quartalsweise</option>
                    <option value="jährlich">Jährlich</option>
                  </select>
                )}
              </div>
            </div>

            <div className="bg-elvora-bg-alt rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-muted">Netto</span>
                <span className="text-elvora-text font-medium">{fmtCurrency(netTotal)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-muted">MwSt ({taxRate}%)</span>
                <span className="text-elvora-text font-medium">{fmtCurrency(taxAmount)} €</span>
              </div>
              <div className="border-t border-elvora-border pt-2 flex justify-between">
                <span className="text-sm font-semibold text-elvora-text">Brutto</span>
                <span className="text-lg font-semibold text-elvora-success stat-number">{fmtCurrency(grossTotal)} €</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notizen (optional)..."
            rows={2}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
          />

          {/* Save */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={resetForm} className="px-4 py-2 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors">
              Abbrechen
            </button>
            <button
              onClick={createInvoice}
              disabled={saving || !recipientName.trim()}
              className="px-5 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? 'Speichern...' : 'Rechnung erstellen'}
            </button>
          </div>
        </div>
      )}

      {/* Invoice Table */}
      {loading ? (
        <div className="text-center py-12 text-elvora-text-dim text-sm">Laden...</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-elvora-text-dim text-sm mb-2">Keine Rechnungen vorhanden</div>
          <button onClick={() => setShowForm(true)} className="text-elvora-purple-light text-sm hover:underline">
            Erste Rechnung erstellen
          </button>
        </div>
      ) : (
        <div className="card rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-elvora-border">
                  <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider p-4 font-medium">Rechnungsnr</th>
                  <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider p-4 font-medium">Empfänger</th>
                  <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider p-4 font-medium">Betrag</th>
                  <th className="text-center text-[10px] text-elvora-text-dim uppercase tracking-wider p-4 font-medium">Status</th>
                  <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider p-4 font-medium">Fällig am</th>
                  <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider p-4 font-medium">Erstellt</th>
                  <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider p-4 font-medium">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-elvora-border/50">
                {invoices.map(inv => {
                  const cfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                  return (
                    <tr key={inv.id} className="hover:bg-elvora-bg-alt transition-colors">
                      <td className="p-4 text-sm font-medium text-elvora-text">{inv.invoice_number || `#${inv.id}`}</td>
                      <td className="p-4">
                        <div className="text-sm text-elvora-text">{inv.recipient_name}</div>
                        {inv.recipient_email && (
                          <div className="text-[11px] text-elvora-text-dim">{inv.recipient_email}</div>
                        )}
                      </td>
                      <td className="p-4 text-right text-sm font-semibold text-elvora-text stat-number">
                        {fmtCurrency(inv.gross_total || 0)} €
                      </td>
                      <td className="p-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${cfg.classes}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="p-4 text-sm text-elvora-text-muted">
                        {inv.due_date ? new Date(inv.due_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '–'}
                      </td>
                      <td className="p-4 text-sm text-elvora-text-dim">
                        {new Date(inv.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => sendInvoice(inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 text-[11px] font-medium hover:bg-blue-500/20 transition-colors"
                            >
                              Senden
                            </button>
                          )}
                          {(inv.status === 'sent' || inv.status === 'viewed') && (
                            <button
                              onClick={() => markPaid(inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-[11px] font-medium hover:bg-emerald-500/20 transition-colors"
                            >
                              Als bezahlt
                            </button>
                          )}
                          {inv.status === 'draft' && (
                            <button
                              onClick={() => deleteInvoice(inv.id)}
                              className="px-2.5 py-1 rounded-lg bg-white/5 text-elvora-text-dim text-[11px] hover:bg-red-500/10 hover:text-red-400 transition-colors"
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
