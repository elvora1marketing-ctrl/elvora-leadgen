'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface LogEntry {
  time: string;
  source: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

interface Category {
  id: string;
  name: string;
  scrapeKeywords: string[];
}

interface ScraperJobHistory {
  id: number;
  keyword: string;
  city: string;
  found: number;
  imported: number;
  duration: string;
  status: string;
  startedAt: string;
  canResume?: boolean;
  doneSteps?: number;
  totalSteps?: number;
}

type SearchMode = 'city' | 'radius' | 'germany';
type InputMode = 'keyword' | 'category';
type Phase = 'config' | 'scraping' | 'done';

const SOURCES = [
  { id: 'maps', name: 'Google Maps', color: 'text-blue-400' },
  { id: 'branchenportal', name: 'Branchenportale', color: 'text-yellow-400' },
  { id: 'websearch', name: 'Web-Suche', color: 'text-orange-400' },
];

const QUICK_LINKS = [
  {
    href: '/scraper',
    name: 'Maps Scraper',
    description: 'Google Maps Places durchsuchen',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/linkedin-scraper',
    name: 'Entscheider-Finder',
    description: 'Ansprechpartner identifizieren',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/email-finder',
    name: 'Email-Finder',
    description: 'E-Mail-Adressen verifizieren',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/lead-pool',
    name: 'Lead-Pool',
    description: 'Alle gefundenen Leads verwalten',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
      </svg>
    ),
  },
];

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function ScraperHubPage() {
  const [keyword, setKeyword] = useState('');
  const [city, setCity] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('city');
  const [inputMode, setInputMode] = useState<InputMode>('keyword');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [radius, setRadius] = useState(50);
  const [selectedSources, setSelectedSources] = useState<string[]>(['branchenportal', 'websearch']);
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [deepScan, setDeepScan] = useState(false);
  const [proxyList, setProxyList] = useState('');
  const [showProxyField, setShowProxyField] = useState(false);
  const [phase, setPhase] = useState<Phase>('config');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [allCities, setAllCities] = useState<Array<{ name: string; state: string }>>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [stats, setStats] = useState({ totalFound: 0, imported: 0, duplicates: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' });
  const [totalLeads, setTotalLeads] = useState<number | null>(null);
  const [jobHistory, setJobHistory] = useState<ScraperJobHistory[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const connectToJobRef = useRef<((id: number) => void) | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (consoleRef.current) consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    fetch('/api/cities')
      .then(r => r.json())
      .then(data => { if (data.cities) setAllCities(data.cities); })
      .catch(() => {});
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => { if (data.categories) setCategories(data.categories); })
      .catch(() => {});

    // Fetch total lead count for header KPI
    fetch('/api/leads?limit=0')
      .then(r => r.json())
      .then(data => { if (data.total != null) setTotalLeads(data.total); })
      .catch(() => {});

    // Check for running jobs (reconnect after page reload) and load history
    fetch('/api/scraper/jobs')
      .then(r => r.json())
      .then(data => {
        if (data.jobs?.length > 0) {
          const job = data.jobs[0];
          setLogs([]);
          setStats(job.stats);
          setProgress(job.progress);
          connectToJobRef.current?.(job.id);
        }
        // Parse job history from all jobs
        if (data.history) {
          setJobHistory(data.history);
        }
      })
      .catch(() => {});
  }, []);

  // Connect to job stream with auto-reconnect
  const connectToJob = useCallback((jobId: number) => {
    if (eventSourceRef.current) eventSourceRef.current.close();
    setActiveJobId(jobId);
    setPhase('scraping');

    let reconnectAttempts = 0;
    let destroyed = false;

    function connect() {
      if (destroyed) return;
      const es = new EventSource(`/api/scraper/jobs/${jobId}/stream`);
      eventSourceRef.current = es;

      let replayBuffer: LogEntry[] = [];
      let isReplaying = true;
      const replayTimer = setTimeout(() => {
        if (replayBuffer.length > 0) {
          setLogs(replayBuffer);
          replayBuffer = [];
        }
        isReplaying = false;
      }, 500);

      es.onmessage = (event) => {
        reconnectAttempts = 0;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'log') {
            const entry: LogEntry = {
              time: formatTime(data.time),
              source: data.source,
              message: data.message,
              type: data.logType || 'info',
            };
            if (isReplaying) {
              replayBuffer.push(entry);
            } else {
              setLogs(prev => [...prev, entry]);
            }
          } else if (data.type === 'stats') {
            setStats({
              totalFound: data.totalFound || 0,
              imported: data.imported || 0,
              duplicates: data.duplicates || 0,
            });
          } else if (data.type === 'progress') {
            setProgress({ current: data.current || 0, total: data.total || 0, label: data.label || '' });
          } else if (data.type === 'done') {
            destroyed = true;
            clearTimeout(replayTimer);
            if (replayBuffer.length > 0) {
              setLogs(replayBuffer);
              replayBuffer = [];
            }
            isReplaying = false;
            setPhase('done');
            if (data.stats) {
              setStats({
                totalFound: data.stats.totalFound || 0,
                imported: data.stats.imported || 0,
                duplicates: data.stats.duplicates || 0,
              });
            }
            es.close();
            // Refresh history
            fetch('/api/scraper/jobs').then(r => r.json()).then(d => {
              if (d.history) setJobHistory(d.history);
            }).catch(() => {});
          }
        } catch { /* skip */ }
      };

      es.onerror = () => {
        es.close();
        clearTimeout(replayTimer);
        if (replayBuffer.length > 0) {
          setLogs(replayBuffer);
          replayBuffer = [];
        }
        isReplaying = false;

        if (destroyed) return;

        // Auto-reconnect — the job is still running on the server
        reconnectAttempts++;
        const delay = Math.min(2000 * reconnectAttempts, 15000);
        setTimeout(() => {
          if (destroyed) return;
          // Check if job is still running before reconnecting
          fetch(`/api/scraper/jobs`)
            .then(r => r.json())
            .then(data => {
              if (destroyed) return;
              const running = data.jobs?.find((j: { id: number }) => j.id === jobId);
              if (running) {
                connect();
              } else {
                // Job finished while we were disconnected
                setPhase('done');
                if (data.history) setJobHistory(data.history);
              }
            })
            .catch(() => {
              if (!destroyed) setTimeout(connect, 5000);
            });
        }, delay);
      };
    }

    connect();

    // Return cleanup function via ref
    const prevCleanup = cleanupRef.current;
    cleanupRef.current = () => {
      destroyed = true;
      eventSourceRef.current?.close();
      prevCleanup?.();
    };
  }, []);

  // Keep ref in sync for reconnect logic
  connectToJobRef.current = connectToJob;

  // Cleanup on unmount
  useEffect(() => {
    return () => { cleanupRef.current?.(); eventSourceRef.current?.close(); };
  }, []);

  function addLog(source: string, message: string, type: LogEntry['type'] = 'info') {
    setLogs(prev => [...prev, { time: formatTime(Date.now()), source, message, type }]);
  }

  function toggleSource(id: string) {
    setSelectedSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  }

  async function stop() {
    if (activeJobId) {
      await fetch(`/api/scraper/jobs/${activeJobId}/abort`, { method: 'POST' });
    }
    cleanupRef.current?.();
    addLog('System', 'Abgebrochen — kann ueber Job-History fortgesetzt werden.', 'warn');
    setPhase('done');
    // Refresh history so resume button appears
    fetch('/api/scraper/jobs').then(r => r.json()).then(d => {
      if (d.history) setJobHistory(d.history);
    }).catch(() => {});
  }

  const startScraping = useCallback(async () => {
    // Determine keywords
    let keywords: string[] = [];
    if (inputMode === 'category') {
      const cat = categories.find(c => c.id === selectedCategory);
      if (!cat || cat.scrapeKeywords.length === 0) return;
      keywords = cat.scrapeKeywords;
    } else {
      if (!keyword.trim()) return;
      keywords = [keyword.trim()];
    }

    // Determine cities
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
      addLog('System', 'Keine Staedte gefunden.', 'error');
      return;
    }

    setLogs([]);
    setStats({ totalFound: 0, imported: 0, duplicates: 0 });
    setProgress({ current: 0, total: 0, label: '' });

    // Start background job
    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords,
          cities: targetCities,
          sources: selectedSources,
          autoEnrich,
          deepScan,
          proxies: proxyList.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.jobId) {
        addLog('System', `Fehler: ${data.error || 'Unbekannt'}`, 'error');
        return;
      }

      // Connect to live stream
      connectToJob(data.jobId);
    } catch (err) {
      addLog('System', `Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`, 'error');
    }
  }, [keyword, city, searchMode, inputMode, selectedCategory, categories, radius, selectedSources, autoEnrich, deepScan, connectToJob, proxyList]);

  const resumeJob = useCallback(async (jobId: number) => {
    setLogs([]);
    setStats({ totalFound: 0, imported: 0, duplicates: 0 });
    setProgress({ current: 0, total: 0, label: '' });

    try {
      const res = await fetch('/api/scraper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resumeJobId: jobId,
          proxies: proxyList.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!data.jobId) {
        addLog('System', `Fehler: ${data.error || 'Unbekannt'}`, 'error');
        return;
      }

      connectToJob(data.jobId);
    } catch (err) {
      addLog('System', `Fehler: ${err instanceof Error ? err.message : 'Unbekannt'}`, 'error');
    }
  }, [connectToJob, proxyList]);

  const selectedCat = categories.find(c => c.id === selectedCategory);
  const canStart = inputMode === 'category'
    ? !!selectedCategory && (searchMode === 'germany' || !!city.trim()) && selectedSources.length > 0
    : !!keyword.trim() && (searchMode === 'germany' || !!city.trim()) && selectedSources.length > 0;

  const successRate = stats.totalFound > 0 ? Math.round((stats.imported / stats.totalFound) * 100) : 0;
  const progressPct = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;
  const estimatedTimeLeft = progress.total > 0 && progress.current > 0 && phase === 'scraping'
    ? Math.round(((progress.total - progress.current) / progress.current) * (Date.now() - (Date.now() - progress.current * 1000)) / 1000)
    : null;

  return (
    <div className="space-y-6">
      {/* Header with KPIs */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Scraper Hub</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Lead-Maschine -- Kategorien durchscrapen, alles absaugen</p>
        </div>
        <div className="flex gap-3">
          {totalLeads !== null && (
            <div className="glass rounded-xl px-4 py-2.5 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Leads gesamt</div>
              <div className="text-lg font-bold text-white">{totalLeads.toLocaleString('de-DE')}</div>
            </div>
          )}
          {stats.totalFound > 0 && (
            <div className="glass rounded-xl px-4 py-2.5 border border-elvora-success/20">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim">Erfolgsrate</div>
              <div className="text-lg font-bold text-elvora-success">{successRate}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Config */}
      <div className="card rounded-xl p-5 space-y-5">
        {/* Input Mode Toggle */}
        <div>
          <label className="block text-xs text-elvora-text-dim mb-2">Modus</label>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode('keyword')}
              disabled={phase === 'scraping'}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                inputMode === 'keyword'
                  ? 'bg-elvora-purple text-white'
                  : 'bg-elvora-bg-alt border border-elvora-border text-elvora-text-muted hover:border-elvora-purple/30'
              } disabled:opacity-50`}
            >
              Einzelnes Keyword
            </button>
            <button
              onClick={() => setInputMode('category')}
              disabled={phase === 'scraping'}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                inputMode === 'category'
                  ? 'bg-elvora-purple text-white'
                  : 'bg-elvora-bg-alt border border-elvora-border text-elvora-text-muted hover:border-elvora-purple/30'
              } disabled:opacity-50`}
            >
              Ganze Kategorie
            </button>
          </div>
        </div>

        {/* Keyword or Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {inputMode === 'keyword' ? (
              <>
                <label className="block text-xs text-elvora-text-dim mb-1.5">Keyword / Branche</label>
                <input
                  type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                  placeholder="z.B. Elektriker, Zahnarzt..."
                  disabled={phase === 'scraping'}
                  className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 disabled:opacity-50"
                />
              </>
            ) : (
              <>
                <label className="block text-xs text-elvora-text-dim mb-1.5">Kategorie</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={phase === 'scraping'}
                  className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-purple/50 disabled:opacity-50"
                >
                  <option value="">Kategorie waehlen...</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} ({cat.scrapeKeywords.length} Keywords)</option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div>
            <label className="block text-xs text-elvora-text-dim mb-1.5">
              {searchMode === 'germany' ? 'Ganz Deutschland' : 'Stadt'}
            </label>
            <input
              type="text" value={city} onChange={(e) => setCity(e.target.value)}
              placeholder={searchMode === 'germany' ? 'Nicht noetig bei Deutschland-Scan' : 'z.B. Essen, Duesseldorf...'}
              disabled={phase === 'scraping' || searchMode === 'germany'}
              className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Category Keywords Preview */}
        {inputMode === 'category' && selectedCat && (
          <div className="bg-elvora-bg-alt rounded-lg p-3 border border-elvora-border">
            <p className="text-[10px] text-elvora-text-dim mb-2">{selectedCat.scrapeKeywords.length} Keywords werden gescraped:</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedCat.scrapeKeywords.map((kw, i) => (
                <span key={i} className="px-2 py-0.5 rounded bg-elvora-bg border border-elvora-border text-[11px] text-elvora-text">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Search Mode */}
        <div>
          <label className="block text-xs text-elvora-text-dim mb-2">Gebiet</label>
          <div className="flex gap-2">
            {([
              { id: 'city' as const, label: 'Einzelne Stadt' },
              { id: 'radius' as const, label: 'Umkreis' },
              { id: 'germany' as const, label: 'Ganz Deutschland' },
            ]).map(mode => (
              <button
                key={mode.id}
                onClick={() => {
                  setSearchMode(mode.id);
                  if (mode.id === 'germany') {
                    setSelectedSources(prev => prev.filter(s => s !== 'maps'));
                  }
                }}
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
              Durchsucht ~{allCities.length || '428'}+ deutsche Staedte.
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
                    ? source.id === 'maps' ? 'bg-yellow-600/20 border border-yellow-500/40 text-white' : 'bg-elvora-purple/15 border border-elvora-purple/40 text-white'
                    : 'bg-elvora-bg-alt border border-elvora-border text-elvora-text-dim'
                } disabled:opacity-50`}
              >
                {selectedSources.includes(source.id) && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {source.name}
                {source.id === 'maps' && <span className="text-[9px] text-yellow-400">$</span>}
              </button>
            ))}
          </div>
          {selectedSources.includes('maps') && (searchMode === 'germany' || searchMode === 'radius') && (
            <p className="mt-2 text-[11px] text-yellow-400">
              Google Maps API kostet ~$32/1.000 Requests. Bei {searchMode === 'germany' ? '428 Staedten' : 'Umkreis-Scan'} wird das teuer. Web-Suche + Branchenportale sind kostenlos.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={autoEnrich} onChange={(e) => setAutoEnrich(e.target.checked)} className="w-4 h-4 rounded bg-elvora-bg-alt border-elvora-border" />
            <span className="text-xs text-elvora-text-muted">Auto-Enrichment (E-Mail & Telefon via Impressum)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={deepScan} onChange={(e) => setDeepScan(e.target.checked)} className="w-4 h-4 rounded bg-elvora-bg-alt border-elvora-border" />
            <span className="text-xs text-elvora-text-muted">Tiefenscan -- alle Seiten + Stadtteile durchsuchen</span>
          </label>
        </div>

        {/* Proxies */}
        <div>
          <button
            onClick={() => setShowProxyField(!showProxyField)}
            className="flex items-center gap-1.5 text-xs text-elvora-text-dim hover:text-elvora-text transition-colors"
          >
            <svg className={`w-3 h-3 transition-transform ${showProxyField ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Proxies (optional)
            {proxyList.trim() && (
              <span className="text-elvora-success font-medium ml-1">
                {proxyList.trim().split('\n').filter(l => l.trim() && !l.startsWith('#')).length.toLocaleString('de-DE')} aktiv
              </span>
            )}
          </button>
          {showProxyField && (
            <div className="mt-2 space-y-2">
              <textarea
                value={proxyList}
                onChange={(e) => setProxyList(e.target.value)}
                placeholder="ip:port:user:pass — eine pro Zeile"
                rows={4}
                disabled={phase === 'scraping'}
                className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-xs font-mono placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 disabled:opacity-50 resize-y"
              />
              {proxyList.trim() && (
                <p className="text-[11px] text-elvora-text-dim">
                  {proxyList.trim().split('\n').filter(l => l.trim() && !l.startsWith('#')).length.toLocaleString('de-DE')} Proxies erkannt — werden in SearXNG konfiguriert
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 items-center">
          {(phase === 'config' || phase === 'done') && (
            <button
              onClick={startScraping}
              disabled={!canStart}
              className="px-6 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-40 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Scrapen
            </button>
          )}
          {phase === 'scraping' && (
            <>
              <button
                onClick={stop}
                className="px-5 py-2.5 rounded-lg bg-red-600/80 text-white text-sm font-medium hover:bg-red-500 transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Stoppen
              </button>
              {progress.total > 0 && (
                <span className="text-xs text-elvora-text-dim">
                  {progress.current}/{progress.total} -- {progress.label}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Live Stats */}
      {(phase === 'scraping' || stats.totalFound > 0) && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats.totalFound.toLocaleString('de-DE')}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Gefunden</div>
          </div>
          <div className="card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-elvora-success">{stats.imported.toLocaleString('de-DE')}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Neu importiert</div>
          </div>
          <div className="card rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-elvora-warning">{stats.duplicates.toLocaleString('de-DE')}</div>
            <div className="text-xs text-elvora-text-dim mt-1">Duplikate</div>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {phase === 'scraping' && progress.total > 0 && (
        <div className="card rounded-xl p-4">
          <div className="flex justify-between text-xs text-elvora-text-dim mb-2">
            <span>Fortschritt</span>
            <div className="flex items-center gap-3">
              {estimatedTimeLeft !== null && estimatedTimeLeft > 0 && (
                <span className="text-elvora-text-dim">~{estimatedTimeLeft}s verbleibend</span>
              )}
              <span className="font-semibold text-white">{Math.round(progressPct)}%</span>
            </div>
          </div>
          <div className="h-3 bg-elvora-bg-alt rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full transition-all duration-300 relative overflow-hidden"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, var(--elvora-purple, #8B5CF6), var(--elvora-accent, #F97316))',
              }}
            >
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
            </div>
          </div>
          <style jsx>{`
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
          `}</style>
        </div>
      )}

      {/* Live Console */}
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
              <div
                key={i}
                className="flex gap-2"
                style={{
                  animation: phase === 'scraping' && i === logs.length - 1 ? 'fadeInLog 0.2s ease-out' : undefined,
                }}
              >
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
          <style jsx>{`
            @keyframes fadeInLog {
              from { opacity: 0; transform: translateY(4px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Quick Links - Card Style */}
      <div className="card rounded-xl p-5">
        <h3 className="text-white text-sm font-semibold mb-3">Einzelne Scraper</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_LINKS.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="group p-4 rounded-lg bg-elvora-bg-alt border border-elvora-border hover:border-elvora-purple/40 hover:bg-elvora-bg-alt/80 transition-all"
            >
              <div className="text-elvora-text-dim group-hover:text-elvora-purple-light transition-colors mb-2">
                {link.icon}
              </div>
              <div className="text-white text-sm font-medium mb-0.5">{link.name}</div>
              <div className="text-[10px] text-elvora-text-dim leading-snug">{link.description}</div>
            </a>
          ))}
        </div>
      </div>

      {/* Job History */}
      {jobHistory.length > 0 && (
        <div className="card rounded-xl p-5">
          <h3 className="text-white text-sm font-semibold mb-3">Letzte Scrape-Jobs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-elvora-text-dim border-b border-elvora-border">
                  <th className="text-left py-2 pr-3 font-medium">Keyword</th>
                  <th className="text-left py-2 px-3 font-medium">Stadt</th>
                  <th className="text-right py-2 px-3 font-medium">Gefunden</th>
                  <th className="text-right py-2 px-3 font-medium">Importiert</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-right py-2 px-3 font-medium">Dauer</th>
                  <th className="text-right py-2 pl-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {jobHistory.map((job, i) => (
                  <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                    <td className="py-2.5 pr-3 text-white font-medium">{job.keyword}</td>
                    <td className="py-2.5 px-3 text-elvora-text-muted">{job.city}</td>
                    <td className="py-2.5 px-3 text-right text-elvora-text-muted">{job.found}</td>
                    <td className="py-2.5 px-3 text-right text-elvora-success font-semibold">{job.imported}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          job.status === 'completed' ? 'bg-elvora-success/15 text-elvora-success' :
                          job.status === 'running' ? 'bg-elvora-purple/15 text-elvora-purple-light' :
                          job.status === 'error' ? 'bg-red-400/15 text-red-400' :
                          job.status === 'aborted' || job.status === 'stopped' ? 'bg-elvora-warning/15 text-elvora-warning' :
                          'bg-white/5 text-elvora-text-dim'
                        }`}>
                          {job.status === 'stopped' ? 'gestoppt' : job.status}
                        </span>
                        {job.canResume && job.totalSteps && job.totalSteps > 0 && (
                          <span className="text-[10px] text-elvora-text-dim">
                            {job.doneSteps}/{job.totalSteps}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-elvora-text-dim">{job.duration}</td>
                    <td className="py-2.5 pl-3 text-right">
                      {job.canResume && phase !== 'scraping' && (
                        <button
                          onClick={() => resumeJob(job.id)}
                          className="px-2.5 py-1 rounded-lg bg-elvora-purple/15 border border-elvora-purple/30 text-elvora-purple-light text-[10px] font-medium hover:bg-elvora-purple/25 transition-colors"
                        >
                          Fortsetzen
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
