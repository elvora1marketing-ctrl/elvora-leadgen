'use client';

import { useState, useEffect, useCallback } from 'react';

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

interface ScrapeResponse {
  jobId: number;
  keyword: string;
  pagesScraped: number;
  businessesFound: number;
  imported: number;
  duplicates: number;
  skipped: number;
  duration: number;
  errors: string[];
  businesses: ScrapedBusiness[];
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

export default function ScraperPage() {
  const [keyword, setKeyword] = useState('');
  const [maxPages, setMaxPages] = useState(5);
  const [scraping, setScraping] = useState(false);
  const [result, setResult] = useState<ScrapeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [jobResults, setJobResults] = useState<ScrapedBusiness[]>([]);

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

  const [selectedCity, setSelectedCity] = useState('Essen');

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
    if (!keyword.trim()) return;

    const fullKeyword = `${keyword.trim()} ${selectedCity}`;
    setScraping(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/scraper/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: fullKeyword, maxPages }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Scraping fehlgeschlagen');
      }
    } catch (err) {
      setError('Netzwerkfehler - Server nicht erreichbar');
    } finally {
      setScraping(false);
      loadJobs();
    }
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

  const displayBusinesses = result?.businesses || jobResults;
  const showingResults = (result && result.businesses.length > 0) || jobResults.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Google Maps Scraper</h1>
          <p className="text-sm text-elvora-text-dim mt-1">
            Firmen aus Google Maps finden und als Leads importieren
          </p>
        </div>
        {showingResults && (
          <button
            onClick={() => exportCsv(displayBusinesses)}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Keyword Input */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-elvora-text-muted mb-2">
              Suchbegriff
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

          {/* City Select */}
          <div>
            <label className="block text-sm font-medium text-elvora-text-muted mb-2">
              Stadt
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 transition-all"
            >
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>
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
                onClick={() => setKeyword(preset)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  keyword === preset
                    ? 'bg-elvora-primary/30 text-elvora-primary border border-elvora-primary/40'
                    : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Pages Slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-elvora-text-muted">
              Seiten scrapen
            </label>
            <span className="text-sm font-bold text-white">
              {maxPages} Seiten <span className="text-elvora-text-dim font-normal">(~{maxPages * 20} Ergebnisse)</span>
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={maxPages}
            onChange={(e) => setMaxPages(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-elvora-primary"
          />
          <div className="flex justify-between text-[10px] text-elvora-text-dim mt-1">
            <span>1 Seite</span>
            <span>10 Seiten</span>
            <span>20 Seiten</span>
          </div>
        </div>

        {/* Start Button */}
        <button
          onClick={startScraping}
          disabled={scraping || !keyword.trim()}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 ${
            scraping
              ? 'bg-elvora-primary/20 text-elvora-primary cursor-wait'
              : keyword.trim()
                ? 'bg-elvora-gradient text-white hover:shadow-elvora hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-white/5 text-elvora-text-dim cursor-not-allowed'
          }`}
        >
          {scraping ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scraping l&auml;uft... Bitte warten
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scraping starten: &quot;{keyword.trim() || '...'} {selectedCity}&quot;
            </>
          )}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="card-glass border border-red-500/20 bg-red-500/5 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-300 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Results Summary */}
      {result && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="card-glass p-4 text-center">
            <div className="text-2xl font-bold text-white">{result.businessesFound}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Gefunden</div>
          </div>
          <div className="card-glass p-4 text-center">
            <div className="text-2xl font-bold text-elvora-success">{result.imported}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Importiert</div>
          </div>
          <div className="card-glass p-4 text-center">
            <div className="text-2xl font-bold text-elvora-warning">{result.duplicates}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Duplikate</div>
          </div>
          <div className="card-glass p-4 text-center">
            <div className="text-2xl font-bold text-elvora-text-muted">{result.pagesScraped}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Seiten</div>
          </div>
          <div className="card-glass p-4 text-center">
            <div className="text-2xl font-bold text-elvora-text-muted">{(result.duration / 1000).toFixed(1)}s</div>
            <div className="text-xs text-elvora-text-dim mt-1">Dauer</div>
          </div>
        </div>
      )}

      {/* Warnings/Errors from scraping */}
      {result && result.errors.length > 0 && (
        <div className="card-glass border border-elvora-warning/20 bg-elvora-warning/5 p-4 rounded-xl">
          <h3 className="text-sm font-semibold text-elvora-warning mb-2">Hinweise</h3>
          <ul className="space-y-1">
            {result.errors.map((err, i) => (
              <li key={i} className="text-xs text-elvora-text-dim flex items-start gap-2">
                <span className="text-elvora-warning mt-0.5">!</span>
                {err}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Results Table */}
      {showingResults && (
        <div className="card-glass overflow-hidden">
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">
              {displayBusinesses.length} Firmen gefunden
            </h2>
            {selectedJob && (
              <button
                onClick={() => { setSelectedJob(null); setJobResults([]); }}
                className="text-xs text-elvora-text-dim hover:text-white transition-colors"
              >
                Schliessen
              </button>
            )}
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
                {displayBusinesses.map((biz, i) => (
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
                  className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => viewJobResults(job.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2 h-2 rounded-full ${
                      job.status === 'completed' ? 'bg-elvora-success' :
                      job.status === 'running' ? 'bg-elvora-primary pulse-dot' :
                      'bg-red-500'
                    }`} />
                    <div>
                      <span className="text-white text-sm font-medium">{job.keyword}</span>
                      <span className="text-elvora-text-dim text-xs ml-3">
                        {new Date(job.started_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
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
