'use client';

import { useState } from 'react';

interface Problem {
  id: string;
  label: string;
  severity: string;
}

interface SeoIssue {
  id: string;
  label: string;
  impact: string;
}

interface Competitor {
  name: string;
  score: number;
  hasSSL: boolean;
}

interface AuditPageClientProps {
  businessName: string;
  city: string;
  website: string;
  score: number;
  problems: Problem[];
  seoIssues: SeoIssue[];
  calendlyUrl: string | null;
  createdAt: string;
  competitors?: Competitor[];
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Kritisch';
  if (score >= 60) return 'Verbesserungsbedarf';
  if (score >= 40) return 'Mangelhaft';
  return 'Akzeptabel';
}

function getScoreGradient(score: number): string {
  if (score >= 80) return 'from-red-500 to-orange-500';
  if (score >= 60) return 'from-orange-500 to-yellow-500';
  if (score >= 40) return 'from-yellow-500 to-blue-500';
  return 'from-blue-500 to-green-500';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'bg-red-500';
    case 'major': return 'bg-orange-500';
    case 'high': return 'bg-red-500';
    case 'medium': return 'bg-orange-500';
    default: return 'bg-slate-500';
  }
}

function getSeverityLabel(severity: string): string {
  switch (severity) {
    case 'critical': return 'Kritisch';
    case 'major': return 'Wichtig';
    case 'minor': return 'Gering';
    case 'high': return 'Hoch';
    case 'medium': return 'Mittel';
    case 'low': return 'Niedrig';
    default: return severity;
  }
}

function getSeverityBadgeClass(severity: string): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'bg-red-500/15 text-red-400 border-red-500/25';
    case 'major':
    case 'medium':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/25';
    default:
      return 'bg-slate-500/15 text-slate-400 border-slate-500/25';
  }
}

function anonymizeName(name: string): string {
  const words = name.split(/\s+/);
  if (words.length >= 2) {
    return words[0] + ' ' + words.slice(1).map(w => w[0] + '.').join(' ');
  }
  return name.length > 6 ? name.slice(0, 6) + '...' : name;
}

function getBarColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 50) return 'bg-yellow-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

export default function AuditPageClient({
  businessName,
  city,
  website,
  score,
  problems,
  seoIssues,
  calendlyUrl,
  createdAt,
  competitors = [],
}: AuditPageClientProps) {
  const [ctaClicked, setCtaClicked] = useState(false);
  const [showCalendly, setShowCalendly] = useState(false);
  const totalIssues = problems.length + seoIssues.length;
  const criticalCount = problems.filter(p => p.severity === 'critical').length;
  const scorePercent = Math.min(100, score);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  const betterCompetitors = competitors.filter(c => c.score > score);
  const showCompetitors = competitors.length >= 2;

  const handleCtaClick = () => {
    setCtaClicked(true);
    fetch(`/api/audit/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ website }),
    }).catch(() => {});
  };

  const formattedDate = new Date(createdAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-elvora-bg">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 141 141" fill="none">
              <defs>
                <linearGradient id="ai-g1" x1="48.7" y1="8.08" x2="85.52" y2="73.15" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#5c67db" />
                  <stop offset="1" stopColor="#7944d0" />
                </linearGradient>
                <linearGradient id="ai-g2" x1="91.59" y1="36.08" x2="86.01" y2="128.67" gradientUnits="userSpaceOnUse">
                  <stop offset=".31" stopColor="#be34ad" />
                  <stop offset="1" stopColor="#e42b79" />
                </linearGradient>
              </defs>
              <path d="M138.4,0L18.24,117.31C6.91,104.86,0,88.3,0,70.14,0,31.4,31.4,0,70.13,0h68.27Z" fill="url(#ai-g1)" />
              <path d="M140.26,26.17v43.97c-1.52,40.91-32.33,71.45-70.14,70.13-12.74-.44-24.7-3.41-35.01-9.36L140.26,26.17Z" fill="url(#ai-g2)" />
            </svg>
            <span className="text-sm font-bold gradient-text tracking-tight">ELVORA</span>
          </div>
          <span className="text-xs text-elvora-text-dim">Audit vom {formattedDate}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            Website-Audit
          </h1>
          <p className="text-lg text-elvora-text-muted">
            {businessName} <span className="text-elvora-text-dim">|</span> {city}
          </p>
          {website && (
            <p className="text-sm text-elvora-text-dim mt-1">{website}</p>
          )}
        </div>

        {/* Score Circle */}
        <div className="glass-strong rounded-2xl p-8">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="relative w-36 h-36 flex-shrink-0">
              <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke="url(#score-gradient)" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="score-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="100%" stopColor="#F97316" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-white">{score}</span>
                <span className="text-xs text-elvora-text-dim">/100</span>
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left">
              <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r ${getScoreGradient(score)} text-white mb-3`}>
                {getScoreLabel(score)}
              </div>
              <p className="text-elvora-text-muted text-sm leading-relaxed">
                {score >= 80 ? (
                  <>Ihre Website weist <strong className="text-white">{totalIssues} Probleme</strong> auf, davon <strong className="text-red-400">{criticalCount} kritisch</strong>. Potenzielle Kunden springen mit hoher Wahrscheinlichkeit ab, bevor sie Sie kontaktieren.</>
                ) : score >= 60 ? (
                  <>Wir haben <strong className="text-white">{totalIssues} Verbesserungspunkte</strong> gefunden. Ihre Website funktioniert grundsätzlich, verliert aber Kunden durch vermeidbare Probleme.</>
                ) : score >= 40 ? (
                  <>Ihre Website hat <strong className="text-white">{totalIssues} Punkte</strong>, die verbessert werden können. Mit gezielten Anpassungen können Sie deutlich mehr Anfragen generieren.</>
                ) : (
                  <>Ihre Website ist grundlegend in Ordnung, aber es gibt noch <strong className="text-white">{totalIssues} Optimierungsmöglichkeiten</strong>, um mehr Kunden zu gewinnen.</>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{criticalCount}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Kritisch</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-400">{problems.filter(p => p.severity === 'major').length}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Wichtig</div>
          </div>
          <div className="glass rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-elvora-text-muted">{seoIssues.length}</div>
            <div className="text-xs text-elvora-text-dim mt-1">SEO-Probleme</div>
          </div>
        </div>

        {/* Problems */}
        {problems.length > 0 && (
          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Gefundene Probleme
              </h2>
            </div>
            <div className="divide-y divide-white/5">
              {problems.map((problem, i) => (
                <div key={problem.id || i} className="px-5 py-4 flex items-start gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getSeverityColor(problem.severity)}`} />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{problem.label}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${getSeverityBadgeClass(problem.severity)}`}>
                    {getSeverityLabel(problem.severity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEO Issues */}
        {seoIssues.length > 0 && (
          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                SEO-Analyse
              </h2>
            </div>
            <div className="divide-y divide-white/5">
              {seoIssues.map((issue, i) => (
                <div key={issue.id || i} className="px-5 py-4 flex items-start gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${getSeverityColor(issue.impact)}`} />
                  <div className="flex-1">
                    <p className="text-sm text-white font-medium">{issue.label}</p>
                  </div>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${getSeverityBadgeClass(issue.impact)}`}>
                    {getSeverityLabel(issue.impact)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Competitor Comparison */}
        {showCompetitors && (
          <div className="glass-strong rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                So steht Ihre Konkurrenz da
              </h2>
              {betterCompetitors.length > 0 && (
                <p className="text-xs text-elvora-text-dim mt-1">
                  {betterCompetitors.length} {betterCompetitors.length === 1 ? 'Mitbewerber' : 'Mitbewerber'} in {city} {betterCompetitors.length === 1 ? 'hat eine' : 'haben'} bessere Website{betterCompetitors.length === 1 ? '' : 's'} als Sie
                </p>
              )}
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Your score */}
              <div className="flex items-center gap-3">
                <div className="w-[120px] sm:w-[160px] text-right flex-shrink-0">
                  <span className="text-sm font-semibold text-white">Sie</span>
                </div>
                <div className="flex-1 h-7 bg-white/[0.03] rounded-md overflow-hidden relative">
                  <div
                    className={`h-full ${getBarColor(score)} rounded-md flex items-center px-3`}
                    style={{ width: `${Math.max(8, score)}%` }}
                  >
                    <span className="text-xs font-bold text-white">{score}</span>
                  </div>
                </div>
              </div>

              {/* Competitor scores */}
              {competitors.slice(0, 4).map((comp, i) => {
                const isBetter = comp.score > score;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-[120px] sm:w-[160px] text-right flex-shrink-0">
                      <span className="text-sm text-elvora-text-muted truncate block">{anonymizeName(comp.name)}</span>
                    </div>
                    <div className="flex-1 h-7 bg-white/[0.03] rounded-md overflow-hidden relative">
                      <div
                        className={`h-full ${isBetter ? 'bg-green-500/70' : 'bg-white/10'} rounded-md flex items-center px-3`}
                        style={{ width: `${Math.max(8, comp.score)}%` }}
                      >
                        <span className="text-xs font-semibold text-white">{comp.score}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {betterCompetitors.length > 0 && (
              <div className="px-5 py-4 border-t border-white/5 bg-red-500/[0.03]">
                <p className="text-sm text-elvora-text-muted">
                  <strong className="text-white">Ihre Konkurrenz ist online besser aufgestellt.</strong>{' '}
                  Kunden, die nach Ihren Leistungen in {city} suchen, finden zuerst die Websites Ihrer Mitbewerber — und kontaktieren diese statt Sie.
                </p>
              </div>
            )}
          </div>
        )}

        {/* CTA Section */}
        <div className="glass-strong rounded-2xl p-8 text-center border border-elvora-primary/20">
          <div className="w-14 h-14 rounded-full bg-elvora-gradient mx-auto mb-4 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {betterCompetitors.length > 0
              ? 'Holen Sie den Vorsprung Ihrer Konkurrenz auf'
              : 'Lassen Sie uns das gemeinsam lösen'}
          </h2>
          <p className="text-sm text-elvora-text-muted mb-6 max-w-md mx-auto">
            {betterCompetitors.length > 0
              ? `In einem kostenlosen 15-Minuten-Gespräch zeige ich Ihnen, wie ${businessName} online wieder konkurrenzfähig wird — und Kunden gewinnt statt verliert.`
              : 'In einem kostenlosen 15-Minuten-Gespräch zeige ich Ihnen, wie wir diese Probleme beheben und Ihre Website in eine Kundenmaschine verwandeln.'}
          </p>

          {calendlyUrl ? (
            <>
              {!showCalendly ? (
                <button
                  onClick={() => { setShowCalendly(true); handleCtaClick(); }}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-elvora-gradient text-white font-semibold text-base hover:shadow-elvora-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Kostenloses Erstgespräch buchen
                </button>
              ) : (
                <div className="mt-4 rounded-xl overflow-hidden border border-white/10 animate-fade-in">
                  <iframe
                    src={calendlyUrl}
                    width="100%"
                    height="650"
                    frameBorder="0"
                    className="bg-white rounded-xl"
                    title="Termin buchen"
                  />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <a
                href={`mailto:?subject=Website-Anfrage ${businessName}&body=Hallo, ich habe den Website-Audit gesehen und würde gerne über eine neue Website sprechen.`}
                onClick={handleCtaClick}
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-elvora-gradient text-white font-semibold text-base hover:shadow-elvora-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Kostenlos beraten lassen
              </a>
            </div>
          )}

          {ctaClicked && !showCalendly && (
            <p className="text-xs text-elvora-success mt-4 animate-fade-in">
              Wir melden uns innerhalb von 24 Stunden bei Ihnen!
            </p>
          )}
        </div>

        {/* Trust Elements */}
        <div className="text-center text-xs text-elvora-text-dim space-y-1 pb-8">
          <p>Dieser Audit wurde automatisch erstellt und dient als kostenlose Erstanalyse.</p>
          <p>Alle Daten werden vertraulich behandelt.</p>
        </div>
      </main>
    </div>
  );
}
