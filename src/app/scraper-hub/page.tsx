'use client';

import { useState, useCallback } from 'react';

interface ScraperSource {
  id: string;
  name: string;
  description: string;
  icon: string;
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
  { id: 'maps', name: 'Google Maps', description: 'Google Places API — max 60 Ergebnisse pro Suche, strukturierte Daten, höchste Qualität', icon: 'map' },
  { id: 'branchenportal', name: 'Branchenportale', description: 'Gelbe Seiten + 11880 — klassische Branchenverzeichnisse mit Telefon & Website', icon: 'book' },
  { id: 'websearch', name: 'Web-Suche', description: 'SearXNG — findet Firmen-Websites über Google, Bing & 70+ Quellen + Impressum-Analyse', icon: 'search' },
];

function SourceIcon({ name }: { name: string }) {
  if (name === 'map') {
    return (
      <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  if (name === 'book') {
    return (
      <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

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
  const [websearchProgress, setWebsearchProgress] = useState<string | null>(null);

  function toggleSource(id: string) {
    setSelectedSources((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

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
    setWebsearchProgress(null);

    const newResults: ScrapeResult[] = [];

    for (const sourceId of selectedSources) {
      setCurrentSource(sourceId);

      try {
        if (sourceId === 'maps') {
          setMapsProgress('Starte Maps-Suche...');
          const response = await fetch('/api/scraper/maps/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: [keyword.trim()], cities: [city.trim()], maxPages: 3 }),
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Maps-Fehler' }));
            newResults.push({ source: 'Google Maps', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [(err as { error?: string }).error || `HTTP ${response.status}`] });
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
                if (data.type === 'search_start') setMapsProgress(`Suche: ${data.keyword}...`);
                else if (data.type === 'page_progress') setMapsProgress(`${data.keyword} — Seite ${data.currentPage}/${data.totalPages}`);
                else if (data.type === 'email_scrape_progress') setMapsProgress(`E-Mails: ${data.emailsDone}/${data.emailsTotal}`);
                else if (data.type === 'batch_complete') {
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
              } catch { /* skip parse errors */ }
            }
          }
          newResults.push(mapsResult || { source: 'Google Maps', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: ['Keine Ergebnisse'] });
          setMapsProgress(null);
          setResults([...newResults]);
        } else if (sourceId === 'branchenportal') {
          const response = await fetch('/api/scraper/branchenportal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.trim(), city: city.trim(), maxPages: 2, autoEnrich }),
          });
          const data = await response.json();
          newResults.push({
            source: 'Branchenportale',
            totalFound: response.ok ? (data.totalFound || 0) : 0,
            imported: response.ok ? (data.imported || 0) : 0,
            duplicates: response.ok ? (data.duplicates || 0) : 0,
            skipped: response.ok ? (data.skipped || 0) : 0,
            errors: response.ok ? (data.errors || []) : [data.error || 'Fehler'],
          });
          setResults([...newResults]);
        } else if (sourceId === 'websearch') {
          setWebsearchProgress('Starte Web-Suche...');
          const response = await fetch('/api/scraper/websearch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.trim(), city: city.trim(), maxResults: 20, autoEnrich }),
          });
          if (!response.ok || !response.body) {
            const errData = await response.json().catch(() => ({ error: 'Fehler' }));
            newResults.push({ source: 'Web-Suche', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [errData.error || `HTTP ${response.status}`] });
          } else {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let wsResult: ScrapeResult | null = null;
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
                  if (data.type === 'status') setWebsearchProgress(data.message);
                  else if (data.type === 'complete') {
                    wsResult = {
                      source: 'Web-Suche',
                      totalFound: data.totalFound || 0,
                      imported: data.imported || 0,
                      duplicates: data.duplicates || 0,
                      skipped: data.skipped || 0,
                      errors: data.errors || [],
                    };
                  }
                } catch { /* skip */ }
              }
            }
            newResults.push(wsResult || { source: 'Web-Suche', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: ['Keine Antwort'] });
          }
          setWebsearchProgress(null);
          setResults([...newResults]);
        }
      } catch (err) {
        newResults.push({
          source: SOURCES.find((s) => s.id === sourceId)?.name || sourceId,
          totalFound: 0, imported: 0, duplicates: 0, skipped: 0,
          errors: [err instanceof Error ? err.message : 'Unbekannter Fehler'],
        });
        setResults([...newResults]);
      }
    }

    setCurrentSource(null);
    setScraping(false);
  }, [keyword, city, selectedSources, autoEnrich]);

  let totalFound = 0;
  let totalImported = 0;
  let totalDuplicates = 0;
  for (const r of results) {
    totalFound += r.totalFound || 0;
    totalImported += r.imported || 0;
    totalDuplicates += r.duplicates || 0;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Scraper Hub</h1>
        <p className="text-sm text-elvora-text-dim mt-0.5">Alle Lead-Quellen auf einen Blick — Google Maps, Branchenportale & Web-Suche</p>
      </div>

      <div className="card rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-elvora-text-dim mb-1.5">Keyword / Branche</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="z.B. Heizungsinstallateur, Zahnarzt, Rechtsanwalt..."
              className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
            />
          </div>
          <div>
            <label className="block text-xs text-elvora-text-dim mb-1.5">Stadt</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="z.B. Essen, Düsseldorf, Köln..."
              className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs text-elvora-text-dim mb-2">Quellen auswählen</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SOURCES.map((source) => {
              const active = selectedSources.includes(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => toggleSource(source.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${
                    active
                      ? 'border-elvora-purple/50 bg-elvora-purple/10'
                      : 'border-elvora-border bg-elvora-bg-alt hover:border-elvora-border-light'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <SourceIcon name={source.icon} />
                    <span className="text-white text-sm font-medium">{source.name}</span>
                    {active && (
                      <svg className="w-4 h-4 text-elvora-purple-light ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-elvora-text-dim text-xs leading-relaxed">{source.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoEnrich}
            onChange={(e) => setAutoEnrich(e.target.checked)}
            className="w-4 h-4 rounded bg-elvora-bg-alt border-elvora-border"
          />
          <span className="text-sm text-elvora-text-muted">Auto-Enrichment (E-Mail & Telefon von Websites scrapen)</span>
        </label>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}

        <button
          onClick={scrapeAll}
          disabled={scraping}
          className="px-5 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {scraping ? (
            <span>Scraping läuft...</span>
          ) : (
            <span>Alle Quellen durchsuchen</span>
          )}
        </button>
      </div>

      {scraping && currentSource && (
        <div className="card rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-sm font-medium">
              {SOURCES.find((s) => s.id === currentSource)?.name || currentSource}
            </span>
            <span className="text-elvora-text-dim text-xs ml-auto">
              {currentSource === 'websearch' ? (websearchProgress || 'Wird durchsucht...') : (mapsProgress || 'Wird durchsucht...')}
            </span>
          </div>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="card rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-white">{totalFound}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Gefunden</div>
            </div>
            <div className="card rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-elvora-success">{totalImported}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Neu importiert</div>
            </div>
            <div className="card rounded-xl p-4 text-center">
              <div className="text-2xl font-bold text-elvora-warning">{totalDuplicates}</div>
              <div className="text-xs text-elvora-text-dim mt-1">Duplikate</div>
            </div>
          </div>

          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className="card rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-white text-sm font-medium">{r.source}</h3>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-elvora-text-muted">{r.totalFound} gefunden</span>
                    <span className="text-elvora-success">+{r.imported} neu</span>
                    {r.duplicates > 0 && <span className="text-elvora-warning">{r.duplicates} duplikat</span>}
                    {r.duration ? <span className="text-elvora-text-dim">{(r.duration / 1000).toFixed(1)}s</span> : null}
                  </div>
                </div>
                {r.errors && r.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {r.errors.map((e, j) => (
                      <p key={j} className="text-red-400/70 text-[11px]">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card rounded-xl p-5">
        <h3 className="text-white text-sm font-semibold mb-3">Einzelne Scraper</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <a href="/scraper" className="flex items-center gap-2 p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors">
            <span className="text-white text-sm font-medium">Maps Scraper</span>
          </a>
          <a href="/linkedin-scraper" className="flex items-center gap-2 p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors">
            <span className="text-white text-sm font-medium">Entscheider-Finder</span>
          </a>
          <a href="/email-finder" className="flex items-center gap-2 p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors">
            <span className="text-white text-sm font-medium">Email-Finder</span>
          </a>
          <a href="/lead-pool" className="flex items-center gap-2 p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors">
            <span className="text-white text-sm font-medium">Lead-Pool</span>
          </a>
        </div>
      </div>
    </div>
  );
}
