'use client';

import { useState, useEffect } from 'react';

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

interface AnalysisResult {
  score: number;
  problems: Problem[];
  seoIssues: SeoIssue[];
  leadId: number;
}

interface CheckPageClientProps {
  branche: string;
  stadt: string;
  brancheDisplay: string;
  stadtDisplay: string;
  brancheLabel: string;
  calendlyUrl: string;
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Sehr gut';
  if (score >= 60) return 'Akzeptabel';
  if (score >= 40) return 'Verbesserungsbedarf';
  return 'Kritisch';
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-blue-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreGradient(score: number): string {
  if (score >= 80) return 'from-green-500 to-emerald-500';
  if (score >= 60) return 'from-blue-500 to-cyan-500';
  if (score >= 40) return 'from-orange-500 to-yellow-500';
  return 'from-red-500 to-orange-500';
}

function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical': case 'high': return 'bg-red-500';
    case 'major': case 'medium': return 'bg-orange-500';
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
    case 'critical': case 'high':
      return 'bg-red-500/15 text-red-400 border-red-500/25';
    case 'major': case 'medium':
      return 'bg-orange-500/15 text-orange-400 border-orange-500/25';
    default:
      return 'bg-slate-500/15 text-slate-400 border-slate-500/25';
  }
}

const LOADING_STEPS = [
  'Website wird geladen...',
  'SSL-Zertifikat prüfen...',
  'Mobilfreundlichkeit testen...',
  'SEO analysieren...',
  'Ladezeit messen...',
  'Impressum & DSGVO prüfen...',
  'Ergebnis berechnen...',
];

export default function CheckPageClient({
  branche,
  stadt,
  brancheDisplay,
  stadtDisplay,
  brancheLabel,
  calendlyUrl,
}: CheckPageClientProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'results' | 'error'>('idle');
  const [url, setUrl] = useState('');
  const [firmenname, setFirmenname] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [showCalendly, setShowCalendly] = useState(false);

  // Fetch total analyzed count
  useEffect(() => {
    fetch('/api/check/stats')
      .then(r => r.json())
      .then(data => setTotalAnalyzed(data.totalAnalyzed || 0))
      .catch(() => {});
  }, []);

  // Loading animation
  useEffect(() => {
    if (state !== 'loading') return;
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, [state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setState('loading');
    setLoadingStep(0);
    setError('');

    try {
      const res = await fetch('/api/check/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          branche,
          stadt,
          firmenname: firmenname.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Analyse fehlgeschlagen');
      }

      const data = await res.json();
      setResult(data);
      setState('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      setState('error');
    }
  };

  const scorePercent = result ? Math.min(100, result.score) : 0;
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (scorePercent / 100) * circumference;

  return (
    <div className="min-h-screen bg-elvora-bg">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="check-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="50%" stopColor="#EC4899" />
                  <stop offset="100%" stopColor="#F97316" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="48" fill="url(#check-grad)" />
              <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="42" fontWeight="700" fontFamily="Inter, sans-serif">E</text>
            </svg>
            <span className="text-sm font-bold gradient-text tracking-tight">ELVORA</span>
          </div>
          <span className="text-xs text-elvora-text-dim">Kostenloser Website-Check</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* ============ IDLE STATE: Form ============ */}
        {(state === 'idle' || state === 'error') && (
          <>
            {/* Hero */}
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Kostenloser Website-Check
                <br />
                <span className="gradient-text">für {brancheLabel} in {stadtDisplay}</span>
              </h1>
              <p className="text-elvora-text-muted max-w-lg mx-auto">
                Finden Sie in 30 Sekunden heraus, wie gut Ihre Website ist — und was Sie Kunden kostet.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="glass-strong rounded-2xl p-6 sm:p-8 space-y-5">
              {/* URL Input */}
              <div>
                <label className="block text-sm font-medium text-elvora-text-muted mb-2">
                  Ihre Website-URL *
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="www.ihre-firma.de"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 focus:border-elvora-primary/50 transition-all text-lg"
                />
              </div>

              {/* Optional Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-elvora-text-dim mb-1.5">
                    Firmenname (optional)
                  </label>
                  <input
                    type="text"
                    value={firmenname}
                    onChange={e => setFirmenname(e.target.value)}
                    placeholder="Mustermann GmbH"
                    className="w-full px-3 py-2.5 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-elvora-text-dim mb-1.5">
                    Telefon (optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0201 123456"
                    className="w-full px-3 py-2.5 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 transition-all text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-elvora-text-dim mb-1.5">
                    E-Mail (optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="info@firma.de"
                    className="w-full px-3 py-2.5 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 transition-all text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 rounded-xl bg-elvora-gradient text-white font-semibold text-lg hover:shadow-elvora-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Jetzt kostenlos prüfen
              </button>
            </form>

            {/* What gets checked */}
            <div className="glass rounded-2xl p-6">
              <h2 className="text-sm font-bold text-white mb-4">Was wird geprüft?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { icon: '🔒', label: 'SSL & Sicherheit' },
                  { icon: '📱', label: 'Mobilfreundlichkeit' },
                  { icon: '🔍', label: 'SEO-Grundlagen' },
                  { icon: '⚡', label: 'Ladegeschwindigkeit' },
                  { icon: '⚖️', label: 'Impressum & DSGVO' },
                  { icon: '🎨', label: 'Design & Technik' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs text-elvora-text-muted">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
              {totalAnalyzed > 0 && (
                <p className="text-xs text-elvora-text-dim mt-4 text-center">
                  Bereits <strong className="text-elvora-text-muted">{totalAnalyzed.toLocaleString('de-DE')}</strong> Websites analysiert
                </p>
              )}
            </div>

            {/* Trust */}
            <div className="text-center text-xs text-elvora-text-dim space-y-1 pb-8">
              <p>100% kostenlos — keine versteckten Kosten, kein Abo.</p>
              <p>Ihre Daten werden vertraulich behandelt.</p>
            </div>
          </>
        )}

        {/* ============ LOADING STATE ============ */}
        {state === 'loading' && (
          <div className="glass-strong rounded-2xl p-8 sm:p-12 text-center">
            {/* Spinner */}
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-white/5" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-elvora-primary animate-spin" />
            </div>

            <h2 className="text-xl font-bold text-white mb-6">
              Ihre Website wird analysiert...
            </h2>

            <div className="space-y-3 max-w-sm mx-auto">
              {LOADING_STEPS.map((step, i) => (
                <div
                  key={step}
                  className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                    i < loadingStep
                      ? 'text-elvora-success'
                      : i === loadingStep
                        ? 'text-white'
                        : 'text-elvora-text-dim'
                  }`}
                >
                  {i < loadingStep ? (
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i === loadingStep ? (
                    <div className="w-4 h-4 flex-shrink-0 rounded-full border-2 border-elvora-primary border-t-transparent animate-spin" />
                  ) : (
                    <div className="w-4 h-4 flex-shrink-0 rounded-full border border-white/10" />
                  )}
                  <span>{step}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-elvora-text-dim mt-6">
              Dies dauert ca. 15-30 Sekunden
            </p>
          </div>
        )}

        {/* ============ RESULTS STATE ============ */}
        {state === 'results' && result && (
          <>
            {/* Score Circle */}
            <div className="glass-strong rounded-2xl p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Ihr Ergebnis</h2>
                {url && <p className="text-sm text-elvora-text-dim">{url}</p>}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="relative w-36 h-36 flex-shrink-0">
                  <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 120 120">
                    <circle
                      cx="60" cy="60" r="54"
                      fill="none"
                      stroke="rgba(255,255,255,0.05)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="60" cy="60" r="54"
                      fill="none"
                      stroke="url(#result-gradient)"
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-1000 ease-out"
                    />
                    <defs>
                      <linearGradient id="result-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor={result.score >= 60 ? '#22c55e' : '#ef4444'} />
                        <stop offset="100%" stopColor={result.score >= 60 ? '#06b6d4' : '#F97316'} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-bold ${getScoreColor(result.score)}`}>{result.score}</span>
                    <span className="text-xs text-elvora-text-dim">/100</span>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold bg-gradient-to-r ${getScoreGradient(result.score)} text-white mb-3`}>
                    {getScoreLabel(result.score)}
                  </div>
                  <p className="text-elvora-text-muted text-sm leading-relaxed">
                    {result.score < 40 ? (
                      <>Ihre Website hat <strong className="text-white">{result.problems.length + result.seoIssues.length} Probleme</strong>. Potenzielle Kunden springen mit hoher Wahrscheinlichkeit ab, bevor sie Sie kontaktieren.</>
                    ) : result.score < 60 ? (
                      <>Wir haben <strong className="text-white">{result.problems.length + result.seoIssues.length} Verbesserungspunkte</strong> gefunden. Ihre Website funktioniert grundsätzlich, verliert aber Kunden durch vermeidbare Probleme.</>
                    ) : result.score < 80 ? (
                      <>Ihre Website hat <strong className="text-white">{result.problems.length + result.seoIssues.length} Optimierungsmöglichkeiten</strong>. Mit gezielten Anpassungen können Sie deutlich mehr Anfragen generieren.</>
                    ) : (
                      <>Ihre Website ist in gutem Zustand! Es gibt noch <strong className="text-white">{result.problems.length + result.seoIssues.length} kleine Optimierungen</strong>, die Ihnen einen Vorteil verschaffen können.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {result.problems.filter(p => p.severity === 'critical').length}
                </div>
                <div className="text-xs text-elvora-text-dim mt-1">Kritisch</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-orange-400">
                  {result.problems.filter(p => p.severity === 'major').length}
                </div>
                <div className="text-xs text-elvora-text-dim mt-1">Wichtig</div>
              </div>
              <div className="glass rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-elvora-text-muted">
                  {result.seoIssues.length}
                </div>
                <div className="text-xs text-elvora-text-dim mt-1">SEO-Probleme</div>
              </div>
            </div>

            {/* Problems */}
            {result.problems.length > 0 && (
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
                  {result.problems.map((problem, i) => (
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
            {result.seoIssues.length > 0 && (
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
                  {result.seoIssues.map((issue, i) => (
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

            {/* CTA Section */}
            <div className="glass-strong rounded-2xl p-8 text-center border border-elvora-primary/20">
              <div className="w-14 h-14 rounded-full bg-elvora-gradient mx-auto mb-4 flex items-center justify-center">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">
                Lassen Sie uns das gemeinsam lösen
              </h2>
              <p className="text-sm text-elvora-text-muted mb-6 max-w-md mx-auto">
                In einem kostenlosen 15-Minuten-Gespräch zeige ich Ihnen, wie wir diese Probleme beheben und Ihre Website in eine Kundenmaschine verwandeln.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {/* WhatsApp Button */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Hallo, ich habe gerade den Website-Check für meine Firma gemacht und mein Score ist ${result.score}/100. Ich würde gerne über Verbesserungen sprechen.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#25D366] text-white font-semibold hover:bg-[#20BD5A] transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Per WhatsApp besprechen
                </a>

                {/* Calendly Button */}
                <button
                  onClick={() => setShowCalendly(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-elvora-gradient text-white font-semibold hover:shadow-elvora-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Kostenloses Erstgespräch buchen
                </button>
              </div>

              {showCalendly && (
                <div className="mt-6 rounded-xl overflow-hidden border border-white/10 animate-fade-in">
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
            </div>

            {/* Recheck */}
            <div className="text-center">
              <button
                onClick={() => { setState('idle'); setResult(null); }}
                className="text-sm text-elvora-text-dim hover:text-white transition-colors"
              >
                Andere Website prüfen
              </button>
            </div>

            {/* Trust */}
            <div className="text-center text-xs text-elvora-text-dim space-y-1 pb-8">
              <p>Dieser Check wurde automatisch erstellt und dient als kostenlose Erstanalyse.</p>
              <p>Alle Daten werden vertraulich behandelt.</p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
