'use client';

import { useState, useEffect, useCallback } from 'react';

interface ReviewLead {
  id: number;
  name: string;
  website: string;
  phone: string;
  email: string;
  city: string;
  score: number;
  problems: { id: string; label: string; severity: 'critical' | 'major' | 'minor' }[];
  seoIssues: { id: string; label: string; impact: 'high' | 'medium' | 'low' }[];
  salesPitch: string;
  keywords: string[];
}

const sampleLeads: ReviewLead[] = [
  {
    id: 1,
    name: 'Krause Sanitärtechnik GmbH',
    website: 'www.krause-sanitaer-essen.de',
    phone: '+49 201 7654321',
    email: 'info@krause-sanitaer-essen.de',
    city: 'Essen',
    score: 92,
    problems: [
      { id: 'p1', label: 'Kein SSL-Zertifikat', severity: 'critical' },
      { id: 'p2', label: 'Nicht mobilfähig', severity: 'critical' },
      { id: 'p3', label: 'Kein Google Business Profil', severity: 'major' },
      { id: 'p4', label: 'Kontaktformular defekt (500 Error)', severity: 'major' },
      { id: 'p5', label: 'Bilder nicht optimiert (3.2MB)', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Meta-Beschreibungen fehlen', impact: 'high' },
      { id: 's2', label: 'Keine strukturierten Daten', impact: 'high' },
      { id: 's3', label: 'PageSpeed 23/100 (mobil)', impact: 'high' },
    ],
    salesPitch:
      'Herr Krause, Ihre Website verliert aktuell Kunden \u2013 kein SSL, nicht mobilfähig. Wir können das in einer Woche beheben und Ihre Sichtbarkeit bei Google verdoppeln.',
    keywords: ['Sanitär', 'Klempner'],
  },
  {
    id: 2,
    name: 'Meier Haustechnik',
    website: 'www.meier-haustechnik-dortmund.de',
    phone: '+49 231 5551234',
    email: 'kontakt@meier-haustechnik.de',
    city: 'Dortmund',
    score: 87,
    problems: [
      { id: 'p1', label: 'WordPress 4.9 mit Sicherheitslücken', severity: 'critical' },
      { id: 'p2', label: 'Design veraltet (ca. 2010)', severity: 'major' },
      { id: 'p3', label: 'Keine Online-Terminbuchung', severity: 'major' },
    ],
    seoIssues: [
      { id: 's1', label: 'Nur 3 Seiten bei Google indexiert', impact: 'high' },
      { id: 's2', label: 'Keine lokale SEO-Optimierung', impact: 'high' },
    ],
    salesPitch:
      'Herr Meier, Ihre WordPress-Version hat Sicherheitslücken. Modernes Redesign mit Terminbuchung steigert Ihre Sichtbarkeit in Dortmund deutlich.',
    keywords: ['Heizung', 'SHK'],
  },
  {
    id: 3,
    name: 'Schuster & Sohn Heizungsbau',
    website: 'www.schuster-sohn-heizung.de',
    phone: '+49 234 8889900',
    email: '',
    city: 'Bochum',
    score: 78,
    problems: [
      { id: 'p1', label: 'Nur eine statische HTML-Seite', severity: 'major' },
      { id: 'p2', label: 'Keine Social-Media-Präsenz', severity: 'minor' },
      { id: 'p3', label: 'Öffnungszeiten fehlen', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Keine interne Verlinkung', impact: 'high' },
      { id: 's2', label: 'Title-Tag ist nur "Home"', impact: 'medium' },
    ],
    salesPitch:
      'Herr Schuster, mit nur einer Seite verschenken Sie Google-Potenzial. Eigene Seiten pro Service bringen Sie in Bochum nach vorne.',
    keywords: ['Heizung'],
  },
  {
    id: 4,
    name: 'Weber Klempnerei & Sanitär',
    website: 'www.weber-klempner-duisburg.de',
    phone: '+49 203 4445566',
    email: 'info@weber-klempner.de',
    city: 'Duisburg',
    score: 95,
    problems: [
      { id: 'p1', label: 'Website komplett down (DNS-Fehler)', severity: 'critical' },
      { id: 'p2', label: 'Google zeigt "dauerhaft geschlossen"', severity: 'critical' },
      { id: 'p3', label: 'Konkurrenz schaltet Ads auf Firmennamen', severity: 'major' },
      { id: 'p4', label: '2 Sterne Bewertung (12 Reviews)', severity: 'major' },
    ],
    seoIssues: [
      { id: 's1', label: 'Domain nicht erreichbar', impact: 'high' },
      { id: 's2', label: 'Null organische Sichtbarkeit', impact: 'high' },
    ],
    salesPitch:
      'Herr Weber, Ihre Website ist offline und Google zeigt "geschlossen". Das kostet Sie täglich Kunden. Wir können das innerhalb einer Woche reparieren.',
    keywords: ['Klempner', 'Sanitär'],
  },
  {
    id: 5,
    name: 'Böhm Wärmetechnik OHG',
    website: 'www.boehm-waermetechnik.de',
    phone: '+49 201 3332211',
    email: 'service@boehm-waerme.de',
    city: 'Essen',
    score: 64,
    problems: [
      { id: 'p1', label: 'Ladezeit 8.2s auf Mobil', severity: 'major' },
      { id: 'p2', label: 'Cookie-Banner blockiert gesamte Seite', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Duplicate Content auf Serviceseiten', impact: 'medium' },
    ],
    salesPitch:
      'Herr Böhm, 8 Sekunden Ladezeit \u2013 die meisten springen nach 3 Sekunden ab. Eine Optimierung könnte Ihre Anfragen verdoppeln.',
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

  const currentLead = leads[currentIndex];
  const totalLeads = leads.length;
  const qualifiedCount = Object.values(decisions).filter((d) => d === 'qualified').length;
  const skippedCount = Object.values(decisions).filter((d) => d === 'skipped').length;
  const isComplete = currentIndex >= totalLeads;

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
      {/* Minimal header with progress */}
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

      {/* Lead Card - compact, all info at a glance */}
      <div
        className={`glass-strong rounded-2xl overflow-hidden transition-all duration-350 ${
          animating === 'left' ? 'animate-slide-left'
            : animating === 'right' ? 'animate-slide-right'
            : 'animate-scale-in'
        }`}
      >
        {/* Top: Name + Score */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-lg font-bold text-white">{currentLead.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-elvora-text-dim">{currentLead.city}</span>
              <span className="text-elvora-text-dim">·</span>
              {currentLead.keywords.map((kw) => (
                <span key={kw} className="tag text-[11px]">{kw}</span>
              ))}
            </div>
          </div>
          <div className={`${getScoreColor(currentLead.score)} px-3 py-1.5 rounded-xl text-center`}>
            <div className="text-xl font-bold text-white">{currentLead.score}</div>
          </div>
        </div>

        {/* Contact info - single row */}
        <div className="px-5 pb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <a href={`https://${currentLead.website}`} target="_blank" rel="noopener noreferrer" className="text-elvora-purple-light hover:underline">{currentLead.website}</a>
          <span className="text-white">{currentLead.phone || '—'}</span>
          <span className="text-elvora-text-muted">{currentLead.email || '—'}</span>
        </div>

        {/* Problems - compact list */}
        <div className="px-5 pb-3">
          <div className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-2">
            Probleme ({currentLead.problems.length})
          </div>
          <div className="space-y-1.5">
            {currentLead.problems.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
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

        {/* SEO - compact */}
        {currentLead.seoIssues.length > 0 && (
          <div className="px-5 pb-3">
            <div className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-2">
              SEO ({currentLead.seoIssues.length})
            </div>
            <div className="space-y-1.5">
              {currentLead.seoIssues.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
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

        {/* Sales Pitch - always visible, no accordion */}
        <div className="px-5 pb-4">
          <div className="p-3 rounded-xl bg-elvora-primary/5 border border-elvora-primary/20">
            <p className="text-sm text-elvora-text-muted italic leading-relaxed">
              &ldquo;{currentLead.salesPitch}&rdquo;
            </p>
          </div>
        </div>

        {/* Action Buttons - prominent */}
        <div className="flex border-t border-white/5">
          <button
            onClick={() => handleDecision('skipped')}
            disabled={!!animating}
            className="flex-1 py-4 text-elvora-text-muted font-semibold text-base hover:bg-white/5 hover:text-white transition-all disabled:opacity-50 active:scale-[0.98] border-r border-white/5"
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
            className="flex-1 py-4 bg-elvora-gradient text-white font-semibold text-base hover:shadow-elvora-lg transition-all disabled:opacity-50 active:scale-[0.98]"
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

      {/* Keyboard hint */}
      <div className="text-center mt-3 text-xs text-elvora-text-dim">
        Pfeiltasten: &larr; Skip &middot; &rarr; Lead
      </div>
    </div>
  );
}
