'use client';

import { useState, useCallback } from 'react';

interface ScraperSource {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

interface ScrapeResult {
  source: string;
  totalFound: number;
  imported: number;
  duplicates: number;
  skipped: number;
  errors: string[];
  duration?: number;
}

const SOURCES: ScraperSource[] = [
  { id: 'maps', name: 'Google Maps', description: 'Google Places API — max 60 Ergebnisse/Suche, strukturierte Daten, höchste Qualität', icon: '📍', enabled: true },
  { id: 'branchenportal', name: 'Branchenportale', description: 'Gelbe Seiten + 11880 — klassische Branchenverzeichnisse mit Telefon & Website', icon: '📒', enabled: true },
  { id: 'websearch', name: 'Web-Suche', description: 'DuckDuckGo-basiert — findet Firmen-Websites über Suchmaschine + Impressum-Analyse', icon: '🔍', enabled: true },
];

export default function ScraperHubPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>(['maps', 'branchenportal', 'websearch']);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [currentSource, setCurrentSource] = useState<string | null>(null);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mapsProgress, setMapsProgress] = useState<string | null>(null);

  const toggleSource = (id: string) => {
    setSelectedSources((prev: string[]) =>
      prev.includes(id) ? prev.filter((s: string) => s !== id) : [...prev, id]
    );
  };

  const scrapeAll = useCallback(async () => {
    if (!keyword.trim() || !city.trim()) {
      setError('Bitte Keyword und Stadt eingeben');
      return;
    }
    if (selectedSources.length === 0) {
      setError('Mindestens eine Quelle auswählen');
      return;
    }

    setScraping(true);
    setError(null);
    setResults([]);
    setMapsProgress(null);

    const newResults: ScrapeResult[] = [];

    for (const sourceId of selectedSources) {
      setCurrentSource(sourceId);

      try {
        if (sourceId === 'maps') {
          setMapsProgress('Starte Maps-Suche...');
          const response = await fetch('/api/scraper/maps/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keywords: [keyword.trim()],
              cities: [city.trim()],
              maxPages: 3,
            }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Maps-Fehler' }));
            newResults.push({
              source: 'Google Maps',
              totalFound: 0,
              imported: 0,
              duplicates: 0,
              skipped: 0,
              errors: [(err as { error?: string }).error || `HTTP ${response.status}`],
            });
            setResults([...newResults]);
            continue;
          }

          const reader = response.body?.getReader();
          if (!reader) continue;

          const decoder = new TextDecoder();
          let buffer = '';
          let mapsResult: ScrapeResult | null = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'search_start') {
                  setMapsProgress(`Suche: ${data.keyword}...`);
                } else if (data.type === 'page_progress') {
                  setMapsProgress(`${data.keyword} — Seite ${data.currentPage}/${data.totalPages} (${data.totalFound} gefunden)`);
                } else if (data.type === 'email_scrape_progress') {
                  setMapsProgress(`E-Mails scrapen: ${data.emailsDone}/${data.emailsTotal} (${data.emailsFound} gefunden)`);
                } else if (data.type === 'batch_complete') {
                  mapsResult = {
                    source: 'Google Maps',
                    totalFound: data.totalFound || 0,
                    imported: data.totalImported || 0,
                    duplicates: data.totalDuplicates || 0,
                    skipped: data.totalSkipped || 0,
                    errors: data.errors || [],
                    duration: data.duration,
                  };
                }
              } catch { /* ignore parse errors */ }
            }
          }

          if (mapsResult) {
            newResults.push(mapsResult);
          } else {
            newResults.push({
              source: 'Google Maps',
              totalFound: 0, imported: 0, duplicates: 0, skipped: 0,
              errors: ['Keine Ergebnisse'],
            });
          }
          setMapsProgress(null);
          setResults([...newResults]);

        } else if (sourceId === 'branchenportal') {
          const response = await fetch('/api/scraper/branchenportal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword: keyword.trim(),
              city: city.trim(),
              maxPages: 2,
              autoEnrich,
            }),
          });

          const data = await response.json();
          if (response.ok) {
            newResults.push({
              source: 'Branchenportale',
              totalFound: data.totalFound || 0,
              imported: data.imported || 0,
              duplicates: data.duplicates || 0,
              skipped: data.skipped || 0,
              errors: data.errors || [],
            });
          } else {
            newResults.push({
              source: 'Branchenportale',
              totalFound: 0, imported: 0, duplicates: 0, skipped: 0,
              errors: [data.error || 'Fehler'],
            });
          }
          setResults([...newResults]);

        } else if (sourceId === 'websearch') {
          const response = await fetch('/api/scraper/websearch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              keyword: keyword.trim(),
              city: city.trim(),
              maxResults: 20,
              autoEnrich,
            }),
          });

          const data = await response.json();
          if (response.ok) {
            newResults.push({
              source: 'Web-Suche',
              totalFound: data.totalFound || 0,
              imported: data.imported || 0,
              duplicates: data.duplicates || 0,
              skipped: data.skipped || 0,
              errors: data.errors || [],
            });
          } else {
            newResults.push({
              source: 'Web-Suche',
              totalFound: 0, imported: 0, duplicates: 0, skipped: 0,
              errors: [data.error || 'Fehler'],
            });
          }
          setResults([...newResults]);
        }
      } catch (err) {
        newResults.push({
          source: SOURCES.find(s => s.id === sourceId)?.name || sourceId,
          totalFound: 0, imported: 0, duplicates: 0, skipped: 0,
          errors: [err instanceof Error ? err.message : 'Unbekannter Fehler'],
        });
        setResults([...newResults]);
      }
    }

    setCurrentSource(null);
    setScraping(false);
  }, [keyword, city, selectedSources, autoEnrich]);

  const totalFound = results.reduce((s: number, r: ScrapeResult) => s + r.totalFound, 0);
  const totalImported = results.reduce((s: number, r: ScrapeResult) => s + r.imported, 0);
  const totalDuplicates = results.reduce((s: number, r: ScrapeResult) => s + r.duplicates, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Scraper Hub</h1>
        <p className="text-[#8a8f98] text-sm mt-1">Alle Lead-Quellen auf einen Blick — Google Maps, Branchenportale & Web-Suche</p>
      </div>

      {/* Search Input */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm text-[#8a8f98] mb-1.5 block">Keyword / Branche</label>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="z.B. Heizungsinstallateur, Zahnarzt, Rechtsanwalt..."
              className="w-full bg-[#1a1a2e] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="text-sm text-[#8a8f98] mb-1.5 block">Stadt</label>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="z.B. Essen, Düsseldorf, Köln..."
              className="w-full bg-[#1a1a2e] border border-white/[0.06] rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* Source Selection */}
        <label className="text-sm text-[#8a8f98] mb-3 block">Quellen auswählen</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {SOURCES.map(source => (
            <button
              key={source.id}
              onClick={() => toggleSource(source.id)}
              className={`text-left p-4 rounded-xl border transition-all ${
                selectedSources.includes(source.id)
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-white/[0.06] bg-[#1a1a2e] hover:border-white/[0.12]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{source.icon}</span>
                <span className="text-white text-sm font-medium">{source.name}</span>
                {selectedSources.includes(source.id) && (
                  <svg className="w-4 h-4 text-purple-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <p className="text-[#555] text-xs leading-relaxed">{source.description}</p>
            </button>
          ))}
        </div>

        {/* Options */}
        <div className="flex items-center gap-6 mb-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoEnrich}
              onChange={e => setAutoEnrich(e.target.checked)}
              className="w-4 h-4 rounded bg-[#1a1a2e] border-white/10 text-purple-500 focus:ring-purple-500/50"
            />
            <span className="text-sm text-[#c8ccd4]">Auto-Enrichment (E-Mail & Telefon von Websites scrapen)</span>
          </label>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={scrapeAll}
          disabled={scraping}
          className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {scraping ? (
            <>
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scraping läuft...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Alle Quellen durchsuchen
            </>
          )}
        </button>
      </div>

      {/* Live Progress */}
      {scraping && currentSource && (
        <div className="bg-[#12121a] border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <svg className="w-5 h-5 text-purple-400 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-white font-medium">
              {SOURCES.find(s => s.id === currentSource)?.name || currentSource}
            </span>
          </div>
          {mapsProgress && (
            <p className="text-[#8a8f98] text-sm ml-8">{mapsProgress}</p>
          )}
          {!mapsProgress && (
            <p className="text-[#8a8f98] text-sm ml-8">Wird durchsucht...</p>
          )}
        </div>
      )}

      {/* Results Summary */}
      {results.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#12121a] border border-white/[0.06] rounded-xl p-5 text-center">
              <div className="text-2xl font-bold text-white">{totalFound}</div>
              <div className="text-xs text-[#8a8f98] mt-1">Gefunden</div>
            </div>
            <div className="bg-[#12121a] border border-white/[0.06] rounded-xl p-5 text-center">
              <div className="text-2xl font-bold text-green-400">{totalImported}</div>
              <div className="text-xs text-[#8a8f98] mt-1">Neu importiert</div>
            </div>
            <div className="bg-[#12121a] border border-white/[0.06] rounded-xl p-5 text-center">
              <div className="text-2xl font-bold text-yellow-400">{totalDuplicates}</div>
              <div className="text-xs text-[#8a8f98] mt-1">Duplikate</div>
            </div>
          </div>

          {/* Per-Source Results */}
          <div className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className="bg-[#12121a] border border-white/[0.06] rounded-xl p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-medium">{r.source}</h3>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-[#c8ccd4]">{r.totalFound} gefunden</span>
                    <span className="text-green-400">+{r.imported} neu</span>
                    {r.duplicates > 0 && (
                      <span className="text-yellow-400">{r.duplicates} duplikat</span>
                    )}
                  </div>
                </div>
                {r.errors.length > 0 && (
                  <div className="mt-2">
                    {r.errors.map((e, j) => (
                      <p key={j} className="text-red-400/70 text-xs">{e}</p>
                    ))}
                  </div>
                )}
                {r.duration && (
                  <p className="text-[#555] text-xs mt-1">{(r.duration / 1000).toFixed(1)}s</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Quick Links */}
      <div className="bg-[#12121a] border border-white/[0.06] rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Einzelne Scraper</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a href="/scraper" className="flex items-center gap-2 p-3 rounded-lg bg-[#1a1a2e] border border-white/[0.06] hover:border-purple-500/30 transition-colors">
            <span className="text-lg">📍</span>
            <div>
              <div className="text-white text-sm font-medium">Maps Scraper</div>
              <div className="text-[#555] text-xs">Tiefenscan & Umkreis</div>
            </div>
          </a>
          <a href="/linkedin-scraper" className="flex items-center gap-2 p-3 rounded-lg bg-[#1a1a2e] border border-white/[0.06] hover:border-purple-500/30 transition-colors">
            <span className="text-lg">👤</span>
            <div>
              <div className="text-white text-sm font-medium">Entscheider-Finder</div>
              <div className="text-[#555] text-xs">LinkedIn Profile</div>
            </div>
          </a>
          <a href="/email-finder" className="flex items-center gap-2 p-3 rounded-lg bg-[#1a1a2e] border border-white/[0.06] hover:border-purple-500/30 transition-colors">
            <span className="text-lg">📧</span>
            <div>
              <div className="text-white text-sm font-medium">Email-Finder</div>
              <div className="text-[#555] text-xs">Impressum-Analyse</div>
            </div>
          </a>
          <a href="/lead-pool" className="flex items-center gap-2 p-3 rounded-lg bg-[#1a1a2e] border border-white/[0.06] hover:border-purple-500/30 transition-colors">
            <span className="text-lg">🗂</span>
            <div>
              <div className="text-white text-sm font-medium">Lead-Pool</div>
              <div className="text-[#555] text-xs">Alle Leads verwalten</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
