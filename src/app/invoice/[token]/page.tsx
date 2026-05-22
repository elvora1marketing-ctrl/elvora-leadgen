'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface Invoice {
  id: number;
  invoice_number: string;
  token: string;
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

interface Agency {
  agency_name?: string;
  agency_address?: string;
  agency_phone?: string;
  agency_email?: string;
  agency_tax_id?: string;
  agency_bank_iban?: string;
  agency_bank_bic?: string;
  agency_bank_name?: string;
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

const fmtDate = (d: string | null) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function PublicInvoicePage() {
  const params = useParams();
  const token = params.token as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [agency, setAgency] = useState<Agency>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/invoices/public/${token}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Rechnung nicht gefunden');
          return;
        }
        const data = await res.json();
        setInvoice(data.invoice);
        setAgency(data.agency || {});
      } catch {
        setError('Netzwerkfehler');
      } finally {
        setLoading(false);
      }
    }
    if (token) load();
  }, [token]);

  const items: InvoiceItem[] = useMemo(() => {
    if (!invoice) return [];
    try {
      return typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
    } catch {
      return [];
    }
  }, [invoice]);

  if (loading) {
    return (
      <div className="min-h-screen bg-elvora-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-elvora-text-dim">Rechnung wird geladen...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-elvora-bg flex items-center justify-center">
        <div className="card rounded-xl p-8 max-w-md text-center">
          <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-lg font-semibold text-elvora-text mb-2">Rechnung nicht gefunden</h2>
          <p className="text-sm text-elvora-text-dim">{error || 'Diese Rechnung existiert nicht oder wurde entfernt.'}</p>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.draft;
  const agencyName = agency.agency_name || 'Elvora';

  return (
    <div className="min-h-screen bg-elvora-bg py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="card rounded-xl p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
            {/* Agency */}
            <div>
              <h1 className="text-2xl font-bold text-elvora-text mb-1">{agencyName}</h1>
              {agency.agency_address && (
                <p className="text-sm text-elvora-text-dim whitespace-pre-line">{agency.agency_address}</p>
              )}
              {agency.agency_email && (
                <p className="text-sm text-elvora-text-dim mt-1">{agency.agency_email}</p>
              )}
              {agency.agency_phone && (
                <p className="text-sm text-elvora-text-dim">{agency.agency_phone}</p>
              )}
              {agency.agency_tax_id && (
                <p className="text-xs text-elvora-text-dim mt-2">USt-IdNr.: {agency.agency_tax_id}</p>
              )}
            </div>

            {/* Invoice meta */}
            <div className="text-left sm:text-right">
              <h2 className="text-xl font-semibold text-elvora-text mb-2">RECHNUNG</h2>
              <div className="space-y-1 text-sm">
                <p className="text-elvora-text-dim">
                  Nr.: <span className="text-elvora-text font-medium">{invoice.invoice_number}</span>
                </p>
                <p className="text-elvora-text-dim">
                  Datum: <span className="text-elvora-text">{fmtDate(invoice.created_at)}</span>
                </p>
                {invoice.due_date && (
                  <p className="text-elvora-text-dim">
                    Fällig: <span className="text-elvora-text">{fmtDate(invoice.due_date)}</span>
                  </p>
                )}
              </div>
              <div className="mt-3">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${statusCfg.classes}`}>
                  {statusCfg.label}
                </span>
              </div>
            </div>
          </div>

          {/* Recipient */}
          <div className="mb-8 p-4 rounded-lg bg-elvora-bg-alt border border-elvora-border">
            <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-2">Rechnungsempfänger</p>
            <p className="text-sm font-medium text-elvora-text">{invoice.recipient_name}</p>
            {invoice.recipient_address && (
              <p className="text-sm text-elvora-text-dim whitespace-pre-line mt-1">{invoice.recipient_address}</p>
            )}
            {invoice.recipient_email && (
              <p className="text-sm text-elvora-text-dim mt-1">{invoice.recipient_email}</p>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-elvora-border">
                  <th className="text-left py-3 px-2 text-elvora-text-dim font-medium text-xs uppercase tracking-wider">Beschreibung</th>
                  <th className="text-right py-3 px-2 text-elvora-text-dim font-medium text-xs uppercase tracking-wider">Menge</th>
                  <th className="text-right py-3 px-2 text-elvora-text-dim font-medium text-xs uppercase tracking-wider">Einzelpreis</th>
                  <th className="text-right py-3 px-2 text-elvora-text-dim font-medium text-xs uppercase tracking-wider">Gesamt</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-elvora-border/50">
                    <td className="py-3 px-2 text-elvora-text">{item.description}</td>
                    <td className="py-3 px-2 text-elvora-text text-right">{item.quantity}</td>
                    <td className="py-3 px-2 text-elvora-text text-right">{fmtCurrency(item.unit_price)} &euro;</td>
                    <td className="py-3 px-2 text-elvora-text text-right font-medium">{fmtCurrency(item.quantity * item.unit_price)} &euro;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-full sm:w-72 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">Zwischensumme</span>
                <span className="text-elvora-text">{fmtCurrency(invoice.subtotal)} &euro;</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">MwSt. ({invoice.tax_rate}%)</span>
                <span className="text-elvora-text">{fmtCurrency(invoice.tax_amount)} &euro;</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-elvora-border">
                <span className="text-elvora-text">Gesamtbetrag</span>
                <span className="text-elvora-purple-light">{fmtCurrency(invoice.total)} &euro;</span>
              </div>
            </div>
          </div>

          {/* Payment Info */}
          {(agency.agency_bank_iban || agency.agency_bank_bic || agency.agency_bank_name) && (
            <div className="p-4 rounded-lg bg-elvora-bg-alt border border-elvora-border mb-6">
              <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-2">Bankverbindung</p>
              <div className="space-y-1 text-sm">
                {agency.agency_bank_name && (
                  <p className="text-elvora-text-dim">Bank: <span className="text-elvora-text">{agency.agency_bank_name}</span></p>
                )}
                {agency.agency_bank_iban && (
                  <p className="text-elvora-text-dim">IBAN: <span className="text-elvora-text font-mono">{agency.agency_bank_iban}</span></p>
                )}
                {agency.agency_bank_bic && (
                  <p className="text-elvora-text-dim">BIC: <span className="text-elvora-text font-mono">{agency.agency_bank_bic}</span></p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {invoice.notes && (
            <div className="p-4 rounded-lg bg-elvora-bg-alt border border-elvora-border">
              <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-2">Hinweise</p>
              <p className="text-sm text-elvora-text whitespace-pre-line">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-elvora-text-dim pb-4">
          <p>{agencyName} {agency.agency_tax_id ? `| USt-IdNr.: ${agency.agency_tax_id}` : ''}</p>
        </div>
      </div>
    </div>
  );
}
