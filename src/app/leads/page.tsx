'use client';

import { useState, useEffect, useCallback } from 'react';

interface PipelineLead {
  id: number;
  name: string;
  city: string;
  score: number;
  deal_value: number | null;
  phone: string;
  email: string;
  website_original: string;
  contact_status: string;
  priority: string;
  notes: string;
  problems: string;
  seo_issues: string;
  updated_at: string;
  email_opens: number;
  audit_views: number;
  cta_clicks: number;
}

interface Column {
  id: string;
  title: string;
  color: string;
  statuses: string[];
}

const columns: Column[] = [
  { id: 'not_contacted', title: 'Nicht kontaktiert', color: 'bg-elvora-text-dim', statuses: ['not_contacted'] },
  { id: 'email_sent', title: 'Mail gesendet', color: 'bg-elvora-purple', statuses: ['email_sent'] },
  { id: 'in_talks', title: 'Im Gespräch', color: 'bg-elvora-warning', statuses: ['called', 'meeting'] },
  { id: 'proposal', title: 'Angebot', color: 'bg-elvora-pink', statuses: ['proposal'] },
  { id: 'won', title: 'Gewonnen', color: 'bg-elvora-success', statuses: ['won'] },
];

function getScoreClass(score: number): string {
  if (score >= 85) return 'score-hot';
  if (score >= 70) return 'score-warm';
  return 'score-cold';
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailSending, setEmailSending] = useState<number | null>(null);
  const [emailStatus, setEmailStatus] = useState<Record<number, 'sent' | 'error'>>({});
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; errors: number } | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);

  const loadLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?status=qualified&limit=200');
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const getColumnLeads = (col: Column) => leads.filter(l => col.statuses.includes(l.contact_status));

  const totalDeals = leads.length;
  const totalValue = leads.reduce((sum, l) => sum + (l.deal_value || 0), 0);
  const wonValue = leads.filter(l => l.contact_status === 'won').reduce((sum, l) => sum + (l.deal_value || 0), 0);

  const sendEmail = async (lead: PipelineLead) => {
    if (!lead.email) return;
    setEmailSending(lead.id);
    try {
      let problems = [];
      let seoIssues = [];
      try { problems = JSON.parse(lead.problems || '[]'); } catch { /* skip */ }
      try { seoIssues = JSON.parse(lead.seo_issues || '[]'); } catch { /* skip */ }

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          lead_name: lead.name,
          lead_email: lead.email,
          ansprechpartner: '',
          website: lead.website_original || '',
          city: lead.city,
          score: lead.score,
          problems,
          seo_issues: seoIssues,
        }),
      });
      setEmailStatus(prev => ({ ...prev, [lead.id]: res.ok ? 'sent' : 'error' }));
      if (res.ok) loadLeads();
    } catch {
      setEmailStatus(prev => ({ ...prev, [lead.id]: 'error' }));
    } finally { setEmailSending(null); }
  };

  const sendBulkEmails = async () => {
    setBulkSending(true); setBulkResult(null);
    try {
      const res = await fetch('/api/email/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        const sent = data.results?.filter((r: { success: boolean }) => r.success).length || 0;
        const errors = data.results?.filter((r: { success: boolean }) => !r.success).length || 0;
        setBulkResult({ sent, errors });
        loadLeads();
      }
    } catch { setBulkResult({ sent: 0, errors: 1 }); }
    finally { setBulkSending(false); setTimeout(() => setBulkResult(null), 5000); }
  };

  const updateStatus = async (leadId: number, newStatus: string) => {
    setStatusUpdating(leadId);
    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_status: newStatus }),
      });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, contact_status: newStatus } : l));
    } catch { /* silent */ }
    finally { setStatusUpdating(null); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-white">Pipeline</h1>
        <div className="flex items-center gap-3 text-xs sm:text-sm">
          <span className="text-elvora-text-dim">{totalDeals} Deals</span>
          <span className="text-elvora-accent font-semibold">{totalValue.toLocaleString('de-DE')} EUR</span>
          {wonValue > 0 && <span className="text-elvora-success font-semibold">{wonValue.toLocaleString('de-DE')} gewonnen</span>}
          <button
            onClick={sendBulkEmails}
            disabled={bulkSending}
            className="px-3 py-1.5 rounded-lg bg-elvora-gradient text-white text-xs font-semibold hover:shadow-elvora-lg transition-all disabled:opacity-50"
          >
            {bulkSending ? 'Sende...' : 'Alle pitchen'}
          </button>
        </div>
      </div>

      {/* Bulk Result */}
      {bulkResult && (
        <div className={`mb-4 p-3 rounded-xl text-sm animate-fade-in ${
          bulkResult.errors === 0
            ? 'bg-elvora-success/10 border border-elvora-success/20 text-elvora-success'
            : 'bg-elvora-warning/10 border border-elvora-warning/20 text-elvora-warning'
        }`}>
          {bulkResult.sent} Mails gesendet{bulkResult.errors > 0 ? `, ${bulkResult.errors} Fehler` : ' – Follow-Ups geplant!'}
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex lg:grid lg:grid-cols-5 gap-3 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none">
        {columns.map((col) => {
          const colLeads = getColumnLeads(col);
          return (
            <div key={col.id} className="min-w-[260px] lg:min-w-0 snap-start">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${col.color}`} />
                <span className="text-xs font-semibold text-white">{col.title}</span>
                <span className="ml-auto text-xs text-elvora-text-dim">{colLeads.length}</span>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {colLeads.map((lead) => (
                  <div key={lead.id} className={`glass rounded-xl p-3 card-hover ${lead.priority === 'high' ? 'border border-red-500/20' : ''}`}>
                    <div className="flex items-start justify-between mb-1.5">
                      <h4 className="text-sm font-medium text-white leading-tight pr-2 truncate">{lead.name}</h4>
                      <div className={`${getScoreClass(lead.score)} px-1.5 py-0.5 rounded-lg flex-shrink-0`}>
                        <span className="text-[11px] font-bold text-white">{lead.score}</span>
                      </div>
                    </div>
                    <div className="text-xs text-elvora-text-dim mb-1.5">{lead.city}</div>

                    {/* Hot indicators */}
                    {(lead.audit_views > 0 || lead.cta_clicks > 0 || lead.email_opens > 1) && (
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        {lead.cta_clicks > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/20">🔥 CTA</span>}
                        {lead.audit_views > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-elvora-warning/15 text-elvora-warning border border-elvora-warning/20">👁 Audit</span>}
                        {lead.email_opens > 1 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-elvora-purple/15 text-elvora-purple-light border border-elvora-purple/20">📧 {lead.email_opens}x</span>}
                      </div>
                    )}

                    {lead.deal_value && lead.deal_value > 0 && (
                      <div className="text-sm font-bold text-elvora-accent mb-1.5">
                        {lead.deal_value.toLocaleString('de-DE')} EUR
                      </div>
                    )}

                    {lead.phone && (
                      <div className="text-xs text-elvora-text-dim font-mono mb-2">{lead.phone}</div>
                    )}

                    {/* Status Quick-Move */}
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      {/* Email Button for not_contacted */}
                      {lead.contact_status === 'not_contacted' && lead.email && (
                        emailStatus[lead.id] === 'sent' ? (
                          <div className="flex items-center gap-1.5 text-elvora-success text-xs font-medium py-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Mail gesendet
                          </div>
                        ) : (
                          <button
                            onClick={() => sendEmail(lead)}
                            disabled={emailSending === lead.id}
                            className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-elvora-purple/10 border border-elvora-purple/20 text-elvora-purple-light text-xs font-semibold hover:bg-elvora-purple/20 transition-all disabled:opacity-50"
                          >
                            {emailSending === lead.id ? 'Sende...' : 'Mail senden'}
                          </button>
                        )
                      )}

                      {/* Move buttons */}
                      <div className="flex gap-1">
                        {lead.contact_status !== 'won' && (
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) updateStatus(lead.id, e.target.value); }}
                            disabled={statusUpdating === lead.id}
                            className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-elvora-text-dim text-[11px] focus:outline-none cursor-pointer disabled:opacity-50"
                          >
                            <option value="">Verschieben...</option>
                            {lead.contact_status !== 'email_sent' && <option value="email_sent">Mail gesendet</option>}
                            {lead.contact_status !== 'called' && <option value="called">Angerufen</option>}
                            {lead.contact_status !== 'meeting' && <option value="meeting">Meeting</option>}
                            {lead.contact_status !== 'proposal' && <option value="proposal">Angebot</option>}
                            <option value="won">Gewonnen</option>
                            <option value="lost">Verloren</option>
                          </select>
                        )}
                        {lead.phone && (
                          <a href={`tel:${lead.phone}`} className="px-2 py-1 rounded-lg bg-elvora-success/10 border border-elvora-success/20 text-elvora-success text-[11px] font-semibold hover:bg-elvora-success/20 transition-all">
                            Tel
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {colLeads.length === 0 && (
                  <div className="text-center py-8 text-xs text-elvora-text-dim">Keine Leads</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
