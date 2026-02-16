'use client';

import { useState } from 'react';

interface KanbanLead {
  id: number;
  name: string;
  city: string;
  score: number;
  dealValue: number | null;
  phone: string;
  email: string;
  website: string;
  ansprechpartner: string;
  lastAction: string;
  priority: 'low' | 'medium' | 'high';
  problems: { label: string; severity: string }[];
  seoIssues: { label: string; impact: string }[];
}

interface Column {
  id: string;
  title: string;
  color: string;
  leads: KanbanLead[];
}

const initialColumns: Column[] = [
  {
    id: 'not_contacted',
    title: 'Nicht kontaktiert',
    color: 'bg-elvora-text-dim',
    leads: [
      { id: 1, name: 'Krause Sanitärtechnik GmbH', city: 'Essen', score: 92, dealValue: 3500, phone: '+49 201 7654321', email: 'info@krause-sanitaer-essen.de', website: 'www.krause-sanitaer-essen.de', ansprechpartner: 'Herr Krause', lastAction: 'Vor 2h qualifiziert', priority: 'high', problems: [{ label: 'Kein SSL-Zertifikat – Chrome zeigt "Nicht sicher"', severity: 'critical' }, { label: 'Nicht mobilfähig', severity: 'critical' }], seoIssues: [{ label: 'Meta-Beschreibungen fehlen', impact: 'high' }] },
      { id: 4, name: 'Weber Klempnerei & Sanitär', city: 'Duisburg', score: 95, dealValue: 4200, phone: '+49 203 4445566', email: 'info@weber-klempner.de', website: 'www.weber-klempner-duisburg.de', ansprechpartner: 'Herr Weber', lastAction: 'Vor 1 Tag qualifiziert', priority: 'high', problems: [{ label: 'Website komplett offline (DNS-Fehler)', severity: 'critical' }, { label: 'Google zeigt "dauerhaft geschlossen"', severity: 'critical' }], seoIssues: [{ label: 'Domain nicht erreichbar', impact: 'high' }] },
      { id: 7, name: 'Fischer Heizung & Bad', city: 'Essen', score: 84, dealValue: 2800, phone: '+49 201 9988776', email: 'info@fischer-heizung.de', website: 'www.fischer-heizung-essen.de', ansprechpartner: 'Herr Fischer', lastAction: 'Vor 3 Tagen qualifiziert', priority: 'medium', problems: [{ label: 'Ladezeit über 6 Sekunden', severity: 'major' }], seoIssues: [{ label: 'Keine lokale SEO', impact: 'medium' }] },
    ],
  },
  {
    id: 'in_talks',
    title: 'Im Gespräch',
    color: 'bg-elvora-warning',
    leads: [
      { id: 2, name: 'Meier Haustechnik', city: 'Dortmund', score: 87, dealValue: 3200, phone: '+49 231 5551234', email: 'kontakt@meier-haustechnik.de', website: 'www.meier-haustechnik-dortmund.de', ansprechpartner: 'Herr Meier', lastAction: 'Gestern angerufen, interessiert', priority: 'high', problems: [{ label: 'WordPress 4.9 – massive Sicherheitslücken', severity: 'critical' }, { label: 'Design sieht aus wie 2010', severity: 'major' }], seoIssues: [{ label: 'Nur 3 Seiten bei Google indexiert', impact: 'high' }] },
      { id: 8, name: 'Hoffmann Sanitär Dortmund', city: 'Dortmund', score: 79, dealValue: 2500, phone: '+49 231 6667788', email: 'info@hoffmann-sanitaer.de', website: 'www.hoffmann-sanitaer-dortmund.de', ansprechpartner: 'Herr Hoffmann', lastAction: 'Termin am 18. Feb', priority: 'medium', problems: [{ label: 'Kontaktformular defekt', severity: 'major' }], seoIssues: [{ label: 'Keine Meta-Tags', impact: 'medium' }] },
    ],
  },
  {
    id: 'proposal',
    title: 'Angebot gesendet',
    color: 'bg-elvora-purple',
    leads: [
      { id: 5, name: 'Schneider Wärmetechnik', city: 'Bochum', score: 88, dealValue: 3800, phone: '+49 234 1122334', email: 'info@schneider-waerme.de', website: 'www.schneider-waermetechnik.de', ansprechpartner: 'Herr Schneider', lastAction: 'Angebot am 12. Feb', priority: 'high', problems: [{ label: 'Nicht DSGVO-konform', severity: 'major' }], seoIssues: [{ label: 'Keine strukturierten Daten', impact: 'medium' }] },
    ],
  },
  {
    id: 'won',
    title: 'Gewonnen',
    color: 'bg-elvora-success',
    leads: [
      { id: 6, name: 'Braun SHK Technik GmbH', city: 'Essen', score: 91, dealValue: 4500, phone: '+49 201 2233445', email: 'kontakt@braun-shk.de', website: 'www.braun-shk-technik.de', ansprechpartner: 'Herr Braun', lastAction: 'Unterschrieben am 10. Feb', priority: 'high', problems: [{ label: 'Veraltetes Design', severity: 'major' }], seoIssues: [{ label: 'Kaum organischer Traffic', impact: 'high' }] },
    ],
  },
];

function getScoreClass(score: number): string {
  if (score >= 85) return 'score-hot';
  if (score >= 70) return 'score-warm';
  return 'score-cold';
}

export default function LeadsPage() {
  const [columns] = useState<Column[]>(initialColumns);
  const [emailSending, setEmailSending] = useState<number | null>(null);
  const [emailStatus, setEmailStatus] = useState<Record<number, 'sent' | 'error'>>({});
  const [emailError, setEmailError] = useState<string | null>(null);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ sent: number; errors: number } | null>(null);

  const totalDeals = columns.reduce((sum, col) => sum + col.leads.length, 0);
  const totalValue = columns.reduce(
    (sum, col) => sum + col.leads.reduce((s, l) => s + (l.dealValue || 0), 0), 0
  );

  const sendEmail = async (lead: KanbanLead) => {
    if (!lead.email) {
      setEmailError('Keine E-Mail-Adresse vorhanden');
      setTimeout(() => setEmailError(null), 3000);
      return;
    }

    setEmailSending(lead.id);
    setEmailError(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_name: lead.name,
          lead_email: lead.email,
          ansprechpartner: lead.ansprechpartner,
          website: lead.website,
          city: lead.city,
          score: lead.score,
          problems: lead.problems,
          seo_issues: lead.seoIssues,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setEmailStatus(prev => ({ ...prev, [lead.id]: 'sent' }));
      } else {
        setEmailError(data.error || 'Fehler beim Senden');
        setEmailStatus(prev => ({ ...prev, [lead.id]: 'error' }));
        setTimeout(() => setEmailError(null), 5000);
      }
    } catch {
      setEmailError('Netzwerkfehler – bitte erneut versuchen');
      setTimeout(() => setEmailError(null), 3000);
    } finally {
      setEmailSending(null);
    }
  };

  const sendBulkEmails = async () => {
    const notContactedLeads = columns
      .find(c => c.id === 'not_contacted')?.leads || [];

    if (notContactedLeads.length === 0) return;

    setBulkSending(true);
    setBulkResult(null);

    let sent = 0;
    let errors = 0;

    for (const lead of notContactedLeads) {
      if (!lead.email || emailStatus[lead.id] === 'sent') continue;

      try {
        const res = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_name: lead.name,
            lead_email: lead.email,
            ansprechpartner: lead.ansprechpartner,
            website: lead.website,
            city: lead.city,
            score: lead.score,
            problems: lead.problems,
            seo_issues: lead.seoIssues,
          }),
        });

        if (res.ok) {
          sent++;
          setEmailStatus(prev => ({ ...prev, [lead.id]: 'sent' }));
        } else {
          errors++;
        }
      } catch {
        errors++;
      }
    }

    setBulkResult({ sent, errors });
    setBulkSending(false);
    setTimeout(() => setBulkResult(null), 5000);
  };

  return (
    <div className="animate-fade-in">
      {/* Header with summary */}
      <div className="flex items-center justify-between mb-4 lg:mb-5">
        <h1 className="text-lg font-bold text-white">Pipeline</h1>
        <div className="flex items-center gap-3 lg:gap-4 text-xs sm:text-sm">
          <span className="text-elvora-text-dim">{totalDeals} Deals</span>
          <span className="text-elvora-accent font-semibold">{totalValue.toLocaleString('de-DE')} EUR</span>
          <button
            onClick={sendBulkEmails}
            disabled={bulkSending}
            className="px-3 py-1.5 rounded-lg bg-elvora-gradient text-white text-xs font-semibold hover:shadow-elvora-lg transition-all disabled:opacity-50"
          >
            {bulkSending ? 'Sende...' : 'Alle pitchen'}
          </button>
        </div>
      </div>

      {/* Bulk Result Toast */}
      {bulkResult && (
        <div className={`mb-4 p-3 rounded-xl text-sm animate-fade-in ${
          bulkResult.errors === 0
            ? 'bg-elvora-success/10 border border-elvora-success/20 text-elvora-success'
            : 'bg-elvora-warning/10 border border-elvora-warning/20 text-elvora-warning'
        }`}>
          {bulkResult.sent} Mails gesendet{bulkResult.errors > 0 ? `, ${bulkResult.errors} Fehler` : ' – Follow-Ups geplant!'}
        </div>
      )}

      {/* Error Toast */}
      {emailError && (
        <div className="mb-4 p-3 rounded-xl bg-elvora-danger/10 border border-elvora-danger/20 text-elvora-danger text-sm animate-fade-in">
          {emailError}
        </div>
      )}

      {/* Kanban - horizontal scroll on mobile */}
      <div className="flex lg:grid lg:grid-cols-4 gap-3 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none">
        {columns.map((col) => (
          <div key={col.id} className="min-w-[280px] lg:min-w-0 snap-start">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`w-2 h-2 rounded-full ${col.color}`} />
              <span className="text-xs font-semibold text-white">{col.title}</span>
              <span className="ml-auto text-xs text-elvora-text-dim">{col.leads.length}</span>
            </div>
            <div className="space-y-2 min-h-[300px]">
              {col.leads.map((lead) => (
                <div key={lead.id} className="glass rounded-xl p-3 card-hover">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-white leading-tight pr-2">{lead.name}</h4>
                    <div className={`${getScoreClass(lead.score)} px-1.5 py-0.5 rounded-lg flex-shrink-0`}>
                      <span className="text-[11px] font-bold text-white">{lead.score}</span>
                    </div>
                  </div>
                  <div className="text-xs text-elvora-text-dim mb-2">{lead.city}</div>
                  {lead.dealValue && (
                    <div className="text-base font-bold text-elvora-accent mb-2">
                      {lead.dealValue.toLocaleString('de-DE')} EUR
                    </div>
                  )}
                  <div className="text-xs text-elvora-text-dim">{lead.lastAction}</div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-xs text-elvora-text-dim font-mono">
                    {lead.phone}
                  </div>

                  {/* Mail senden Button */}
                  <div className="mt-2 pt-2 border-t border-white/5">
                    {emailStatus[lead.id] === 'sent' ? (
                      <div className="flex items-center gap-1.5 text-elvora-success text-xs font-medium">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Mail gesendet
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); sendEmail(lead); }}
                        disabled={emailSending === lead.id}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-elvora-purple/10 border border-elvora-purple/20 text-elvora-purple-light text-xs font-semibold hover:bg-elvora-purple/20 transition-all disabled:opacity-50"
                      >
                        {emailSending === lead.id ? (
                          <>
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Sende...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Mail senden
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
