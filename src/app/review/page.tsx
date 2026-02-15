'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReviewLead {
  id: number;
  name: string;
  ansprechpartner: string;
  website: string;
  phone: string;
  email: string;
  city: string;
  score: number;
  branche: string;
  problems: { id: string; label: string; severity: 'critical' | 'major' | 'minor' }[];
  seoIssues: { id: string; label: string; impact: 'high' | 'medium' | 'low' }[];
  // Gesprächsleitfaden - strukturiert zum Ablesen
  callScript: {
    einstieg: string;      // "Guten Tag Herr X, hier ist [Name] von Elvora..."
    problemSatz: string;   // Der Killer-Satz: konkretes Problem ansprechen
    loesungSatz: string;   // Was wir machen können
    cta: string;           // Abschluss / nächster Schritt
  };
  topProblem: string;      // Das größte Problem in einem Satz - zum schnellen Scannen
  keywords: string[];
}

const sampleLeads: ReviewLead[] = [
  {
    id: 1,
    name: 'Krause Sanitärtechnik GmbH',
    ansprechpartner: 'Herr Krause',
    website: 'www.krause-sanitaer-essen.de',
    phone: '+49 201 7654321',
    email: 'info@krause-sanitaer-essen.de',
    city: 'Essen',
    score: 92,
    branche: 'Sanitär & Klempner',
    problems: [
      { id: 'p1', label: 'Kein SSL-Zertifikat \u2013 Chrome zeigt "Nicht sicher"', severity: 'critical' },
      { id: 'p2', label: 'Nicht mobilfähig \u2013 Text winzig auf Handy', severity: 'critical' },
      { id: 'p3', label: 'Kein Google Business Profil beansprucht', severity: 'major' },
      { id: 'p4', label: 'Kontaktformular defekt (500 Error)', severity: 'major' },
    ],
    seoIssues: [
      { id: 's1', label: 'Meta-Beschreibungen fehlen komplett', impact: 'high' },
      { id: 's2', label: 'PageSpeed 23/100 auf Mobilgeräten', impact: 'high' },
    ],
    callScript: {
      einstieg: 'Guten Tag Herr Krause, mein Name ist [Name] von Elvora. Ich habe mir Ihre Website angeschaut und wollte kurz Bescheid geben \u2013 es gibt da ein paar Sachen, die Sie wahrscheinlich Kunden kosten.',
      problemSatz: 'Konkret: Wenn jemand Ihre Firma googelt und auf die Website geht, zeigt Chrome "Nicht sicher" an \u2013 weil das SSL-Zertifikat fehlt. Und auf dem Handy ist die Seite quasi nicht benutzbar. Das heißt, die Leute springen ab und gehen zum Wettbewerber.',
      loesungSatz: 'Wir machen genau das für SHK-Betriebe hier in der Region: moderne Website, die auf Google gefunden wird, SSL, mobiloptimiert, und Ihr Google-Profil richtig einrichten. Damit kommen die Anfragen automatisch rein.',
      cta: 'Ich würde Ihnen gerne mal kostenlos zeigen, was wir für einen Betrieb wie Ihren machen können. Hätten Sie diese Woche 15 Minuten Zeit für ein kurzes Gespräch?',
    },
    topProblem: 'Website zeigt "Nicht sicher" + nicht mobilfähig \u2192 Kunden springen ab',
    keywords: ['Sanitär', 'Klempner'],
  },
  {
    id: 2,
    name: 'Meier Haustechnik',
    ansprechpartner: 'Herr Meier',
    website: 'www.meier-haustechnik-dortmund.de',
    phone: '+49 231 5551234',
    email: 'kontakt@meier-haustechnik.de',
    city: 'Dortmund',
    score: 87,
    branche: 'Heizung & SHK',
    problems: [
      { id: 'p1', label: 'WordPress 4.9 \u2013 massive Sicherheitslücken', severity: 'critical' },
      { id: 'p2', label: 'Design sieht aus wie 2010', severity: 'major' },
      { id: 'p3', label: 'Keine Online-Terminbuchung', severity: 'major' },
    ],
    seoIssues: [
      { id: 's1', label: 'Nur 3 Seiten bei Google indexiert', impact: 'high' },
      { id: 's2', label: 'Keine lokale SEO-Optimierung', impact: 'high' },
    ],
    callScript: {
      einstieg: 'Guten Tag Herr Meier, hier ist [Name] von Elvora. Ich rufe an, weil mir aufgefallen ist, dass Ihre Website auf einer veralteten WordPress-Version läuft \u2013 und das ist tatsächlich ein Sicherheitsrisiko.',
      problemSatz: 'WordPress 4.9 hat bekannte Sicherheitslücken. Das heißt, Ihre Seite könnte gehackt werden \u2013 und dann steht da plötzlich Werbung für irgendwas drauf. Außerdem: Google zeigt nur 3 Ihrer Seiten an. Da geht viel Potenzial verloren.',
      loesungSatz: 'Wir können Ihnen ein modernes Redesign machen mit integrierter Terminbuchung und richtiger Google-Optimierung für Dortmund. Damit finden die Leute Sie direkt, wenn sie "Heizung Dortmund" googeln.',
      cta: 'Soll ich Ihnen mal ein konkretes Konzept schicken? Dauert bei uns nur 2-3 Tage und kostet Sie erstmal nichts.',
    },
    topProblem: 'WordPress 4.9 = Sicherheitsrisiko + nur 3 Seiten bei Google sichtbar',
    keywords: ['Heizung', 'SHK'],
  },
  {
    id: 3,
    name: 'Schuster & Sohn Heizungsbau',
    ansprechpartner: 'Herr Schuster',
    website: 'www.schuster-sohn-heizung.de',
    phone: '+49 234 8889900',
    email: '',
    city: 'Bochum',
    score: 78,
    branche: 'Heizungsbau',
    problems: [
      { id: 'p1', label: 'Nur eine statische HTML-Seite', severity: 'major' },
      { id: 'p2', label: 'Keine Social-Media-Präsenz', severity: 'minor' },
      { id: 'p3', label: 'Öffnungszeiten nirgends zu finden', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Keine interne Verlinkung', impact: 'high' },
      { id: 's2', label: 'Title-Tag ist nur "Home"', impact: 'medium' },
    ],
    callScript: {
      einstieg: 'Guten Tag Herr Schuster, [Name] von Elvora. Ich hab mir Ihren Webauftritt angesehen \u2013 Sie haben ja bisher nur eine einzelne Seite im Netz.',
      problemSatz: 'Das Problem dabei: Google kann Sie so kaum finden. Wenn jemand "Heizungsbau Bochum" sucht, zeigt Google lieber Betriebe mit 10-15 Unterseiten an. Mit einer Seite haben Sie quasi keine Chance auf Seite 1.',
      loesungSatz: 'Wir bauen Ihnen eine richtige Website mit eigenen Seiten für jeden Service \u2013 Heizungswartung, Notdienst, Neuinstallation. Jede Seite wird für Google optimiert, damit Sie in Bochum gefunden werden.',
      cta: 'Ich zeig Ihnen gerne mal, wie das bei anderen Heizungsbauern aussieht, die wir betreuen. Passt es Ihnen diese Woche für 10 Minuten?',
    },
    topProblem: 'Nur 1 Seite online \u2192 Google kann den Betrieb nicht finden',
    keywords: ['Heizung'],
  },
  {
    id: 4,
    name: 'Weber Klempnerei & Sanitär',
    ansprechpartner: 'Herr Weber',
    website: 'www.weber-klempner-duisburg.de',
    phone: '+49 203 4445566',
    email: 'info@weber-klempner.de',
    city: 'Duisburg',
    score: 95,
    branche: 'Klempnerei & Sanitär',
    problems: [
      { id: 'p1', label: 'Website komplett offline (DNS-Fehler)', severity: 'critical' },
      { id: 'p2', label: 'Google zeigt "dauerhaft geschlossen"', severity: 'critical' },
      { id: 'p3', label: 'Konkurrenz schaltet Google Ads auf Firmennamen', severity: 'major' },
      { id: 'p4', label: 'Nur 2 Sterne bei 12 Google-Bewertungen', severity: 'major' },
    ],
    seoIssues: [
      { id: 's1', label: 'Domain nicht erreichbar', impact: 'high' },
      { id: 's2', label: 'Null organische Sichtbarkeit', impact: 'high' },
    ],
    callScript: {
      einstieg: 'Guten Tag Herr Weber, hier ist [Name] von Elvora. Ich rufe an, weil mir etwas Dringendes bei Ihrem Google-Eintrag aufgefallen ist.',
      problemSatz: 'Wenn man "Weber Klempner Duisburg" googelt, steht da "dauerhaft geschlossen" \u2013 und Ihre Website ist nicht erreichbar. Das heißt, jeder potenzielle Kunde denkt, Sie haben zugemacht. Und ein Konkurrent schaltet sogar Werbung auf Ihren Namen.',
      loesungSatz: 'Das können wir schnell fixen: Google-Eintrag korrigieren, Website wieder online bringen, und eine Strategie für bessere Bewertungen. Innerhalb einer Woche ist das erledigt.',
      cta: 'Das ist wirklich dringend \u2013 jeden Tag, wo das so steht, verlieren Sie Kunden. Sollen wir das diese Woche noch angehen?',
    },
    topProblem: 'Google zeigt "GESCHLOSSEN" + Website offline \u2192 akuter Kundenverlust',
    keywords: ['Klempner', 'Sanitär'],
  },
  {
    id: 5,
    name: 'Böhm Wärmetechnik OHG',
    ansprechpartner: 'Herr Böhm',
    website: 'www.boehm-waermetechnik.de',
    phone: '+49 201 3332211',
    email: 'service@boehm-waerme.de',
    city: 'Essen',
    score: 64,
    branche: 'Wärmetechnik',
    problems: [
      { id: 'p1', label: 'Ladezeit 8.2 Sekunden auf Mobil', severity: 'major' },
      { id: 'p2', label: 'Cookie-Banner blockiert gesamte Seite', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Duplicate Content auf Serviceseiten', impact: 'medium' },
    ],
    callScript: {
      einstieg: 'Guten Tag Herr Böhm, [Name] von Elvora. Kurze Frage: Wissen Sie, wie schnell Ihre Website auf dem Handy lädt?',
      problemSatz: 'Ich hab\u2019s getestet: 8,2 Sekunden. Die meisten Besucher springen nach 3 Sekunden ab. Das heißt, über die Hälfte Ihrer Besucher sieht Ihre Seite nie richtig. Plus: Der Cookie-Banner blockiert bei manchen die ganze Seite.',
      loesungSatz: 'Wir optimieren die Ladezeit auf unter 2 Sekunden und fixen den Cookie-Banner. Erfahrungsgemäß verdoppelt das die Anfragen.',
      cta: 'Soll ich Ihnen mal einen kostenlosen Speed-Report schicken? Dann sehen Sie schwarz auf weiß, wo die Probleme liegen.',
    },
    topProblem: '8 Sek. Ladezeit \u2192 über 50% der Besucher springen sofort ab',
    keywords: ['Heizung', 'SHK'],
  },
];

function getScoreColor(score: number): string {
  if (score >= 85) return 'score-hot';
  if (score >= 70) return 'score-warm';
  return 'score-cold';
}

export default function ReviewPage() {
  const [leads] = useState<ReviewLead[]>(sampleLeads);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, 'qualified' | 'skipped'>>({});
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
  const [auditLinks, setAuditLinks] = useState<Record<number, string>>({});
  const [auditLoading, setAuditLoading] = useState<number | null>(null);
  const [emailSending, setEmailSending] = useState<number | null>(null);
  const [emailStatus, setEmailStatus] = useState<Record<number, 'sent' | 'error'>>({});
  const [emailError, setEmailError] = useState<string | null>(null);

  const currentLead = leads[currentIndex];
  const totalLeads = leads.length;
  const qualifiedCount = Object.values(decisions).filter((d) => d === 'qualified').length;
  const skippedCount = Object.values(decisions).filter((d) => d === 'skipped').length;
  const isComplete = currentIndex >= totalLeads;

  const generateAudit = async (leadId: number) => {
    setAuditLoading(leadId);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const data = await res.json();
      if (data.url) {
        setAuditLinks(prev => ({ ...prev, [leadId]: data.url }));
      }
    } catch (err) {
      console.error('Audit generation failed:', err);
    } finally {
      setAuditLoading(null);
    }
  };

  const sendEmail = async (lead: ReviewLead) => {
    if (!lead.email) {
      setEmailError('Keine E-Mail-Adresse bei diesem Lead vorhanden');
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
          audit_url: auditLinks[lead.id] ? window.location.origin + auditLinks[lead.id] : undefined,
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

  const handleDecision = useCallback(
    (decision: 'qualified' | 'skipped') => {
      if (animating || isComplete) return;
      const direction = decision === 'skipped' ? 'left' : 'right';
      setAnimating(direction);
      setTimeout(() => {
        setDecisions((prev) => ({ ...prev, [currentLead.id]: decision }));
        setCurrentIndex((prev) => prev + 1);
        setAnimating(null);
      }, 350);
    },
    [animating, isComplete, currentLead]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); handleDecision('skipped'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); handleDecision('qualified'); }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDecision]);

  if (isComplete) {
    return (
      <div className="max-w-lg mx-auto mt-20 animate-fade-in">
        <div className="glass rounded-2xl p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-elvora-gradient mx-auto mb-5 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-1">Fertig!</h2>
          <p className="text-elvora-text-muted text-sm mb-6">
            Alle {totalLeads} Leads geprüft.
          </p>
          <div className="flex justify-center gap-8 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-elvora-success">{qualifiedCount}</div>
              <div className="text-xs text-elvora-text-dim">Qualifiziert</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-elvora-text-dim">{skippedCount}</div>
              <div className="text-xs text-elvora-text-dim">Übersprungen</div>
            </div>
          </div>
          <button
            onClick={() => { setCurrentIndex(0); setDecisions({}); }}
            className="px-5 py-2.5 rounded-xl bg-elvora-gradient text-white text-sm font-medium hover:shadow-elvora-lg transition-all"
          >
            Nochmal prüfen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Progress */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-elvora-text-dim">
            {currentIndex + 1} / {totalLeads}
          </span>
          <div className="w-32 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-elvora-gradient transition-all duration-500"
              style={{ width: `${(currentIndex / totalLeads) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-elvora-text-dim">
          <span className="text-elvora-success">{qualifiedCount} ja</span>
          <span>{skippedCount} nein</span>
        </div>
      </div>

      {/* Lead Card */}
      <div
        className={`glass-strong rounded-2xl overflow-hidden transition-all duration-350 ${
          animating === 'left' ? 'animate-slide-left'
            : animating === 'right' ? 'animate-slide-right'
            : 'animate-scale-in'
        }`}
      >
        {/* Header: Name + Score + Anrufen-Button */}
        <div className="p-5 pb-3">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-white">{currentLead.name}</h2>
              <div className="flex items-center gap-2 mt-0.5 text-sm text-elvora-text-dim">
                <span>{currentLead.ansprechpartner}</span>
                <span>·</span>
                <span>{currentLead.city}</span>
                <span>·</span>
                <span>{currentLead.branche}</span>
              </div>
            </div>
            <div className={`${getScoreColor(currentLead.score)} px-3 py-1.5 rounded-xl`}>
              <div className="text-xl font-bold text-white">{currentLead.score}</div>
            </div>
          </div>

          {/* Sofort-Anrufen Button + Kontaktdaten */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-3">
            <a
              href={`tel:${currentLead.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl bg-elvora-success/15 border border-elvora-success/30 text-elvora-success font-semibold text-sm hover:bg-elvora-success/25 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              {currentLead.phone}
            </a>
            <div className="flex items-center gap-3 text-sm overflow-hidden">
              <a href={`https://${currentLead.website}`} target="_blank" rel="noopener noreferrer" className="text-elvora-purple-light hover:underline truncate">{currentLead.website}</a>
              {currentLead.email && <span className="text-elvora-text-dim truncate hidden sm:inline">{currentLead.email}</span>}
            </div>
          </div>
        </div>

        {/* Top Problem - der Hingucker, auf einen Blick */}
        <div className="mx-5 mb-3 p-3 rounded-xl bg-elvora-danger/8 border border-elvora-danger/20">
          <div className="flex items-start gap-2">
            <svg className="w-4 h-4 text-elvora-danger mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-medium text-elvora-danger/90">{currentLead.topProblem}</span>
          </div>
        </div>

        {/* Alle Probleme + SEO kompakt */}
        <div className="px-5 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-x-6">
            {/* Probleme */}
            <div>
              <div className="text-[10px] font-semibold text-elvora-text-dim uppercase tracking-wider mb-1.5">Probleme</div>
              <div className="space-y-1">
                {currentLead.problems.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-[13px]">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      p.severity === 'critical' ? 'bg-elvora-danger'
                        : p.severity === 'major' ? 'bg-elvora-warning'
                        : 'bg-elvora-text-dim'
                    }`} />
                    <span className="text-elvora-text-muted">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* SEO */}
            {currentLead.seoIssues.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-elvora-text-dim uppercase tracking-wider mb-1.5">SEO</div>
                <div className="space-y-1">
                  {currentLead.seoIssues.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-[13px]">
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        s.impact === 'high' ? 'bg-elvora-danger'
                          : s.impact === 'medium' ? 'bg-elvora-warning'
                          : 'bg-elvora-text-dim'
                      }`} />
                      <span className="text-elvora-text-muted">{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* GESPRÄCHSLEITFADEN - Das Herzstück */}
        <div className="mx-5 mb-4 rounded-xl bg-elvora-primary/5 border border-elvora-primary/20 overflow-hidden">
          <div className="px-4 py-2 bg-elvora-primary/10 border-b border-elvora-primary/15">
            <div className="text-[10px] font-bold text-elvora-purple-light uppercase tracking-widest">
              Gesprächsleitfaden \u2013 {currentLead.ansprechpartner}
            </div>
          </div>
          <div className="p-4 space-y-3 text-sm leading-relaxed">
            {/* Einstieg */}
            <div>
              <div className="text-[10px] font-semibold text-elvora-success uppercase tracking-wider mb-0.5">Einstieg</div>
              <p className="text-elvora-text-muted">{currentLead.callScript.einstieg}</p>
            </div>
            {/* Problem */}
            <div>
              <div className="text-[10px] font-semibold text-elvora-warning uppercase tracking-wider mb-0.5">Problem ansprechen</div>
              <p className="text-elvora-text-muted">{currentLead.callScript.problemSatz}</p>
            </div>
            {/* Lösung */}
            <div>
              <div className="text-[10px] font-semibold text-elvora-purple-light uppercase tracking-wider mb-0.5">Lösung anbieten</div>
              <p className="text-elvora-text-muted">{currentLead.callScript.loesungSatz}</p>
            </div>
            {/* CTA */}
            <div>
              <div className="text-[10px] font-semibold text-elvora-pink uppercase tracking-wider mb-0.5">Abschluss</div>
              <p className="text-white font-medium">{currentLead.callScript.cta}</p>
            </div>
          </div>
        </div>

        {/* Audit Link Generator */}
        <div className="mx-5 mb-4">
          {auditLinks[currentLead.id] ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-elvora-success/10 border border-elvora-success/20">
              <svg className="w-4 h-4 text-elvora-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-elvora-success font-medium truncate">Audit-Link erstellt</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.origin + auditLinks[currentLead.id]);
                }}
                className="ml-auto px-3 py-1 rounded-lg bg-elvora-success/20 text-elvora-success text-xs font-semibold hover:bg-elvora-success/30 transition-all flex-shrink-0"
              >
                Link kopieren
              </button>
            </div>
          ) : (
            <button
              onClick={() => generateAudit(currentLead.id)}
              disabled={auditLoading === currentLead.id}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-elvora-primary/10 border border-elvora-primary/20 text-elvora-primary-light text-sm font-semibold hover:bg-elvora-primary/20 transition-all disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {auditLoading === currentLead.id ? 'Wird erstellt...' : 'Audit-Seite erstellen'}
            </button>
          )}
        </div>

        {/* Mail senden Button */}
        <div className="mx-5 mb-4">
          {emailError && (
            <div className="mb-2 p-2 rounded-lg bg-elvora-danger/10 border border-elvora-danger/20 text-elvora-danger text-xs animate-fade-in">
              {emailError}
            </div>
          )}
          {emailStatus[currentLead.id] === 'sent' ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-elvora-success/10 border border-elvora-success/20">
              <svg className="w-4 h-4 text-elvora-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-elvora-success font-medium">Pitch-Mail gesendet an {currentLead.email}</span>
            </div>
          ) : (
            <button
              onClick={() => sendEmail(currentLead)}
              disabled={emailSending === currentLead.id || !currentLead.email}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                !currentLead.email
                  ? 'bg-white/5 border border-white/10 text-elvora-text-dim cursor-not-allowed'
                  : 'bg-elvora-pink/10 border border-elvora-pink/20 text-elvora-pink-light hover:bg-elvora-pink/20'
              }`}
            >
              {emailSending === currentLead.id ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Mail wird gesendet...
                </>
              ) : !currentLead.email ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Keine E-Mail vorhanden
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Pitch-Mail senden an {currentLead.email}
                </>
              )}
            </button>
          )}
        </div>

        {/* Action Buttons - extra tall on mobile for easy thumb tap */}
        <div className="flex border-t border-white/5">
          <button
            onClick={() => handleDecision('skipped')}
            disabled={!!animating}
            className="flex-1 py-5 sm:py-4 text-elvora-text-muted font-semibold text-base hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 active:scale-[0.98] border-r border-white/5"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              SKIP
            </span>
          </button>
          <button
            onClick={() => handleDecision('qualified')}
            disabled={!!animating}
            className="flex-1 py-5 sm:py-4 bg-elvora-gradient text-white font-semibold text-base hover:shadow-elvora-lg transition-all disabled:opacity-50 active:scale-[0.98]"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              LEAD!
            </span>
          </button>
        </div>
      </div>

      {/* Keyboard hint - only on desktop */}
      <div className="text-center mt-3 text-xs text-elvora-text-dim hidden sm:block">
        Pfeiltasten: &larr; Skip &middot; &rarr; Lead
      </div>
    </div>
  );
}
