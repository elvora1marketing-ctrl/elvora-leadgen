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
  timesSeen: number;
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
      { id: 'p1', label: 'No SSL certificate - site loads over HTTP only', severity: 'critical' },
      { id: 'p2', label: 'Website not mobile-responsive, breaks on small screens', severity: 'critical' },
      { id: 'p3', label: 'No Google Business Profile claimed', severity: 'major' },
      { id: 'p4', label: 'Contact form returns 500 error', severity: 'major' },
      { id: 'p5', label: 'Images not optimized (3.2MB homepage)', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Missing meta descriptions on all pages', impact: 'high' },
      { id: 's2', label: 'No structured data / Schema markup', impact: 'high' },
      { id: 's3', label: 'Page speed score: 23/100 (mobile)', impact: 'high' },
      { id: 's4', label: 'Missing H1 tags on service pages', impact: 'medium' },
    ],
    salesPitch:
      'Herr Krause, Ihre Website verliert aktuell potenzielle Kunden, da sie nicht mobil nutzbar ist und kein SSL-Zertifikat hat. Wir k\u00f6nnen Ihnen eine moderne, sichere Website erstellen, die auf Google besser gefunden wird und automatisch Anfragen generiert.',
    keywords: ['Sanit\u00e4r', 'Klempner'],
    timesSeen: 3,
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
      { id: 'p1', label: 'Outdated WordPress version (4.9) with security vulnerabilities', severity: 'critical' },
      { id: 'p2', label: 'Website design looks like 2010, very dated', severity: 'major' },
      { id: 'p3', label: 'No online booking or contact form', severity: 'major' },
      { id: 'p4', label: 'Phone number not clickable on mobile', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Only 3 indexed pages on Google', impact: 'high' },
      { id: 's2', label: 'No local SEO optimization', impact: 'high' },
      { id: 's3', label: 'Missing alt tags on all images', impact: 'medium' },
    ],
    salesPitch:
      'Herr Meier, Ihre aktuelle Website basiert auf einer veralteten WordPress-Version mit Sicherheitsl\u00fccken. Wir bieten Ihnen ein modernes Redesign mit integrierter Online-Terminbuchung, das Ihre Sichtbarkeit in Dortmund deutlich steigern wird.',
    keywords: ['Heizung', 'SHK'],
    timesSeen: 2,
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
      { id: 'p1', label: 'Website is a single static HTML page', severity: 'major' },
      { id: 'p2', label: 'No social media presence', severity: 'minor' },
      { id: 'p3', label: 'Business hours not listed anywhere', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Single page with no internal linking', impact: 'high' },
      { id: 's2', label: 'Title tag is just "Home"', impact: 'medium' },
      { id: 's3', label: 'No sitemap.xml', impact: 'low' },
    ],
    salesPitch:
      'Herr Schuster, mit einer einzigen statischen Seite verschenken Sie enormes Potenzial bei Google. Wir k\u00f6nnen Ihnen eine professionelle Website mit eigenen Seiten f\u00fcr jeden Service erstellen, die Sie in Bochum ganz nach vorne bringt.',
    keywords: ['Heizung'],
    timesSeen: 1,
  },
  {
    id: 4,
    name: 'Weber Klempnerei & Sanit\u00e4r',
    website: 'www.weber-klempner-duisburg.de',
    phone: '+49 203 4445566',
    email: 'info@weber-klempner.de',
    city: 'Duisburg',
    score: 95,
    problems: [
      { id: 'p1', label: 'Website completely down (DNS error)', severity: 'critical' },
      { id: 'p2', label: 'Google listing shows "permanently closed" incorrectly', severity: 'critical' },
      { id: 'p3', label: 'Competitor ads showing for their brand name', severity: 'major' },
      { id: 'p4', label: 'No reviews management strategy', severity: 'major' },
      { id: 'p5', label: '2-star average on Google (12 reviews)', severity: 'major' },
    ],
    seoIssues: [
      { id: 's1', label: 'Domain expired / not resolving', impact: 'high' },
      { id: 's2', label: 'Zero organic visibility', impact: 'high' },
      { id: 's3', label: 'Google Business listing needs recovery', impact: 'high' },
    ],
    salesPitch:
      'Herr Weber, Ihre Website ist aktuell nicht erreichbar und Ihr Google-Eintrag zeigt f\u00e4lschlicherweise "dauerhaft geschlossen". Das kostet Sie t\u00e4glich Kunden. Wir k\u00f6nnen das sofort beheben und Ihre Online-Pr\u00e4senz innerhalb einer Woche wiederherstellen.',
    keywords: ['Klempner', 'Sanit\u00e4r'],
    timesSeen: 5,
  },
  {
    id: 5,
    name: 'B\u00f6hm W\u00e4rmetechnik OHG',
    website: 'www.boehm-waermetechnik.de',
    phone: '+49 201 3332211',
    email: 'service@boehm-waerme.de',
    city: 'Essen',
    score: 64,
    problems: [
      { id: 'p1', label: 'Slow loading (8.2s on mobile)', severity: 'major' },
      { id: 'p2', label: 'Cookie banner blocks entire page', severity: 'minor' },
    ],
    seoIssues: [
      { id: 's1', label: 'Duplicate content on service pages', impact: 'medium' },
      { id: 's2', label: 'Missing robots.txt', impact: 'low' },
    ],
    salesPitch:
      'Herr B\u00f6hm, Ihre Website l\u00e4dt \u00fcber 8 Sekunden auf dem Handy \u2013 die meisten Besucher springen nach 3 Sekunden ab. Eine Performance-Optimierung k\u00f6nnte Ihre Anfragen verdoppeln.',
    keywords: ['Heizung', 'SHK'],
    timesSeen: 1,
  },
];

function getScoreClass(score: number): string {
  if (score >= 85) return 'score-hot';
  if (score >= 70) return 'score-warm';
  return 'score-cold';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'HOT';
  if (score >= 70) return 'WARM';
  return 'COLD';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-elvora-danger';
    case 'major':
      return 'text-elvora-warning';
    case 'minor':
      return 'text-elvora-text-dim';
    default:
      return 'text-elvora-text-muted';
  }
}

function getSeverityBg(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'bg-elvora-danger/10';
    case 'major':
      return 'bg-elvora-warning/10';
    case 'minor':
      return 'bg-white/5';
    default:
      return 'bg-white/5';
  }
}

function getImpactColor(impact: string): string {
  switch (impact) {
    case 'high':
      return 'text-elvora-danger';
    case 'medium':
      return 'text-elvora-warning';
    case 'low':
      return 'text-elvora-text-dim';
    default:
      return 'text-elvora-text-muted';
  }
}

export default function ReviewPage() {
  const [leads] = useState<ReviewLead[]>(sampleLeads);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<Record<number, 'qualified' | 'skipped'>>({});
  const [animating, setAnimating] = useState<'left' | 'right' | null>(null);
  const [showPitch, setShowPitch] = useState(false);

  const currentLead = leads[currentIndex];
  const totalLeads = leads.length;
  const reviewedCount = Object.keys(decisions).length;
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
        setShowPitch(false);
      }, 400);
    },
    [animating, isComplete, currentLead]
  );

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleDecision('skipped');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleDecision('qualified');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDecision]);

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto animate-fade-in">
        <div className="glass rounded-2xl p-12 text-center">
          <div className="w-20 h-20 rounded-full bg-elvora-gradient mx-auto mb-6 flex items-center justify-center">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Review Complete</h2>
          <p className="text-elvora-text-muted mb-8">
            You reviewed all {totalLeads} leads in this batch.
          </p>
          <div className="flex justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-elvora-success">{qualifiedCount}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Qualified</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-elvora-text-dim">{skippedCount}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Skipped</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-elvora-purple-light">
                {totalLeads > 0 ? Math.round((qualifiedCount / totalLeads) * 100) : 0}%
              </div>
              <div className="text-xs text-elvora-text-dim mt-1">Conversion</div>
            </div>
          </div>
          <button
            onClick={() => {
              setCurrentIndex(0);
              setDecisions({});
            }}
            className="px-6 py-3 rounded-xl bg-elvora-gradient text-white font-medium hover:shadow-elvora-lg transition-all"
          >
            Review Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Review Leads</h1>
          <p className="text-elvora-text-muted text-sm mt-1">
            Swipe right to qualify, left to skip
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-elvora-text-dim">
          <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono">
            &larr;
          </kbd>
          <span>Skip</span>
          <span className="mx-2">|</span>
          <kbd className="px-2 py-1 rounded bg-white/5 border border-white/10 text-xs font-mono">
            &rarr;
          </kbd>
          <span>Qualify</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-elvora-text-dim">
            Lead {currentIndex + 1} of {totalLeads}
          </span>
          <span className="text-xs text-elvora-text-dim">
            {Math.round(((currentIndex) / totalLeads) * 100)}% reviewed
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-elvora-gradient transition-all duration-500"
            style={{ width: `${(currentIndex / totalLeads) * 100}%` }}
          />
        </div>
      </div>

      {/* Lead Card */}
      <div
        className={`glass-strong rounded-2xl overflow-hidden transition-all duration-400 ${
          animating === 'left'
            ? 'animate-slide-left'
            : animating === 'right'
            ? 'animate-slide-right'
            : 'animate-scale-in'
        }`}
      >
        {/* Card Header with Score */}
        <div className="relative p-6 pb-4 border-b border-white/5">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-white">{currentLead.name}</h2>
                {currentLead.timesSeen > 1 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-elvora-purple/20 text-elvora-purple-light border border-elvora-purple/30">
                    Seen {currentLead.timesSeen}x
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {currentLead.keywords.map((kw) => (
                  <span key={kw} className="tag">{kw}</span>
                ))}
              </div>
            </div>
            <div className={`${getScoreClass(currentLead.score)} px-4 py-2 rounded-xl text-center`}>
              <div className="text-2xl font-bold text-white">{currentLead.score}</div>
              <div className="text-[10px] font-semibold text-white/80 tracking-wider">
                {getScoreLabel(currentLead.score)}
              </div>
            </div>
          </div>
        </div>

        {/* Screenshots Placeholder */}
        <div className="grid grid-cols-2 gap-4 p-6 pb-0">
          <div className="aspect-video bg-white/[0.03] rounded-xl border border-white/5 flex flex-col items-center justify-center">
            <svg className="w-8 h-8 text-elvora-text-dim mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-elvora-text-dim">Desktop Screenshot</span>
          </div>
          <div className="aspect-video bg-white/[0.03] rounded-xl border border-white/5 flex flex-col items-center justify-center">
            <svg className="w-8 h-8 text-elvora-text-dim mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-elvora-text-dim">Mobile Screenshot</span>
          </div>
        </div>

        {/* Company Info */}
        <div className="p-6 pb-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Website</p>
                <p className="text-sm text-elvora-purple-light truncate">{currentLead.website}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">City</p>
                <p className="text-sm text-white">{currentLead.city}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Phone</p>
                <p className="text-sm text-white">{currentLead.phone || 'Not found'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Email</p>
                <p className="text-sm text-white truncate">{currentLead.email || 'Not found'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Problems */}
        <div className="px-6 pb-4">
          <h3 className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">
            Problems Found ({currentLead.problems.length})
          </h3>
          <div className="space-y-2">
            {currentLead.problems.map((problem) => (
              <div
                key={problem.id}
                className={`flex items-start gap-3 p-3 rounded-xl ${getSeverityBg(problem.severity)}`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                    problem.severity === 'critical'
                      ? 'bg-elvora-danger'
                      : problem.severity === 'major'
                      ? 'bg-elvora-warning'
                      : 'bg-elvora-text-dim'
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-elvora-text-muted">{problem.label}</p>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${getSeverityColor(problem.severity)}`}>
                  {problem.severity}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SEO Issues */}
        <div className="px-6 pb-4">
          <h3 className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">
            SEO Issues ({currentLead.seoIssues.length})
          </h3>
          <div className="space-y-2">
            {currentLead.seoIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03]"
              >
                <svg
                  className={`w-4 h-4 flex-shrink-0 ${getImpactColor(issue.impact)}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <p className="text-sm text-elvora-text-muted flex-1">{issue.label}</p>
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${getImpactColor(issue.impact)}`}>
                  {issue.impact}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Sales Pitch */}
        <div className="px-6 pb-6">
          <button
            onClick={() => setShowPitch(!showPitch)}
            className="flex items-center gap-2 text-xs font-semibold text-elvora-primary-light uppercase tracking-wider mb-3 hover:text-elvora-primary/80 transition-colors"
          >
            <svg
              className={`w-4 h-4 transition-transform ${showPitch ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
            </svg>
            Sales Pitch Suggestion
          </button>
          {showPitch && (
            <div className="p-4 rounded-xl bg-elvora-primary/5 border border-elvora-primary/20 animate-fade-in">
              <p className="text-sm text-elvora-text-muted leading-relaxed italic">
                &ldquo;{currentLead.salesPitch}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-0">
          <div className="flex gap-4">
            <button
              onClick={() => handleDecision('skipped')}
              disabled={!!animating}
              className="flex-1 py-4 rounded-xl bg-white/5 border border-white/10 text-elvora-text-muted font-semibold text-lg hover:bg-white/10 hover:border-white/20 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
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
              className="flex-1 py-4 rounded-xl bg-elvora-gradient text-white font-semibold text-lg hover:shadow-elvora-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
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
      </div>

      {/* Quick Stats */}
      <div className="mt-6 flex items-center justify-center gap-8">
        <div className="text-center">
          <div className="text-lg font-bold text-elvora-success">{qualifiedCount}</div>
          <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Qualified</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="text-lg font-bold text-elvora-text-dim">{skippedCount}</div>
          <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Skipped</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="text-lg font-bold text-elvora-purple-light">{totalLeads - reviewedCount}</div>
          <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">Remaining</div>
        </div>
      </div>
    </div>
  );
}
