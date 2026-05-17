'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface LogEntry {
  time: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

interface ScrapeResult {
  source: string;
  totalFound: number;
  imported: number;
  duplicates: number;
  skipped: number;
  errors: string[];
}

type SearchMode = 'city' | 'radius' | 'germany';
type Phase = 'config' | 'scraping' | 'done';

const SOURCES = [
  { id: 'maps', name: 'Google Maps', color: 'text-blue-400' },
  { id: 'branchenportal', name: 'Branchenportale', color: 'text-yellow-400' },
  { id: 'websearch', name: 'Web-Suche', color: 'text-orange-400' },
];

function nowTime() {
  return new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ScraperHubPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('city');
  const [radius, setRadius] = useState(50);
  const [selectedSources, setSelectedSources] = useState<string[]>(['maps', 'branchenportal', 'websearch']);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [deepScan, setDeepScan] = useState(false);
  const [phase, setPhase] = useState<Phase>('config');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<ScrapeResult[]>([]);
  const [allCities, setAllCities] = useState<Array<{ name: string; state: string }>>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    fetch('/api/cities')
      .then(r => r.json())
      .then(data => { if (data.cities) setAllCities(data.cities); })
      .catch(() => {});
  }, []);

  function addLog(source: string, message: string, type: LogEntry['type'] = 'info') {
    setLogs(prev => [...prev, { time: nowTime(), source, message, type }]);
  }

  function toggleSource(id: string) {
    setSelectedSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  function stop() {
    if (abortRef.current) abortRef.current.abort();
    addLog('System', 'Abgebrochen.', 'warn');
    setPhase('done');
  }

  const startScraping = useCallback(async () => {
    if (!keyword.trim()) return;

    let targetCities: string[] = [];

    if (searchMode === 'city') {
      if (!city.trim()) return;
      targetCities = [city.trim()];
    } else if (searchMode === 'radius') {
      if (!city.trim()) return;
      try {
        const res = await fetch(`/api/cities?mode=radius&city=${encodeURIComponent(city.trim())}&radius=${radius}`);
        const data = await res.json();
        targetCities = data.cities?.map((c: { name: string }) => c.name) || [city.trim()];
      } catch {
        targetCities = [city.trim()];
      }
    } else {
      try {
        const res = await fetch('/api/cities?mode=all');
        const data = await res.json();
        targetCities = data.cities?.map((c: { name: string }) => c.name) || [];
      } catch {
        targetCities = [];
      }
    }

    if (targetCities.length === 0) {
      addLog('System', 'Keine Städte gefunden.', 'error');
      return;
    }

    setPhase('scraping');
    setLogs([]);
    setResults([]);

    const controller = new AbortController();
    abortRef.current = controller;
    const newResults: ScrapeResult[] = [];

    addLog('System', `Scraping: "${keyword}" in ${targetCities.length} ${targetCities.length === 1 ? 'Stadt' : 'Städten'} × ${selectedSources.length} Quellen`, 'info');
    if (deepScan) addLog('System', 'Tiefenscan aktiv — alle Seiten + Stadtteile', 'info');

    for (let ci = 0; ci < targetCities.length; ci++) {
      if (controller.signal.aborted) break;
      const ct = targetCities[ci];
      addLog('System', `[${ci + 1}/${targetCities.length}] ${ct}`, 'info');

      for (const sourceId of selectedSources) {
        if (controller.signal.aborted) break;

        try {
          let endpoint = '';
          let body: Record<string, unknown> = {};

          if (sourceId === 'maps') {
            endpoint = '/api/scraper/maps/stream';
            body = { keywords: [keyword.trim()], cities: [ct], maxPages: deepScan ? 10 : 3 };
          } else if (sourceId === 'branchenportal') {
            endpoint = '/api/scraper/branchenportal';
            body = { keyword: keyword.trim(), city: ct, maxPages: deepScan ? 999 : 50, autoEnrich };
          } else if (sourceId === 'websearch') {
            endpoint = '/api/scraper/websearch';
            body = { keyword: keyword.trim(), city: ct, maxResults: deepScan ? 500 : 200, autoEnrich, deepScan };
          }

          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            addLog(sourceId, `${ct}: HTTP ${response.status}`, 'error');
            continue;
          }

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
                  addLog(sourceId === 'maps' ? 'Maps' : sourceId === 'branchenportal' ? 'Portal' : 'Web', data.message || `${ct}: ${data.keyword || ''}`, 'info');
                } else if (data.type === 'batch_complete' || data.type === 'complete') {
                  const found = (data.totalFound as number) || 0;
                  const imported = ((data.totalImported || data.imported) as number) || 0;
                  const duplicates = ((data.totalDuplicates || data.duplicates) as number) || 0;

                  const sourceName = SOURCES.find(s => s.id === sourceId)?.name || sourceId;
                  newResults.push({
                    source: `${sourceName} — ${ct}`,
                    totalFound: found,
                    imported,
                    duplicates,
                    skipped: (data.skipped as number) || 0,
                    errors: (data.errors as string[]) || [],
                  });
                  setResults([...newResults]);
                  addLog(sourceId === 'maps' ? 'Maps' : sourceId === 'branchenportal' ? 'Portal' : 'Web', `${ct}: ${found} gefunden, +${imported} neu`, 'success');
                }
              } catch { /* skip */ }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') break;
          addLog(sourceId, `${ct}: ${err instanceof Error ? err.message : 'Fehler'}`, 'error');
        }
      }
    }

    const totals = newResults.reduce((acc, r) => ({
      found: acc.found + r.totalFound,
      imported: acc.imported + r.imported,
      duplicates: acc.duplicates + r.duplicates,
    }), { found: 0, imported: 0, duplicates: 0 });

    addLog('System', `Fertig: ${totals.found} gefunden, ${totals.imported} importiert, ${totals.duplicates} Duplikate`, 'success');
    setPhase('done');
  }, [keyword, city, searchMode, radius, selectedSources, autoEnrich, deepScan]);

  const totalFound = results.reduce((s, r) => s + r.totalFound, 0);
  const totalImported = results.reduce((s, r) => s + r.imported, 0);
  const totalDuplicates = results.reduce((s, r) => s + r.duplicates, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Scraper Hub</h1>
        <p className="text-sm text-elvora-text-dim mt-0.5">Lead-Maschine — Direkt scrapen, alles absaugen</p>
      </div>

      {/* Config */}
      <div className="card rounded-xl p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-elvora-text-dim mb-1.5">Keyword / Branche</label>
            <input
              type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
              placeholder="z.B. Elektriker, Zahnarzt, Rechtsanwalt..."
              disabled={phase === 'scraping'}
              className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs text-elvora-text-dim mb-1.5">
              {searchMode === 'germany' ? 'Ganz Deutschland' : 'Stadt'}
            </label>
            <input
              type="text" value={city} onChange={(e) => setCity(e.target.value)}
              placeholder={searchMode === 'germany' ? 'Nicht nötig bei Deutschland-Scan' : 'z.B. Essen, Düsseldorf...'}
              disabled={phase === 'scraping' || searchMode === 'germany'}
              className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Search Mode */}
        <div>
          <label className="block text-xs text-elvora-text-dim mb-2">Suchmodus</label>
          <div className="flex gap-2">
            {([
              { id: 'city' as const, label: 'Einzelne Stadt' },
              { id: 'radius' as const, label: 'Umkreis' },
              { id: 'germany' as const, label: 'Ganz Deutschland' },
            ]).map(mode => (
              <button
                key={mode.id}
                onClick={() => setSearchMode(mode.id)}
                disabled={phase === 'scraping'}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                  searchMode === mode.id
                    ? 'bg-elvora-purple text-white'
                    : 'bg-elvora-bg-alt border border-elvora-border text-elvora-text-muted hover:border-elvora-purple/30'
                } disabled:opacity-50`}
              >
                {mode.label}
              </button>
            ))}
          </div>
          {searchMode === 'radius' && (
            <div className="mt-3 flex items-center gap-3">
              <input
                type="range" min={10} max={200} step={10} value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="flex-1 accent-elvora-purple"
              />
              <span className="text-sm text-white font-mono w-16 text-right">{radius} km</span>
            </div>
          )}
          {searchMode === 'germany' && (
            <p className="mt-2 text-[11px] text-elvora-text-dim">
              Durchsucht ~{allCities.length || '428'}+ deutsche Städte.
            </p>
          )}
        </div>

        {/* Sources */}
        <div>
          <label className="block text-xs text-elvora-text-dim mb-2">Quellen</label>
          <div className="flex gap-2 flex-wrap">
            {SOURCES.map(source => (
              <button
                key={source.id}
                onClick={() => toggleSource(source.id)}
                disabled={phase === 'scraping'}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  selectedSources.includes(source.id)
                    ? 'bg-elvora-purple/15 border border-elvora-purple/40 text-white'
                    : 'bg-elvora-bg-alt border border-elvora-border text-elvora-text-dim'
                } disabled:opacity-50`}
              >
                {selectedSources.includes(source.id) && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {source.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={autoEnrich} onChange={(e) => setAutoEnrich(e.target.checked)} className="w-4 h-4 rounded bg-elvora-bg-alt border-elvora-border" />
            <span className="text-xs text-elvora-text-muted">Auto-Enrichment (E-Mail & Telefon via Impressum)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={deepScan} onChange={(e) => setDeepScan(e.target.checked)} className="w-4 h-4 rounded bg-elvora-bg-alt border-elvora-border" />
            <span className="text-xs text-elvora-text-muted">Tiefenscan — alle Seiten + Stadtteile durchsuchen</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {(phase === 'config' || phase === 'done') && (
            <button
              onClick={startScraping}
              disabled={!keyword.trim() || (searchMode !== 'germany' && !city.trim()) || selectedSources.length === 0}
              className="px-6 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Scrapen
            </button>
          )}
          {phase === 'scraping' && (
            <button
              onClick={stop}
              className="px-5 py-2.5 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-500 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Stoppen
            </button>
          )}
        </div>
      </div>

      {/* Live-Konsole */}
      {logs.length > 0 && (
        <div className="card rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-elvora-border bg-elvora-bg-alt/50">
            <div className={`w-2 h-2 rounded-full ${phase === 'scraping' ? 'bg-green-400 animate-pulse' : 'bg-elvora-text-dim'}`} />
            <span className="text-xs font-mono text-elvora-text-dim">Konsole</span>
            <span className="text-[10px] text-elvora-text-dim ml-auto">
              {phase === 'scraping' ? 'Scraping...' : logs.length + ' Zeilen'}
            </span>
          </div>
          <div
            ref={consoleRef}
            className="px-4 py-3 max-h-80 overflow-y-auto font-mono text-[11px] leading-[1.7] bg-[#0a0a12]"
          >
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-elvora-text-dim/40 shrink-0">{log.time}</span>
                <span className={`shrink-0 w-16 ${
                  log.source === 'System' ? 'text-elvora-purple-light' :
                  log.source === 'Maps' || log.source.startsWith('Google') ? 'text-blue-400' :
                  log.source === 'Portal' || log.source.startsWith('Branch') || log.source.startsWith('Branc') ? 'text-yellow-400' :
                  log.source === 'Web' || log.source.startsWith('Web') ? 'text-orange-400' : 'text-elvora-text-dim'
                }`}>[{log.source.substring(0, 7)}]</span>
                <span className={
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-green-400' :
                  log.type === 'warn' ? 'text-yellow-400' :
                  'text-elvora-text/80'
                }>{log.message}</span>
              </div>
            ))}
            {phase === 'scraping' && (
              <div className="text-elvora-text-dim animate-pulse">_</div>
            )}
          </div>
        </div>
      )}

      {/* Live Stats */}
      {(phase === 'scraping' || results.length > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{totalFound.toLocaleString('de-DE')}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Gefunden</div>
          </div>
          <div className="card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-elvora-success">{totalImported.toLocaleString('de-DE')}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Neu importiert</div>
          </div>
          <div className="card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-elvora-warning">{totalDuplicates.toLocaleString('de-DE')}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Duplikate</div>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="card rounded-xl p-5">
        <h3 className="text-white text-sm font-semibold mb-3">Einzelne Scraper</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <a href="/scraper" className="p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors text-white text-sm font-medium">Maps Scraper</a>
          <a href="/linkedin-scraper" className="p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors text-white text-sm font-medium">Entscheider-Finder</a>
          <a href="/email-finder" className="p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors text-white text-sm font-medium">Email-Finder</a>
          <a href="/lead-pool" className="p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/30 transition-colors text-white text-sm font-medium">Lead-Pool</a>
        </div>
      </div>
    </div>
  );
}
