'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { STADTTEILE, countStadtteile } from '@/lib/stadtteile';
import { countCitiesInRadius } from '@/lib/umkreis';

interface ScrapedBusiness {
  name: string;
  address: string;
  city: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  category: string | null;
}

interface ScraperJob {
  id: number;
  keyword: string;
  max_pages: number;
  status: string;
  businesses_found: number;
  businesses_imported: number;
  businesses_duplicate: number;
  errors: string;
  started_at: string;
  completed_at: string | null;
}

interface LiveProgress {
  type: string;
  keyword?: string;
  currentSearch?: number;
  totalSearches?: number;
  currentPage?: number;
  totalPages?: number;
  pageResults?: number;
  totalFound?: number;
  totalImported?: number;
  totalDuplicates?: number;
  searchFound?: number;
  searchImported?: number;
  searchDuplicates?: number;
  searchPages?: number;
  searchDuration?: number;
  duration?: number;
  totalSkipped?: number;
  totalPages2?: number;
  error?: string;
  errors?: string[];
  jobId?: number;
}

interface CompletedSearch {
  keyword: string;
  found: number;
  imported: number;
  duplicates: number;
  pages: number;
  duration: number;
}

export default function ScraperPage() {
  const [keyword, setKeyword] = useState('');
  const [maxPages, setMaxPages] = useState(3);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [jobResults, setJobResults] = useState<ScrapedBusiness[]>([]);

  // Multi-city selection
  const [selectedCities, setSelectedCities] = useState<string[]>(['Essen']);

  // Tiefenscan (deep scan) mode
  const [deepScan, setDeepScan] = useState(false);

  // Umkreissuche (radius search)
  const [radiusSearch, setRadiusSearch] = useState(false);
  const [radiusKm, setRadiusKm] = useState(15);

  // Live progress state
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [completedSearches, setCompletedSearches] = useState<CompletedSearch[]>([]);
  const [finalResult, setFinalResult] = useState<LiveProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Quick presets for common searches
  const presets = [
    'Heizungsinstallateur',
    'Sanitär',
    'Klempner',
    'SHK Betrieb',
    'Badezimmer Renovierung',
    'Gasheizung Installation',
    'Rohrreinigung',
    'Solaranlage Installation',
  ];

  const cities = [
    'Essen', 'Dortmund', 'Bochum', 'Duisburg', 'Düsseldorf',
    'Köln', 'Gelsenkirchen', 'Oberhausen', 'Mülheim', 'Herne',
  ];

  const toggleCity = (city: string) => {
    setSelectedCities(prev =>
      prev.includes(city)
        ? prev.filter(c => c !== city)
        : [...prev, city]
    );
  };

  const selectAllCities = () => {
    setSelectedCities(prev =>
      prev.length === cities.length ? [] : [...cities]
    );
  };

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/maps');
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
    if (!keyword.trim() || selectedCities.length === 0) return;

    setScraping(true);
    setFinalResult(null);
    setError(null);
    setLiveProgress(null);
    setCompletedSearches([]);

    // Parse multiple keywords (comma or newline separated)
    const keywords = keyword
      .split(/[,\n]+/)
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch('/api/scraper/maps/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          cities: selectedCities,
          maxPages,
          deepScan,
          radiusSearch,
          radiusKm: radiusSearch ? radiusKm : 0,
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

        // Process all complete SSE messages in buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
                  pages: data.searchPages || 0,
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
      const res = await fetch(`/api/scraper/maps?jobId=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedJob(jobId);
        setJobResults(data.results ? JSON.parse(data.results) : []);
      }
    } catch { /* silent */ }
  };

  const exportCsv = (businesses: ScrapedBusiness[]) => {
    const headers = ['Firma', 'Adresse', 'Stadt', 'Telefon', 'Website', 'Bewertung', 'Kategorie'];
    const rows = businesses.map(b => [
      b.name,
      b.address,
      b.city,
      b.phone || '',
      b.website || '',
      b.rating?.toString() || '',
      b.category || '',
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const keywordCount = keyword.split(/[,\n]+/).filter(k => k.trim().length > 0).length;
  const effectiveCityCount = radiusSearch ? countCitiesInRadius(selectedCities, radiusKm) : selectedCities.length;
  const cityOrDistrictCount = deepScan ? countStadtteile(selectedCities) : effectiveCityCount;
  const totalSearches = keywordCount * cityOrDistrictCount;
  const showingResults = jobResults.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Google Maps Scraper</h1>
          <p className="text-xs sm:text-sm text-elvora-text-dim mt-1">
            Firmen aus Google Maps finden und importieren
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
            placeholder="z.B. Heizungsinstallateur, Sanitär, Klempner..."
            className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 focus:border-elvora-primary/50 transition-all"
            onKeyDown={(e) => e.key === 'Enter' && !scraping && startScraping()}
          />
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-xs font-medium text-elvora-text-dim mb-2">
            Schnellauswahl Keywords
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
                    ? 'bg-elvora-primary/30 text-elvora-primary border border-elvora-primary/40'
                    : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* City Selection - Multi-select */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-elvora-text-muted">
              Städte <span className="text-elvora-text-dim font-normal">({selectedCities.length} ausgewählt)</span>
            </label>
            <button
              onClick={selectAllCities}
              className="text-xs text-elvora-primary hover:text-elvora-primary/80 transition-colors"
            >
              {selectedCities.length === cities.length ? 'Keine' : 'Alle'} auswählen
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cities.map(city => (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedCities.includes(city)
                    ? 'bg-elvora-accent/30 text-elvora-accent border border-elvora-accent/40'
                    : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Pages Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-elvora-text-muted">
              Seiten pro Suche
            </label>
            <span className="text-sm font-bold text-white">
              {maxPages} {maxPages === 1 ? 'Seite' : 'Seiten'} <span className="text-elvora-text-dim font-normal">(~{maxPages * 20} pro Suche)</span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-elvora-primary"
          />
          <div className="flex justify-between text-[10px] text-elvora-text-dim mt-1">
            <span>~20 Ergebnisse</span>
            <span>~40 Ergebnisse</span>
            <span>~60 Ergebnisse</span>
          </div>
        </div>

        {/* Tiefenscan Toggle */}
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-4 border border-white/5">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">Tiefenscan</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-elvora-accent/20 text-elvora-accent uppercase tracking-wider">Mehr Ergebnisse</span>
            </div>
            <p className="text-xs text-elvora-text-dim mt-1">
              Durchsucht jeden Stadtteil einzeln statt nur die ganze Stadt. Liefert deutlich mehr Firmen, dauert aber länger.
            </p>
          </div>
          <button
            onClick={() => setDeepScan(!deepScan)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
              deepScan ? 'bg-elvora-accent' : 'bg-white/10'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                deepScan ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Umkreissuche Toggle */}
        <div className="flex flex-col gap-3 bg-white/[0.03] rounded-xl p-4 border border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Umkreissuche</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-elvora-primary/20 text-elvora-primary uppercase tracking-wider">Nachbarstädte</span>
              </div>
              <p className="text-xs text-elvora-text-dim mt-1">
                Durchsucht auch Nachbarstädte im gewählten Umkreis der ausgewählten Städte.
              </p>
            </div>
            <button
              onClick={() => setRadiusSearch(!radiusSearch)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
                radiusSearch ? 'bg-elvora-primary' : 'bg-white/10'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                  radiusSearch ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Radius Slider - only visible when enabled */}
          {radiusSearch && (
            <div className="pt-2 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-elvora-text-muted">
                  Radius
                </label>
                <span className="text-sm font-bold text-white">
                  {radiusKm} km
                  <span className="text-elvora-text-dim font-normal ml-1">
                    ({countCitiesInRadius(selectedCities, radiusKm)} Städte gesamt)
                  </span>
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={50}
                step={5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-elvora-primary"
              />
              <div className="flex justify-between text-[10px] text-elvora-text-dim mt-1">
                <span>5 km</span>
                <span>25 km</span>
                <span>50 km</span>
              </div>
            </div>
          )}
        </div>

        {/* Search Info */}
        {keyword.trim() && selectedCities.length > 0 && (
          <div className="bg-elvora-primary/5 border border-elvora-primary/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-elvora-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-elvora-text-muted">
                <span className="text-white font-semibold">{totalSearches}</span> Suchanfragen
                <span className="text-elvora-text-dim"> ({keywordCount} Keywords × {deepScan ? `${cityOrDistrictCount} Stadtteile` : `${effectiveCityCount} Städte`}{radiusSearch && !deepScan ? ` (${radiusKm}km Umkreis)` : ''} × {maxPages} Seiten)</span>
                {' = '}bis zu <span className="text-white font-semibold">{totalSearches * maxPages * 20}</span> Ergebnisse
                {deepScan && <span className="text-elvora-accent ml-1 font-medium">(Tiefenscan)</span>}
                {radiusSearch && !deepScan && <span className="text-elvora-primary ml-1 font-medium">(Umkreis)</span>}
              </span>
            </div>
          </div>
        )}

        {/* Start / Cancel Button */}
        {!scraping ? (
          <button
            onClick={startScraping}
            disabled={!keyword.trim() || selectedCities.length === 0}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 ${
              keyword.trim() && selectedCities.length > 0
                ? 'bg-elvora-gradient text-white hover:shadow-elvora hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-white/5 text-elvora-text-dim cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Batch-Scraping starten ({totalSearches} Suchanfragen)
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
              {error.toLowerCase().includes('api-key') && (
                <a href="/settings" className="block text-elvora-primary text-xs mt-1 hover:underline">
                  Jetzt in den Einstellungen hinterlegen &rarr;
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Progress Ticker */}
      {scraping && liveProgress && (
        <div className="card-glass p-5 space-y-4 border border-elvora-primary/20">
          {/* Overall Progress Bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-elvora-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-elvora-primary"></span>
                </span>
                Live Scraping
              </span>
              <span className="text-xs text-elvora-text-dim">
                {liveProgress.currentSearch || 0} / {liveProgress.totalSearches || 0} Suchanfragen
              </span>
            </div>
            <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-elvora-gradient rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${Math.round(((liveProgress.currentSearch || 0) / (liveProgress.totalSearches || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Current Search Info */}
          {liveProgress.keyword && liveProgress.type !== 'batch_complete' && (
            <div className="bg-white/[0.03] rounded-xl p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white font-medium truncate mr-4">
                  {liveProgress.keyword}
                </span>
                {liveProgress.currentPage && liveProgress.totalPages && (
                  <span className="text-xs text-elvora-text-dim whitespace-nowrap">
                    Seite {liveProgress.currentPage}/{liveProgress.totalPages}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Live Counters */}
          <div className="grid grid-cols-3 gap-3">
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
                    {search.found} gefunden, {search.imported} neu, {search.duplicates} doppelt
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
              <div className="text-2xl font-bold text-elvora-text-muted">{completedSearches.length}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Suchanfragen</div>
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
                <h2 className="text-sm font-semibold text-white">Ergebnisse pro Suche</h2>
              </div>
              <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
                {completedSearches.map((search, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-xs">
                    <span className="text-white font-medium">{search.keyword}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-elvora-text-muted">{search.found} gefunden</span>
                      <span className="text-elvora-success">{search.imported} neu</span>
                      {search.duplicates > 0 && (
                        <span className="text-elvora-warning">{search.duplicates} doppelt</span>
                      )}
                      <span className="text-elvora-text-dim">{(search.duration / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Errors from scraping */}
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

      {/* Job Results Table (from history) */}
      {showingResults && (
        <div className="card-glass overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              {jobResults.length} Firmen gefunden
            </h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => exportCsv(jobResults)}
                className="text-xs text-elvora-primary hover:text-elvora-primary/80 transition-colors"
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Firma</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Telefon</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Website</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Adresse</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Stadt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Bewertung</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {jobResults.map((biz, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-elvora-text-dim text-xs">{i + 1}</td>
                    <td className="px-4 py-3">
                      <span className="text-white font-medium">{biz.name}</span>
                      {biz.category && (
                        <span className="block text-[10px] text-elvora-text-dim mt-0.5">{biz.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {biz.phone ? (
                        <a href={`tel:${biz.phone}`} className="text-elvora-primary hover:underline">
                          {biz.phone}
                        </a>
                      ) : (
                        <span className="text-elvora-text-dim">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {biz.website ? (
                        <a
                          href={biz.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-elvora-primary hover:underline text-xs truncate max-w-[200px] block"
                        >
                          {biz.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                        </a>
                      ) : (
                        <span className="text-elvora-text-dim">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-elvora-text-muted text-xs max-w-[200px] truncate">
                      {biz.address || '-'}
                    </td>
                    <td className="px-4 py-3 text-elvora-text-muted text-xs">{biz.city || '-'}</td>
                    <td className="px-4 py-3">
                      {biz.rating ? (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-white text-xs">{biz.rating}</span>
                        </div>
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
            <h2 className="text-sm font-semibold text-white">Letzte Scraping-Jobs</h2>
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
                      job.status === 'running' ? 'bg-elvora-primary animate-pulse' :
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
