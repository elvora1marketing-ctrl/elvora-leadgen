'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ScrapeResult {
  source: string;
  totalFound: number;
  imported: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

interface LogEntry {
  time: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const SOURCES = [
  { id: 'maps', name: 'Google Maps', description: 'Google Places API — strukturierte Daten, höchste Qualität', icon: 'map' },
  { id: 'branchenportal', name: 'Branchenportale', description: 'Gelbe Seiten + 11880 — Branchenverzeichnisse mit Telefon & E-Mail', icon: 'book' },
  { id: 'websearch', name: 'Web-Suche', description: 'SearXNG — Google, Bing & 70+ Quellen + Impressum-Analyse', icon: 'search' },
];

function SourceIcon({ name }: { name: string }) {
  if (name === 'map') return (
    <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
  if (name === 'book') return (
    <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
  return (
    <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

function nowTime() {
  return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ScraperHubPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>(['maps', 'branchenportal', 'websearch']);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  function addLog(source: string, message: string, type: LogEntry['type'] = 'info') {
    setLogs(prev => [...prev, { time: nowTime(), source, message, type }]);
  }

  function toggleSource(id: string) {
    setSelectedSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function readStream(
    response: Response,
    source: string,
    onComplete: (data: Record<string, unknown>) => void,
  ) {
    if (!response.body) return;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          if (data.type === 'status' || data.type === 'search_start' || data.type === 'page_progress' || data.type === 'email_scrape_progress') {
            const msg = data.message || data.keyword || `Seite ${data.currentPage}/${data.totalPages}`;
            addLog(source, msg);
          } else if (data.type === 'batch_complete' || data.type === 'complete') {
            onComplete(data);
          }
        } catch { /* skip */ }
      }
    }
  }

  const scrapeAll = useCallback(async () => {
    if (!keyword.trim() || !city.trim()) { setError('Bitte Keyword und Stadt eingeben'); return; }
    if (selectedSources.length === 0) { setError('Mindestens eine Quelle auswählen'); return; }

    setScraping(true);
    setError(null);
    setResults([]);
    setLogs([]);

    addLog('System', `Starte Scraping: "${keyword}" in "${city}"`, 'info');

    const newResults: ScrapeResult[] = [];

    for (const sourceId of selectedSources) {
      const sourceName = SOURCES.find(s => s.id === sourceId)?.name || sourceId;

      try {
        if (sourceId === 'maps') {
          addLog('Maps', 'Starte Google Maps Suche...', 'info');
          const response = await fetch('/api/scraper/maps/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keywords: [keyword.trim()], cities: [city.trim()], maxPages: 3 }),
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Fehler' }));
            addLog('Maps', (err as { error?: string }).error || `HTTP ${response.status}`, 'error');
            newResults.push({ source: 'Google Maps', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [(err as { error?: string }).error || 'Fehler'] });
          } else {
            let mapsResult: ScrapeResult = { source: 'Google Maps', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [] };
            await readStream(response, 'Maps', (data) => {
              mapsResult = {
                source: 'Google Maps',
                totalFound: (data.totalFound as number) || 0,
                imported: (data.totalImported as number) || 0,
                duplicates: (data.totalDuplicates as number) || 0,
                skipped: (data.totalSkipped as number) || 0,
                errors: (data.errors as string[]) || [],
              };
            });
            addLog('Maps', `Fertig: ${mapsResult.totalFound} gefunden, +${mapsResult.imported} neu`, 'success');
            newResults.push(mapsResult);
          }
          setResults([...newResults]);

        } else if (sourceId === 'branchenportal') {
          addLog('Portal', 'Starte Branchenportal-Suche...', 'info');
          const response = await fetch('/api/scraper/branchenportal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.trim(), city: city.trim(), maxPages: 3, autoEnrich }),
          });

          if (!response.ok || !response.body) {
            const errData = await response.json().catch(() => ({ error: 'Fehler' }));
            addLog('Portal', errData.error || `HTTP ${response.status}`, 'error');
            newResults.push({ source: 'Branchenportale', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [errData.error || 'Fehler'] });
          } else {
            let portalResult: ScrapeResult = { source: 'Branchenportale', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [] };
            await readStream(response, 'Portal', (data) => {
              portalResult = {
                source: 'Branchenportale',
                totalFound: (data.totalFound as number) || 0,
                imported: (data.imported as number) || 0,
                duplicates: (data.duplicates as number) || 0,
                skipped: (data.skipped as number) || 0,
                errors: (data.errors as string[]) || [],
              };
            });
            addLog('Portal', `Fertig: ${portalResult.totalFound} gefunden, +${portalResult.imported} neu`, 'success');
            newResults.push(portalResult);
          }
          setResults([...newResults]);

        } else if (sourceId === 'websearch') {
          addLog('Web', 'Starte Web-Suche (SearXNG)...', 'info');
          const response = await fetch('/api/scraper/websearch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword.trim(), city: city.trim(), maxResults: 20, autoEnrich }),
          });

          if (!response.ok || !response.body) {
            const errData = await response.json().catch(() => ({ error: 'Fehler' }));
            addLog('Web', errData.error || `HTTP ${response.status}`, 'error');
            newResults.push({ source: 'Web-Suche', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [errData.error || 'Fehler'] });
          } else {
            let wsResult: ScrapeResult = { source: 'Web-Suche', totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [] };
            await readStream(response, 'Web', (data) => {
              wsResult = {
                source: 'Web-Suche',
                totalFound: (data.totalFound as number) || 0,
                imported: (data.imported as number) || 0,
                duplicates: (data.duplicates as number) || 0,
                skipped: (data.skipped as number) || 0,
                errors: (data.errors as string[]) || [],
              };
            });
            addLog('Web', `Fertig: ${wsResult.totalFound} gefunden, +${wsResult.imported} neu`, 'success');
            newResults.push(wsResult);
          }
          setResults([...newResults]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Fehler';
        addLog(sourceName, msg, 'error');
        newResults.push({ source: sourceName, totalFound: 0, imported: 0, duplicates: 0, skipped: 0, errors: [msg] });
        setResults([...newResults]);
      }
    }

    addLog('System', 'Alle Scraper abgeschlossen.', 'success');
    setScraping(false);
  }, [keyword, city, selectedSources, autoEnrich]);

  let totalFound = 0, totalImported = 0, totalDuplicates = 0;
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
              placeholder="z.B. Heizungsinstallateur, Zahnarzt..."
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
          <label className="block text-xs text-elvora-text-dim mb-2">Quellen</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SOURCES.map((source) => {
              const active = selectedSources.includes(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => toggleSource(source.id)}
                  className={`text-left p-3 rounded-lg border transition-all ${active ? 'border-elvora-purple/50 bg-elvora-purple/10' : 'border-elvora-border bg-elvora-bg-alt hover:border-elvora-border-light'}`}
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
          <input type="checkbox" checked={autoEnrich} onChange={(e) => setAutoEnrich(e.target.checked)} className="w-4 h-4 rounded bg-elvora-bg-alt border-elvora-border" />
          <span className="text-sm text-elvora-text-muted">Auto-Enrichment (E-Mail & Telefon von Websites scrapen)</span>
        </label>

        {error && <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>}

        <button
          onClick={scrapeAll}
          disabled={scraping}
          className="px-5 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {scraping ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Scraping läuft...</span>
            </>
          ) : (
            <span>Alle Quellen durchsuchen</span>
          )}
        </button>
      </div>

      {/* Live-Konsole */}
      {logs.length > 0 && (
        <div className="card rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-elvora-border bg-elvora-bg-alt/50">
            <div className={`w-2 h-2 rounded-full ${scraping ? 'bg-green-400 animate-pulse' : 'bg-elvora-text-dim'}`} />
            <span className="text-xs font-mono text-elvora-text-dim">Konsole</span>
            {scraping && <span className="text-[10px] text-elvora-text-dim ml-auto">Live</span>}
          </div>
          <div
            ref={consoleRef}
            className="px-4 py-3 max-h-64 overflow-y-auto font-mono text-[11px] leading-[1.7] bg-[#0a0a12] space-y-0"
          >
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-elvora-text-dim/50 shrink-0">{log.time}</span>
                <span className={`shrink-0 w-14 ${
                  log.source === 'System' ? 'text-elvora-purple-light' :
                  log.source === 'Maps' ? 'text-blue-400' :
                  log.source === 'Portal' ? 'text-yellow-400' :
                  log.source === 'Web' ? 'text-orange-400' : 'text-elvora-text-dim'
                }`}>[{log.source}]</span>
                <span className={
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  'text-elvora-text'
                }>{log.message}</span>
              </div>
            ))}
            {scraping && (
              <div className="flex gap-2 text-elvora-text-dim">
                <span className="shrink-0">{nowTime()}</span>
                <span className="animate-pulse">_</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ergebnisse */}
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
                  </div>
                </div>
                {r.errors && r.errors.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    {r.errors.map((e, j) => <p key={j} className="text-red-400/70 text-[11px]">{e}</p>)}
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
