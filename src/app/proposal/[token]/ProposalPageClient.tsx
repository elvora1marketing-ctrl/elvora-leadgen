'use client';

import { useState, useMemo } from 'react';

interface Proposal {
  id: number;
  lead_id: number;
  title: string;
  amount: number;
  status: string;
  services: string;
  valid_until: string;
  lead_data: string;
  accepted_at: string | null;
  rejected_at: string | null;
  client_message: string | null;
  created_at: string;
}

interface LeadData {
  name: string;
  city: string;
  website: string;
  score: number;
  problems: string[];
  seo_issues: string[];
  competitors: { name: string; website: string; score: number }[];
}

interface Props {
  proposal: Proposal;
  agency: Record<string, string>;
  token: string;
}

function getScoreColor(score: number) {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBg(score: number) {
  if (score >= 70) return 'bg-emerald-500/20 border-emerald-500/30';
  if (score >= 40) return 'bg-amber-500/20 border-amber-500/30';
  return 'bg-red-500/20 border-red-500/30';
}

export default function ProposalPageClient({ proposal, agency, token }: Props) {
  const [responding, setResponding] = useState(false);
  const [showModal, setShowModal] = useState<'accept' | 'reject' | null>(null);
  const [clientMessage, setClientMessage] = useState('');
  const [responded, setResponded] = useState(!!proposal.accepted_at || !!proposal.rejected_at);
  const [responseType, setResponseType] = useState<string | null>(
    proposal.accepted_at ? 'accepted' : proposal.rejected_at ? 'rejected' : null
  );

  const services: string[] = useMemo(() => {
    try { return JSON.parse(proposal.services || '[]'); } catch { return []; }
  }, [proposal.services]);

  const leadData: LeadData | null = useMemo(() => {
    try { return JSON.parse(proposal.lead_data || 'null'); } catch { return null; }
  }, [proposal.lead_data]);

  const isExpired = useMemo(() => {
    if (!proposal.valid_until) return false;
    return new Date(proposal.valid_until) < new Date();
  }, [proposal.valid_until]);

  const daysLeft = useMemo(() => {
    if (!proposal.valid_until) return null;
    const diff = Math.ceil((new Date(proposal.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [proposal.valid_until]);

  const agencyName = agency.agency_name || 'Elvora';

  async function handleRespond(action: 'accept' | 'reject') {
    setResponding(true);
    try {
      const res = await fetch(`/api/proposals/${token}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, message: clientMessage.trim() || undefined }),
      });
      if (res.ok) {
        setResponded(true);
        setResponseType(action === 'accept' ? 'accepted' : 'rejected');
        setShowModal(null);
      }
    } catch { /* silent */ }
    finally { setResponding(false); }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <img src="/elvora-icon.svg" alt="" className="w-8 h-8" />
          <span className="text-white font-semibold text-lg">{agencyName}</span>
        </div>
        {proposal.valid_until && !responded && (
          <div className={`text-xs px-3 py-1.5 rounded-full border ${isExpired ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-[#8a8f98]'}`}>
            {isExpired ? 'Abgelaufen' : `Gültig noch ${daysLeft} Tag${daysLeft !== 1 ? 'e' : ''}`}
          </div>
        )}
      </div>

      {/* Response Banner */}
      {responded && (
        <div className={`rounded-xl p-4 mb-6 border ${responseType === 'accepted' ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
          <div className={`text-sm font-medium ${responseType === 'accepted' ? 'text-emerald-400' : 'text-red-400'}`}>
            {responseType === 'accepted' ? 'Angebot angenommen' : 'Angebot abgelehnt'}
          </div>
          {proposal.client_message && (
            <p className="text-xs text-[#8a8f98] mt-1">{proposal.client_message}</p>
          )}
        </div>
      )}

      {/* Title */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{proposal.title}</h1>
        {leadData && (
          <p className="text-[#8a8f98]">
            Erstellt für <span className="text-white font-medium">{leadData.name}</span>
            {leadData.city && <span> · {leadData.city}</span>}
          </p>
        )}
        <p className="text-xs text-[#8a8f98] mt-1">
          Erstellt am {new Date(proposal.created_at + 'Z').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Aktuelle Situation */}
      {leadData && leadData.score > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 mb-4">
          <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold mb-4">Ihre aktuelle Situation</h2>

          <div className="flex items-center gap-4 mb-4">
            <div className={`w-16 h-16 rounded-xl border flex items-center justify-center ${getScoreBg(leadData.score)}`}>
              <span className={`text-2xl font-bold ${getScoreColor(leadData.score)}`}>{leadData.score}</span>
            </div>
            <div>
              <div className="text-white font-medium">Website-Score</div>
              <div className="text-xs text-[#8a8f98]">
                {leadData.score >= 70 ? 'Gute Basis, aber Optimierungspotenzial' :
                 leadData.score >= 40 ? 'Verbesserungsbedarf bei mehreren Bereichen' :
                 'Dringender Handlungsbedarf'}
              </div>
            </div>
          </div>

          {leadData.problems.length > 0 && (
            <div className="space-y-2 mb-4">
              <div className="text-xs text-[#8a8f98] font-medium uppercase tracking-wider">Erkannte Probleme</div>
              <div className="grid gap-1.5">
                {leadData.problems.slice(0, 5).map((problem, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="text-[#c8ccd4]">{problem}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {leadData.competitors.length > 0 && (
            <div>
              <div className="text-xs text-[#8a8f98] font-medium uppercase tracking-wider mb-2">Ihre Konkurrenz online</div>
              <div className="space-y-1.5">
                {leadData.competitors.slice(0, 3).map((comp, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03]">
                    <span className="text-sm text-[#c8ccd4]">{comp.name}</span>
                    <span className={`text-sm font-bold ${getScoreColor(comp.score)}`}>{comp.score}/100</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10">
                  <span className="text-sm text-white font-medium">{leadData.name} (Sie)</span>
                  <span className={`text-sm font-bold ${getScoreColor(leadData.score)}`}>{leadData.score}/100</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Unsere Lösung */}
      {services.length > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6 mb-4">
          <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold mb-4">Unsere Lösung</h2>
          <div className="space-y-2.5">
            {services.map((service, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#7c5cfc]/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <svg className="w-3 h-3 text-[#7c5cfc]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm text-[#c8ccd4]">{service}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Investition */}
      <div className="rounded-xl border border-[#7c5cfc]/20 bg-[#7c5cfc]/5 p-5 sm:p-6 mb-6">
        <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold mb-3">Investition</h2>
        <div className="flex items-end gap-2">
          <span className="text-3xl sm:text-4xl font-bold text-white">
            {proposal.amount?.toLocaleString('de-DE')} €
          </span>
          <span className="text-[#8a8f98] text-sm mb-1.5">
            {proposal.services && (() => {
              try {
                const tmpl = JSON.parse(proposal.lead_data || '{}');
                return tmpl;
              } catch { return null; }
            })() ? '' : ''}
            zzgl. MwSt.
          </span>
        </div>
        {proposal.valid_until && (
          <p className="text-xs text-[#8a8f98] mt-2">
            Gültig bis {new Date(proposal.valid_until).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      {!responded && !isExpired && (
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setShowModal('accept')}
            className="flex-1 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors text-sm"
          >
            Angebot annehmen
          </button>
          <button
            onClick={() => setShowModal('reject')}
            className="px-6 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[#8a8f98] hover:text-white font-medium transition-colors text-sm"
          >
            Ablehnen
          </button>
        </div>
      )}

      {isExpired && !responded && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-8 text-center">
          <p className="text-red-400 text-sm font-medium">Dieses Angebot ist abgelaufen.</p>
          <p className="text-xs text-[#8a8f98] mt-1">Kontaktieren Sie uns für ein aktualisiertes Angebot.</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/[0.06] pt-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src="/elvora-icon.svg" alt="" className="w-5 h-5 opacity-50" />
          <span className="text-xs text-[#8a8f98]">{agencyName}</span>
        </div>
        <div className="text-[11px] text-[#555] space-y-0.5">
          {agency.agency_address && <p>{agency.agency_address}</p>}
          {agency.agency_email && <p>{agency.agency_email}</p>}
          {agency.agency_phone && <p>{agency.agency_phone}</p>}
          {agency.agency_tax_id && <p>USt-IdNr.: {agency.agency_tax_id}</p>}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-[#12121a] border border-white/10 p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-white mb-1">
              {showModal === 'accept' ? 'Angebot annehmen' : 'Angebot ablehnen'}
            </h3>
            <p className="text-sm text-[#8a8f98] mb-4">
              {showModal === 'accept'
                ? 'Möchten Sie dieses Angebot verbindlich annehmen?'
                : 'Möchten Sie dieses Angebot ablehnen?'}
            </p>
            <textarea
              value={clientMessage}
              onChange={e => setClientMessage(e.target.value)}
              placeholder="Optionale Nachricht..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#7c5cfc]/50 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => handleRespond(showModal)}
                disabled={responding}
                className={`flex-1 px-4 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
                  showModal === 'accept'
                    ? 'bg-emerald-500 hover:bg-emerald-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {responding ? 'Wird gesendet...' : showModal === 'accept' ? 'Verbindlich annehmen' : 'Ablehnen'}
              </button>
              <button
                onClick={() => setShowModal(null)}
                className="px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-[#8a8f98] text-sm transition-colors"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
