'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  token: string;
  client_name: string | null;
  recipient_name: string;
  recipient_address: string | null;
  recipient_email: string | null;
  items: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  currency: string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  notes: string | null;
  views: number;
  created_at: string;
  sent_at: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  draft: { label: 'Entwurf', classes: 'bg-white/10 text-elvora-text-muted' },
  sent: { label: 'Gesendet', classes: 'bg-blue-500/15 text-blue-400' },
  viewed: { label: 'Angesehen', classes: 'bg-yellow-500/15 text-yellow-400' },
  paid: { label: 'Bezahlt', classes: 'bg-emerald-500/15 text-emerald-400' },
  overdue: { label: 'Überfällig', classes: 'bg-red-500/15 text-red-400' },
  cancelled: { label: 'Storniert', classes: 'bg-red-500/15 text-red-400' },
};

const fmtCurrency = (n: number) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable fields
  const [recipientName, setRecipientName] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [taxRate, setTaxRate] = useState(19);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const loadInvoice = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Rechnung nicht gefunden');
        return;
      }
      const data = await res.json();
      const inv = data.invoice as Invoice;
      setInvoice(inv);

      setRecipientName(inv.recipient_name || '');
      setRecipientAddress(inv.recipient_address || '');
      setRecipientEmail(inv.recipient_email || '');
      setNotes(inv.notes || '');
      setDueDate(inv.due_date || '');
      setTaxRate(inv.tax_rate ?? 19);

      try {
        const parsed = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
        setItems(
          (parsed as InvoiceItem[]).map((item) => ({
            description: item.description || '',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
          }))
        );
      } catch {
        setItems([{ description: '', quantity: 1, unit_price: 0 }]);
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadInvoice();
  }, [id, loadInvoice]);

  // Item helpers
  const updateItem = (idx: number, updates: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, ...updates } : item))
    );
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculated totals
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  // Save
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_name: recipientName,
          recipient_address: recipientAddress,
          recipient_email: recipientEmail,
          notes,
          due_date: dueDate || null,
          tax_rate: taxRate,
          items: items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unit_price: i.unit_price,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Rechnung gespeichert');
        if (data.invoice) setInvoice(data.invoice);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  };

  // Send
  const handleSend = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Rechnung gesendet');
        await loadInvoice();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Fehler beim Senden');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setSending(false);
    }
  };

  // Mark paid
  const handleMarkPaid = async () => {
    setMarkingPaid(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`/api/invoices/${id}/mark-paid`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Rechnung als bezahlt markiert');
        await loadInvoice();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.error || 'Fehler');
      }
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setMarkingPaid(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-elvora-text-dim">Rechnung wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error && !invoice) {
    return (
      <div className="space-y-4">
        <a href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-elvora-text-muted hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zu Rechnungen
        </a>
        <div className="card rounded-xl p-8 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!invoice) return null;

  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
  const isPaid = invoice.status === 'paid';
  const isCancelled = invoice.status === 'cancelled';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <a href="/invoices" className="p-2 rounded-lg bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </a>
          <div>
            <h1 className="text-xl font-semibold text-elvora-text">{invoice.invoice_number}</h1>
            <p className="text-xs text-elvora-text-dim mt-0.5">
              {invoice.client_name || invoice.recipient_name}
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.classes}`}>
            {statusCfg.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isPaid && !isCancelled && (
            <button
              onClick={handleMarkPaid}
              disabled={markingPaid}
              className="px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 text-sm font-medium hover:bg-emerald-500/25 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {markingPaid ? 'Wird markiert...' : 'Als bezahlt'}
            </button>
          )}
          {(invoice.status === 'draft' || invoice.status === 'viewed') && (
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-3 py-2 rounded-lg bg-blue-500/15 text-blue-400 text-sm font-medium hover:bg-blue-500/25 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              {sending ? 'Wird gesendet...' : 'Senden'}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {saving ? 'Speichern...' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column: Recipient & Details */}
        <div className="lg:col-span-1 space-y-5">
          {/* Recipient */}
          <div className="card rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-elvora-text">Empfänger</h2>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Name *</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                placeholder="Empfängername"
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Adresse</label>
              <textarea
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors resize-none"
                placeholder="Straße, PLZ, Ort"
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">E-Mail</label>
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                placeholder="email@example.com"
              />
            </div>
          </div>

          {/* Details */}
          <div className="card rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-elvora-text">Details</h2>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Fälligkeitsdatum</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-purple/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">MwSt.-Satz (%)</label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                min={0}
                max={100}
                step={0.5}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-purple/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Hinweise</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors resize-none"
                placeholder="Zahlungshinweise, Bankverbindung, etc."
              />
            </div>
          </div>

          {/* Public link */}
          {invoice.token && (
            <div className="card rounded-xl p-5 space-y-2">
              <h2 className="text-sm font-semibold text-elvora-text">Öffentlicher Link</h2>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${invoice.token}`}
                  className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text-dim text-xs font-mono focus:outline-none"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invoice/${invoice.token}`);
                    setSuccess('Link kopiert');
                    setTimeout(() => setSuccess(''), 2000);
                  }}
                  className="px-3 py-2 rounded-lg bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white transition-all text-xs shrink-0"
                >
                  Kopieren
                </button>
              </div>
              <p className="text-[11px] text-elvora-text-dim">{invoice.views || 0} Aufrufe</p>
            </div>
          )}
        </div>

        {/* Right column: Items */}
        <div className="lg:col-span-2 space-y-5">
          <div className="card rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-elvora-text">Positionen</h2>
              <button
                onClick={addItem}
                className="px-3 py-1.5 rounded-lg bg-elvora-purple/15 text-elvora-purple-light text-xs font-medium hover:bg-elvora-purple/25 transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Position hinzufügen
              </button>
            </div>

            {/* Items list */}
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border space-y-3">
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-elvora-text-dim mb-1">Beschreibung</label>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateItem(idx, { description: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                        placeholder="Leistungsbeschreibung"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="mt-5 p-1.5 rounded-lg text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-elvora-text-dim mb-1">Menge</label>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}
                        min={0}
                        step={1}
                        className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-purple/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-elvora-text-dim mb-1">Einzelpreis (&euro;)</label>
                      <input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                        min={0}
                        step={0.01}
                        className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-purple/50 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-elvora-text-dim mb-1">Gesamt</label>
                      <div className="px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm font-medium">
                        {fmtCurrency(item.quantity * item.unit_price)} &euro;
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="pt-4 border-t border-elvora-border space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">Zwischensumme</span>
                <span className="text-elvora-text font-medium">{fmtCurrency(subtotal)} &euro;</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">MwSt. ({taxRate}%)</span>
                <span className="text-elvora-text">{fmtCurrency(taxAmount)} &euro;</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-elvora-border">
                <span className="text-elvora-text">Gesamtbetrag</span>
                <span className="text-elvora-purple-light">{fmtCurrency(total)} &euro;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
