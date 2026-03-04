'use client';

import { useState } from 'react';

interface SeoIssueDetail {
  id: string;
  label: string;
  severity: 'critical' | 'major' | 'minor' | 'info' | 'pass';
  description: string;
  recommendation?: string;
}

interface SeoCategory {
  name: string;
  score: number;
  maxScore: number;
  issues: SeoIssueDetail[];
}

interface SeoAuditResult {
  url: string;
  finalUrl: string;
  totalScore: number;
  categories: {
    metaTags: SeoCategory;
    headings: SeoCategory;
    links: SeoCategory;
    performance: SeoCategory;
    indexability: SeoCategory;
    schema: SeoCategory;
    security: SeoCategory;
    mobile: SeoCategory;
    content: SeoCategory;
  };
  summary: {
    critical: number;
    major: number;
    minor: number;
    passed: number;
  };
  analyzedAt: string;
  responseTimeMs: number;
}

interface RankingCompetitor {
  position: number;
  title: string;
  url: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
}

interface RankingResult {
  keyword: string;
  city: string;
  targetUrl: string;
  position: number | null;
  totalResults: number;
  competitors: RankingCompetitor[];
  mapsPackPositions: RankingCompetitor[];
  checkedAt: string;
}

const severityConfig = {
  critical: { label: 'Kritisch', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500', icon: '✕' },
  major: { label: 'Wichtig', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500', icon: '!' },
  minor: { label: 'Hinweis', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-500', icon: '~' },
  info: { label: 'Info', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500', icon: 'i' },
  pass: { label: 'OK', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-500', icon: '✓' },
};

function getScoreColor(score: number, max: number): string {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'text-emerald-400';
  if (pct >= 60) return 'text-yellow-400';
  if (pct >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-400';
  if (score >= 60) return 'stroke-yellow-400';
  if (score >= 40) return 'stroke-orange-400';
  return 'stroke-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'Sehr gut';
  if (score >= 60) return 'Befriedigend';
  if (score >= 40) return 'Mangelhaft';
  return 'Kritisch';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/30';
  if (score >= 60) return 'bg-yellow-500/10 border-yellow-500/30';
  if (score >= 40) return 'bg-orange-500/10 border-orange-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

export default function SeoToolPage() {
  // Audit state
  const [auditUrl, setAuditUrl] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [auditResult, setAuditResult] = useState<SeoAuditResult | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Ranking state
  const [rankKeyword, setRankKeyword] = useState('');
  const [rankCity, setRankCity] = useState('');
  const [rankWebsite, setRankWebsite] = useState('');
  const [rankLoading, setRankLoading] = useState(false);
  const [rankError, setRankError] = useState('');
  const [rankResult, setRankResult] = useState<RankingResult | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<'audit' | 'ranking'>('audit');

  async function handleAudit() {
    if (!auditUrl.trim()) return;
    setAuditLoading(true);
    setAuditError('');
    setAuditResult(null);
    setExpandedCategories(new Set());

    try {
      const res = await fetch('/api/seo/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: auditUrl.trim() }),
      });

      const result = await res.json();

      if (!res.ok) {
        setAuditError(result.error || 'Fehler beim SEO-Audit');
        return;
      }

      setAuditResult(result.audit);

      // Auto-expand categories with critical issues
      const toExpand = new Set<string>();
      const cats = result.audit.categories;
      for (const [key, cat] of Object.entries(cats) as [string, SeoCategory][]) {
        if (cat.issues.some((i: SeoIssueDetail) => i.severity === 'critical' || i.severity === 'major')) {
          toExpand.add(key);
        }
      }
      setExpandedCategories(toExpand);

      // Auto-fill ranking check URL
      if (!rankWebsite) {
        setRankWebsite(auditUrl.trim());
      }
    } catch {
      setAuditError('Netzwerkfehler – bitte erneut versuchen');
    } finally {
      setAuditLoading(false);
    }
  }

  async function handleRankingCheck() {
    if (!rankKeyword.trim() || !rankCity.trim() || !rankWebsite.trim()) return;
    setRankLoading(true);
    setRankError('');
    setRankResult(null);

    try {
      const res = await fetch('/api/seo/ranking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: rankKeyword.trim(),
          city: rankCity.trim(),
          website: rankWebsite.trim(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        setRankError(result.error || 'Fehler beim Ranking-Check');
        return;
      }

      setRankResult(result.ranking);
    } catch {
      setRankError('Netzwerkfehler – bitte erneut versuchen');
    } finally {
      setRankLoading(false);
    }
  }

  function toggleCategory(key: string) {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className="min-h-screen p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">SEO-Tool</h1>
        <p className="text-sm text-elvora-text-dim">Technisches SEO-Audit & Local Ranking Check</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 glass rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'audit'
              ? 'bg-elvora-primary/20 text-elvora-primary'
              : 'text-elvora-text-dim hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 inline-block mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          SEO-Audit
        </button>
        <button
          onClick={() => setActiveTab('ranking')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
            activeTab === 'ranking'
              ? 'bg-elvora-primary/20 text-elvora-primary'
              : 'text-elvora-text-dim hover:text-white'
          }`}
        >
          <svg className="w-4 h-4 inline-block mr-1.5 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          Ranking-Check
        </button>
      </div>

      {/* ═══ SEO AUDIT TAB ═══ */}
      {activeTab === 'audit' && (
        <div>
          {/* URL Input */}
          <div className="glass rounded-xl p-4 mb-5">
            <label className="block text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-2">
              Website-URL eingeben
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={auditUrl}
                onChange={e => setAuditUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAudit()}
                placeholder="z.B. mueller-sanitaer.de"
                className="flex-1 bg-elvora-darker border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white placeholder-elvora-text-dim focus:outline-none focus:border-elvora-primary/50"
              />
              <button
                onClick={handleAudit}
                disabled={auditLoading || !auditUrl.trim()}
                className="px-5 py-2.5 bg-elvora-primary text-white rounded-lg text-sm font-semibold hover:bg-elvora-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                {auditLoading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Analysiere...
                  </>
                ) : (
                  'Audit starten'
                )}
              </button>
            </div>
            {auditError && (
              <p className="mt-2 text-sm text-red-400">{auditError}</p>
            )}
          </div>

          {/* Results */}
          {auditResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* Score Overview */}
              <div className={`glass rounded-xl p-5 border ${getScoreBgColor(auditResult.totalScore)}`}>
                <div className="flex items-center gap-6">
                  {/* Score Ring */}
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-white/5" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        strokeWidth="6" strokeLinecap="round"
                        strokeDasharray={`${auditResult.totalScore * 2.64} 264`}
                        className={getScoreRingColor(auditResult.totalScore)}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold ${getScoreColor(auditResult.totalScore, 100)}`}>
                        {auditResult.totalScore}
                      </span>
                      <span className="text-[10px] text-elvora-text-dim">/100</span>
                    </div>
                  </div>

                  {/* Score Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-white">{getScoreLabel(auditResult.totalScore)}</h2>
                    </div>
                    <p className="text-xs text-elvora-text-dim mb-3 truncate">
                      {auditResult.finalUrl}
                    </p>
                    <div className="flex gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-red-400">{auditResult.summary.critical} Kritisch</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        <span className="text-orange-400">{auditResult.summary.major} Wichtig</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        <span className="text-yellow-400">{auditResult.summary.minor} Hinweise</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-emerald-400">{auditResult.summary.passed} OK</span>
                      </span>
                    </div>
                  </div>

                  {/* Response time */}
                  <div className="text-right text-xs text-elvora-text-dim flex-shrink-0">
                    <div>{(auditResult.responseTimeMs / 1000).toFixed(1)}s Ladezeit</div>
                    <div className="mt-1 text-[10px]">
                      {new Date(auditResult.analyzedAt).toLocaleString('de-DE')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Category Score Bars */}
              <div className="glass rounded-xl p-4">
                <h3 className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">Kategorie-Übersicht</h3>
                <div className="space-y-2">
                  {(Object.entries(auditResult.categories) as [string, SeoCategory][]).map(([key, cat]) => (
                    <button
                      key={key}
                      onClick={() => toggleCategory(key)}
                      className="w-full flex items-center gap-3 group hover:bg-white/[0.02] rounded-lg p-1.5 transition-colors"
                    >
                      <span className="text-xs text-elvora-text-dim w-32 text-left truncate">{cat.name}</span>
                      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            cat.score / cat.maxScore >= 0.8 ? 'bg-emerald-500' :
                            cat.score / cat.maxScore >= 0.6 ? 'bg-yellow-500' :
                            cat.score / cat.maxScore >= 0.4 ? 'bg-orange-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(cat.score / cat.maxScore) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono font-bold w-12 text-right ${getScoreColor(cat.score, cat.maxScore)}`}>
                        {cat.score}/{cat.maxScore}
                      </span>
                      <svg
                        className={`w-3.5 h-3.5 text-elvora-text-dim transition-transform ${expandedCategories.has(key) ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Expanded Category Details */}
              {(Object.entries(auditResult.categories) as [string, SeoCategory][])
                .filter(([key]) => expandedCategories.has(key))
                .map(([key, cat]) => (
                  <div key={key} className="glass rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
                      <span className={`text-xs font-mono font-bold ${getScoreColor(cat.score, cat.maxScore)}`}>
                        {cat.score}/{cat.maxScore} Punkte
                      </span>
                    </div>
                    <div className="space-y-2">
                      {cat.issues.map((issue, idx) => {
                        const config = severityConfig[issue.severity];
                        return (
                          <div key={idx} className={`rounded-lg border p-3 ${config.bg}`}>
                            <div className="flex items-start gap-2">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${config.dot} text-white`}>
                                {config.icon}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-sm font-medium ${config.color}`}>{issue.label}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${config.bg} ${config.color}`}>
                                    {config.label}
                                  </span>
                                </div>
                                <p className="text-xs text-elvora-text-dim">{issue.description}</p>
                                {issue.recommendation && (
                                  <p className="text-xs text-elvora-primary mt-1 flex items-start gap-1">
                                    <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                    {issue.recommendation}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ RANKING CHECK TAB ═══ */}
      {activeTab === 'ranking' && (
        <div>
          {/* Input */}
          <div className="glass rounded-xl p-4 mb-5">
            <label className="block text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">
              Local Ranking prüfen
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-elvora-text-dim mb-1">Keyword</label>
                <input
                  type="text"
                  value={rankKeyword}
                  onChange={e => setRankKeyword(e.target.value)}
                  placeholder="z.B. Sanitär"
                  className="w-full bg-elvora-darker border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white placeholder-elvora-text-dim focus:outline-none focus:border-elvora-primary/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-elvora-text-dim mb-1">Stadt</label>
                <input
                  type="text"
                  value={rankCity}
                  onChange={e => setRankCity(e.target.value)}
                  placeholder="z.B. Essen"
                  className="w-full bg-elvora-darker border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white placeholder-elvora-text-dim focus:outline-none focus:border-elvora-primary/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-elvora-text-dim mb-1">Website des Leads</label>
                <input
                  type="text"
                  value={rankWebsite}
                  onChange={e => setRankWebsite(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleRankingCheck()}
                  placeholder="z.B. mueller-sanitaer.de"
                  className="w-full bg-elvora-darker border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white placeholder-elvora-text-dim focus:outline-none focus:border-elvora-primary/50"
                />
              </div>
            </div>
            <button
              onClick={handleRankingCheck}
              disabled={rankLoading || !rankKeyword.trim() || !rankCity.trim() || !rankWebsite.trim()}
              className="px-5 py-2.5 bg-elvora-primary text-white rounded-lg text-sm font-semibold hover:bg-elvora-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {rankLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Prüfe Rankings...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Ranking prüfen
                </>
              )}
            </button>
            {rankError && (
              <p className="mt-2 text-sm text-red-400">{rankError}</p>
            )}
          </div>

          {/* Ranking Results */}
          {rankResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* Position Card */}
              <div className={`glass rounded-xl p-5 border ${
                rankResult.position === null
                  ? 'border-red-500/30 bg-red-500/5'
                  : rankResult.position <= 3
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : rankResult.position <= 10
                      ? 'border-yellow-500/30 bg-yellow-500/5'
                      : 'border-orange-500/30 bg-orange-500/5'
              }`}>
                <div className="flex items-center gap-5">
                  <div className="text-center flex-shrink-0">
                    {rankResult.position === null ? (
                      <div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                    ) : (
                      <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center ${
                        rankResult.position <= 3 ? 'bg-emerald-500/10 border-emerald-500/30' :
                        rankResult.position <= 10 ? 'bg-yellow-500/10 border-yellow-500/30' :
                        'bg-orange-500/10 border-orange-500/30'
                      }`}>
                        <span className={`text-3xl font-bold ${
                          rankResult.position <= 3 ? 'text-emerald-400' :
                          rankResult.position <= 10 ? 'text-yellow-400' :
                          'text-orange-400'
                        }`}>
                          #{rankResult.position}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white mb-1">
                      {rankResult.position === null
                        ? 'Nicht gefunden auf Seite 1'
                        : `Position ${rankResult.position} bei Google`
                      }
                    </h2>
                    <p className="text-sm text-elvora-text-dim">
                      Suchbegriff: <span className="text-white font-medium">&quot;{rankResult.keyword} {rankResult.city}&quot;</span>
                    </p>
                    {rankResult.position === null && (
                      <p className="text-xs text-red-400 mt-1">
                        Die Website taucht in den ersten {rankResult.totalResults} Ergebnissen nicht auf — großes SEO-Potenzial!
                      </p>
                    )}
                    {rankResult.position !== null && rankResult.position > 3 && (
                      <p className="text-xs text-yellow-400 mt-1">
                        Nur die Top 3 bekommen den Großteil der Klicks — hier ist noch Luft nach oben
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Maps Pack */}
              {rankResult.mapsPackPositions.length > 0 && (
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-elvora-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Google Maps Pack (Top 3 lokal)
                  </h3>
                  <div className="space-y-2">
                    {rankResult.mapsPackPositions.map((mp, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                        <span className="w-6 h-6 rounded-full bg-elvora-primary/20 text-elvora-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {mp.position}
                        </span>
                        <span className="text-sm text-white font-medium flex-1 truncate">{mp.title}</span>
                        {mp.rating && (
                          <span className="text-xs text-yellow-400 flex items-center gap-0.5 flex-shrink-0">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            {mp.rating}
                            {mp.reviewCount && <span className="text-elvora-text-dim">({mp.reviewCount})</span>}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Organic Competitors */}
              {rankResult.competitors.length > 0 && (
                <div className="glass rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-elvora-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Top {rankResult.competitors.length} organische Ergebnisse
                  </h3>
                  <div className="space-y-1.5">
                    {rankResult.competitors.map((comp, idx) => {
                      const isTarget = rankResult.position === comp.position;
                      return (
                        <div
                          key={idx}
                          className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                            isTarget
                              ? 'bg-elvora-primary/10 border border-elvora-primary/20'
                              : 'bg-white/[0.02] hover:bg-white/[0.04]'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            comp.position <= 3
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-white/5 text-elvora-text-dim'
                          }`}>
                            {comp.position}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${isTarget ? 'text-elvora-primary' : 'text-white'}`}>
                                {comp.title}
                              </span>
                              {isTarget && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-elvora-primary/20 text-elvora-primary font-bold flex-shrink-0">
                                  LEAD
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-elvora-text-dim truncate block">
                              {comp.url.replace(/^https?:\/\/(www\.)?/, '').split('/').slice(0, 2).join('/')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No results hint */}
              {rankResult.competitors.length === 0 && (
                <div className="glass rounded-xl p-5 text-center">
                  <svg className="w-10 h-10 mx-auto text-elvora-text-dim mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-elvora-text-dim">
                    Keine organischen Ergebnisse gefunden. Google blockiert möglicherweise die Anfrage.
                  </p>
                  <p className="text-xs text-elvora-text-dim mt-1">
                    Tipp: Versuche es in ein paar Minuten erneut oder variiere den Suchbegriff.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
