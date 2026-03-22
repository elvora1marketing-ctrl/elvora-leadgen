'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface LinkedInResult {
  name: string;
  company: string;
  title: string;
  email: string | null;
  location: string;
  profileUrl: string;
}

interface LiveProgress {
  type: string;
  keyword?: string;
  profileName?: string;
  profileCompany?: string;
  profileEmail?: string | null;
  hasEmail?: boolean;
  importStatus?: string;
  currentProfile?: number;
  totalProfiles?: number;
  currentKeyword?: number;
  totalKeywords?: number;
  profilesFound?: number;
  totalFound?: number;
  totalImported?: number;
  totalDuplicates?: number;
  totalNoEmail?: number;
  totalSkipped?: number;
  searchFound?: number;
  searchImported?: number;
  searchDuplicates?: number;
  searchNoEmail?: number;
  searchDuration?: number;
  duration?: number;
  error?: string;
  errors?: string[];
  jobId?: number;
}

interface CompletedSearch {
  keyword: string;
  found: number;
  imported: number;
  duplicates: number;
  noEmail: number;
  duration: number;
}

interface ScraperJob {
  id: number;
  keyword: string;
  status: string;
  businesses_found: number;
  businesses_imported: number;
  businesses_duplicate: number;
  errors: string;
  results: string;
  started_at: string;
  completed_at: string | null;
}

export default function LinkedInScraperPage() {
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('Deutschland');
  const [maxResults, setMaxResults] = useState(25);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [jobResults, setJobResults] = useState<LinkedInResult[]>([]);

  // Live progress
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [completedSearches, setCompletedSearches] = useState<CompletedSearch[]>([]);
  const [finalResult, setFinalResult] = useState<LiveProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const presets = [
    'Bauleiter',
    'Projektmanager Bau',
    'Architekt',
    'Bauingenieur',
    'Geschäftsführer SHK',
    'Facility Manager',
    'Immobilienverwalter',
    'Hausverwalter',
  ];

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/linkedin');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const startScraping = async () => {
    if (!keyword.trim()) return;

    setScraping(true);
    setFinalResult(null);
    setError(null);
    setLiveProgress(null);
    setCompletedSearches([]);

    const keywords = keyword
      .split(/[,\n]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch('/api/scraper/linkedin/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          location: location.trim(),
          maxResults,
          onlyWithEmail,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Scraping fehlgeschlagen');
        setScraping(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError('Stream nicht verfügbar');
        setScraping(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)) as LiveProgress;

              if (data.type === 'search_complete') {
                setCompletedSearches(prev => [...prev, {
                  keyword: data.keyword || '',
                  found: data.searchFound || 0,
                  imported: data.searchImported || 0,
                  duplicates: data.searchDuplicates || 0,
                  noEmail: data.searchNoEmail || 0,
                  duration: data.searchDuration || 0,
                }]);
              }

              if (data.type === 'batch_complete') {
                setFinalResult(data);
                setScraping(false);
              }

              setLiveProgress(data);
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // User cancelled
      } else {
        setError('Netzwerkfehler - Server nicht erreichbar');
      }
    } finally {
      setScraping(false);
      abortRef.current = null;
      loadJobs();
    }
  };

  const cancelScraping = () => {
    abortRef.current?.abort();
    setScraping(false);
  };

  const viewJobResults = async (jobId: number) => {
    try {
      const res = await fetch(`/api/scraper/linkedin?jobId=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedJob(jobId);
        setJobResults(data.results ? JSON.parse(data.results) : []);
      }
    } catch { /* silent */ }
  };

  const exportCsv = (results: LinkedInResult[]) => {
    const headers = ['Name', 'Position', 'Firma', 'E-Mail', 'Standort', 'LinkedIn URL'];
    const rows = results.map(r => [
      r.name,
      r.title || '',
      r.company || '',
      r.email || '',
      r.location || '',
      r.profileUrl || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const keywordCount = keyword.split(/[,\n]+/).filter(k => k.trim().length > 0).length;
  const showingResults = jobResults.length > 0;

  // Calculate overall progress
  const overallProgress = liveProgress
    ? (() => {
        const kw = liveProgress.currentKeyword || 0;
        const totalKw = liveProgress.totalKeywords || 1;
        const prof = liveProgress.currentProfile || 0;
        const totalProf = liveProgress.totalProfiles || 1;
        // Weight: each keyword is equal, profiles within each keyword
        return ((kw - 1) / totalKw + (prof / totalProf) / totalKw) * 100;
      })()
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">LinkedIn Scraper</h1>
          <p className="text-xs sm:text-sm text-elvora-text-dim mt-1">
            Personen auf LinkedIn finden – Name, Firma und E-Mail extrahieren
          </p>
        </div>
        {showingResults && (
          <button
            onClick={() => exportCsv(jobResults)}
            className="px-4 py-2 rounded-xl bg-elvora-success/20 text-elvora-success hover:bg-elvora-success/30 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV Export
          </button>
        )}
      </div>

      {/* Search Form */}
      <div className="card-glass p-6 space-y-5">
        {/* Keyword Input */}
        <div>
          <label className="block text-sm font-medium text-elvora-text-muted mb-2">
            Suchbegriffe <span className="text-elvora-text-dim font-normal">(mehrere mit Komma trennen)</span>
          </label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="z.B. Bauleiter, Projektmanager Bau, Architekt..."
            className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && !scraping && startScraping()}
          />
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-xs font-medium text-elvora-text-dim mb-2">
            Schnellauswahl
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map(preset => (
              <button
                key={preset}
                onClick={() => {
                  const current = keyword.split(/,/).map(k => k.trim()).filter(Boolean);
                  if (current.includes(preset)) {
                    setKeyword(current.filter(k => k !== preset).join(', '));
                  } else {
                    setKeyword(current.length > 0 ? `${keyword}, ${preset}` : preset);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  keyword.includes(preset)
                    ? 'bg-blue-500/30 text-blue-400 border border-blue-500/40'
                    : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Location Input */}
        <div>
          <label className="block text-sm font-medium text-elvora-text-muted mb-2">
            Standort / Region
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="z.B. Deutschland, NRW, Nordrhein-Westfalen..."
            className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* Max Results Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-elvora-text-muted">
              Max. Profile pro Keyword
            </label>
            <span className="text-sm font-bold text-white">
              {maxResults} Profile
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={50}
            step={5}
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-[10px] text-elvora-text-dim mt-1">
            <span>5</span>
            <span>25</span>
            <span>50</span>
          </div>
        </div>

        {/* Only with Email Toggle */}
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-4 border border-white/5">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Nur mit E-Mail</span>
            </div>
            <p className="text-xs text-elvora-text-dim mt-1">
              Nur Profile importieren, bei denen eine E-Mail-Adresse gefunden wurde.
            </p>
          </div>
          <button
            onClick={() => setOnlyWithEmail(!onlyWithEmail)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
              onlyWithEmail ? 'bg-blue-500' : 'bg-white/10'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                onlyWithEmail ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Search Info */}
        {keyword.trim() && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-elvora-text-muted">
                <span className="text-white font-semibold">{keywordCount}</span> Keyword{keywordCount !== 1 ? 's' : ''}
                {' × '}bis zu <span className="text-white font-semibold">{maxResults}</span> Profile
                {' = '}max. <span className="text-white font-semibold">{keywordCount * maxResults}</span> Ergebnisse
                {location && <span className="text-elvora-text-dim"> in {location}</span>}
              </span>
            </div>
          </div>
        )}

        {/* API Cost Warning */}
        {keywordCount * maxResults > 50 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span className="text-amber-300 text-xs">
                Viele API-Anfragen! Jedes Profil verbraucht einen API-Call. Prüfe dein RapidAPI-Kontingent.
              </span>
            </div>
          </div>
        )}

        {/* Start / Cancel Button */}
        {!scraping ? (
          <button
            onClick={startScraping}
            disabled={!keyword.trim()}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 ${
              keyword.trim()
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-lg hover:shadow-blue-500/20 hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-white/5 text-elvora-text-dim cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
            LinkedIn Scraping starten
          </button>
        ) : (
          <button
            onClick={cancelScraping}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Scraping abbrechen
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="card-glass border border-red-500/20 bg-red-500/5 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="text-red-300 text-sm">{error}</span>
              {error.toLowerCase().includes('rapidapi') && (
                <a href="/settings" className="block text-blue-400 text-xs mt-1 hover:underline">
                  Jetzt in den Einstellungen hinterlegen &rarr;
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Progress */}
      {scraping && liveProgress && (
        <div className="card-glass p-5 space-y-4 border border-blue-500/20">
          {/* Overall Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
                Live Scraping
              </span>
              <span className="text-xs text-elvora-text-dim">
                Keyword {liveProgress.currentKeyword || 0} / {liveProgress.totalKeywords || 0}
                {liveProgress.currentProfile && liveProgress.totalProfiles && (
                  <> &middot; Profil {liveProgress.currentProfile}/{liveProgress.totalProfiles}</>
                )}
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(overallProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Current Profile */}
          {liveProgress.profileName && liveProgress.type !== 'batch_complete' && (
            <div className="bg-white/[0.03] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <div className="truncate mr-4">
                  <span className="text-sm text-white font-medium">{liveProgress.profileName}</span>
                  {liveProgress.profileCompany && (
                    <span className="text-xs text-elvora-text-dim ml-2">@ {liveProgress.profileCompany}</span>
                  )}
                </div>
                {liveProgress.hasEmail !== undefined && (
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                    liveProgress.hasEmail
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-white/5 text-elvora-text-dim'
                  }`}>
                    {liveProgress.hasEmail ? 'E-Mail gefunden' : 'Keine E-Mail'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Live Counters */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-xl font-bold text-white tabular-nums">{liveProgress.totalFound || 0}</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">Gefunden</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-elvora-success tabular-nums">{liveProgress.totalImported || 0}</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">Importiert</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-elvora-warning tabular-nums">{liveProgress.totalDuplicates || 0}</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">Duplikate</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-elvora-text-muted tabular-nums">{liveProgress.totalNoEmail || 0}</div>
              <div className="text-[10px] text-elvora-text-dim mt-0.5">Ohne E-Mail</div>
            </div>
          </div>

          {/* Completed Searches Log */}
          {completedSearches.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {completedSearches.map((search, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 bg-white/[0.02] rounded-lg text-xs">
                  <span className="text-elvora-text-muted truncate mr-3 flex items-center gap-2">
                    <svg className="w-3 h-3 text-elvora-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    {search.keyword}
                  </span>
                  <span className="text-elvora-text-dim whitespace-nowrap">
                    {search.found} gefunden, {search.imported} neu, {search.noEmail} ohne E-Mail
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Final Results Summary */}
      {finalResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-white">{finalResult.totalFound || 0}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Gefunden</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-elvora-success">{finalResult.totalImported || 0}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Importiert</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-elvora-warning">{finalResult.totalDuplicates || 0}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Duplikate</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-elvora-text-muted">{finalResult.totalNoEmail || 0}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Ohne E-Mail</div>
            </div>
            <div className="card-glass p-4 text-center">
              <div className="text-2xl font-bold text-elvora-text-muted">{((finalResult.duration || 0) / 1000).toFixed(1)}s</div>
              <div className="text-xs text-elvora-text-dim mt-1">Dauer</div>
            </div>
          </div>

          {/* Search Breakdown */}
          {completedSearches.length > 0 && (
            <div className="card-glass overflow-hidden">
              <div className="p-4 border-b border-white/5">
                <h2 className="text-sm font-semibold text-white">Ergebnisse pro Keyword</h2>
              </div>
              <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                {completedSearches.map((search, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-white font-medium">{search.keyword}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-elvora-text-muted">{search.found} gefunden</span>
                      <span className="text-elvora-success">{search.imported} neu</span>
                      {search.noEmail > 0 && (
                        <span className="text-elvora-text-dim">{search.noEmail} ohne E-Mail</span>
                      )}
                      <span className="text-elvora-text-dim">{(search.duration / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {finalResult.errors && finalResult.errors.length > 0 && (
            <div className="card-glass border border-elvora-warning/20 bg-elvora-warning/5 p-4 rounded-xl">
              <h3 className="text-sm font-semibold text-elvora-warning mb-2">Hinweise</h3>
              <ul className="space-y-1 max-h-32 overflow-y-auto">
                {finalResult.errors.map((err, i) => (
                  <li key={i} className="text-xs text-elvora-text-dim flex items-start gap-2">
                    <span className="text-elvora-warning mt-0.5">!</span>
                    {err}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Job Results Table */}
      {showingResults && (
        <div className="card-glass overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              {jobResults.length} Personen gefunden
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportCsv(jobResults)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                CSV Export
              </button>
              <button
                onClick={() => { setSelectedJob(null); setJobResults([]); }}
                className="text-xs text-elvora-text-dim hover:text-white transition-colors"
              >
                Schliessen
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Position</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Firma</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">E-Mail</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Standort</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">LinkedIn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobResults.map((person, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-elvora-text-dim text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{person.name}</span>
                    </td>
                    <td className="px-4 py-3 text-elvora-text-muted text-xs max-w-[200px] truncate">
                      {person.title || '-'}
                    </td>
                    <td className="px-4 py-3 text-elvora-text-muted text-xs">
                      {person.company || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {person.email ? (
                        <a href={`mailto:${person.email}`} className="text-blue-400 hover:underline text-xs">
                          {person.email}
                        </a>
                      ) : (
                        <span className="text-elvora-text-dim text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-elvora-text-muted text-xs">{person.location || '-'}</td>
                    <td className="px-4 py-3">
                      {person.profileUrl ? (
                        <a
                          href={person.profileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline text-xs"
                        >
                          Profil
                        </a>
                      ) : (
                        <span className="text-elvora-text-dim text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Job History */}
      {jobs.length > 0 && (
        <div className="card-glass overflow-hidden">
          <div className="p-4 border-b border-white/5">
            <h2 className="text-sm font-semibold text-white">Letzte LinkedIn-Scraping-Jobs</h2>
          </div>
          <div className="divide-y divide-white/5">
            {jobs.map((job) => {
              const jobErrors = job.errors ? JSON.parse(job.errors) : [];
              return (
                <div
                  key={job.id}
                  className="px-3 sm:px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer gap-2"
                  onClick={() => viewJobResults(job.id)}
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      job.status === 'completed' ? 'bg-elvora-success' :
                      job.status === 'running' ? 'bg-blue-500 animate-pulse' :
                      'bg-red-500'
                    }`} />
                    <div className="min-w-0">
                      <span className="text-white text-sm font-medium truncate block">{job.keyword}</span>
                      <span className="text-elvora-text-dim text-[10px] sm:text-xs">
                        {new Date(job.started_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-4 text-xs flex-shrink-0">
                    <span className="text-elvora-text-muted">
                      {job.businesses_found} gefunden
                    </span>
                    <span className="text-elvora-success">
                      {job.businesses_imported} neu
                    </span>
                    {job.businesses_duplicate > 0 && (
                      <span className="text-elvora-warning">
                        {job.businesses_duplicate} doppelt
                      </span>
                    )}
                    {jobErrors.length > 0 && (
                      <span className="text-red-400">
                        {jobErrors.length} Fehler
                      </span>
                    )}
                    <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
