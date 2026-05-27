'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { CATEGORIES, ENTSCHEIDER_ROLLEN, generateEntscheiderKeywords } from '@/lib/lead-categories';

interface LinkedInResult {
  name: string;
  company: string;
  title: string;
  email: string | null;
  emailConfidence?: 'high' | 'medium' | 'low' | null;
  location: string;
  profileUrl: string;
}

interface LiveProgress {
  type: string;
  keyword?: string;
  message?: string;
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

interface ConsoleLog {
  time: string;
  msg: string;
  level: 'info' | 'warn' | 'error' | 'success';
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

type ScrapeMode = 'keyword' | 'company' | 'enrich';

interface LeadForEnrich {
  id: number;
  name: string;
  company: string | null;
  city: string;
  email: string | null;
}

export default function LinkedInScraperPage() {
  const [mode, setMode] = useState<ScrapeMode>('keyword');
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('Deutschland');
  const [maxResults, setMaxResults] = useState(0);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [smtpVerification, setSmtpVerification] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ScraperJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<number | null>(null);
  const [jobResults, setJobResults] = useState<LinkedInResult[]>([]);

  // Company mode
  const [companyNames, setCompanyNames] = useState('');

  // Enrich mode
  const [enrichLeads, setEnrichLeads] = useState<LeadForEnrich[]>([]);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ current: number; total: number; found: number } | null>(null);
  const [enrichCity, setEnrichCity] = useState('');

  // Live progress
  const [liveProgress, setLiveProgress] = useState<LiveProgress | null>(null);
  const [completedSearches, setCompletedSearches] = useState<CompletedSearch[]>([]);
  const [finalResult, setFinalResult] = useState<LiveProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([]);
  const consoleEndRef = useRef<HTMLDivElement | null>(null);
  const [kombiBranchen, setKombiBranchen] = useState('Sanitär\nElektro\nDachdecker\nMaler\nSchreiner');
  const [kombiRollen, setKombiRollen] = useState('Geschäftsführer\nInhaber\nCEO');

  // Category mode
  const [keywordMode, setKeywordMode] = useState<'manual' | 'category'>('manual');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRollen, setSelectedRollen] = useState<string[]>(['Geschäftsführer', 'Inhaber', 'CEO']);

  // Engine diagnostics
  const [engineResults, setEngineResults] = useState<{ engine: string; status: string; results: number; error?: string; latency?: number }[] | null>(null);
  const [testingEngines, setTestingEngines] = useState(false);
  const [showEngineConfig, setShowEngineConfig] = useState(false);
  const [engineSettings, setEngineSettings] = useState({ searxng_url: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  const entscheiderPresets = [
    'Geschäftsführer',
    'Inhaber',
    'CEO',
    'Managing Director',
    'Gründer',
    'Founder',
    'Geschäftsleitung',
    'Eigentümer',
  ];

  const branchenPresets = [
    'Geschäftsführer Handwerk',
    'Inhaber Sanitär Heizung',
    'Geschäftsführer Elektro',
    'Inhaber Malerbetrieb',
    'Geschäftsführer Dachdecker',
    'Inhaber Schreinerei',
    'Geschäftsführer Restaurant',
    'Inhaber Friseursalon',
    'Geschäftsführer Autowerkstatt',
    'Inhaber Zahnarztpraxis',
    'Geschäftsführer IT-Dienstleister',
    'Inhaber Immobilienmakler',
    'Geschäftsführer Bauunternehmen',
    'Inhaber Physiotherapie',
    'Geschäftsführer Steuerberater',
    'Geschäftsführer Maschinenbau',
    'Geschäftsführer Marketing Agentur',
    'CEO SaaS',
    'Founder Startup',
  ];

  const addLog = useCallback((msg: string, level: ConsoleLog['level'] = 'info') => {
    const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setConsoleLogs(prev => [...prev.slice(-200), { time, msg, level }]);
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  const sseToLog = useCallback((data: LiveProgress) => {
    switch (data.type) {
      case 'log':
        addLog(data.message || '', 'info');
        break;
      case 'batch_start':
        addLog(`Scraping gestartet — ${data.totalKeywords} Keyword(s)`, 'info');
        break;
      case 'search_start':
        addLog(`Keyword ${data.currentKeyword}/${data.totalKeywords}: "${data.keyword}"`, 'info');
        addLog('Starte parallele Suche (DuckDuckGo + Google + Bing)...', 'info');
        break;
      case 'search_progress':
        if (data.message) {
          const isWarn = data.message.includes('WARNUNG') || data.message.includes('0 Ergebnisse') || data.message.includes('blockiert') || data.message.includes('CAPTCHA');
          addLog(data.message, isWarn ? 'warn' : 'info');
        }
        break;
      case 'search_empty':
        addLog(data.message || 'Keine Profile gefunden', 'error');
        break;
      case 'search_results':
        if ((data.profilesFound || 0) > 0) {
          addLog(`${data.profilesFound} LinkedIn-Profile gefunden — starte Profil-Analyse...`, 'success');
        } else {
          addLog('0 Profile gefunden — Suchmaschinen blockieren die Server-IP', 'error');
        }
        break;
      case 'profile_fetch':
        addLog(`Profil laden: ${data.profileName || 'Unbekannt'}${data.profileCompany ? ` @ ${data.profileCompany}` : ''} (${data.currentProfile}/${data.totalProfiles})`, 'info');
        break;
      case 'profile_complete':
        if (data.hasEmail) {
          addLog(`${data.profileName} — E-Mail gefunden [${data.importStatus}]`, 'success');
        } else {
          addLog(`${data.profileName} — keine E-Mail [${data.importStatus}]`, 'info');
        }
        break;
      case 'search_complete':
        addLog(`Keyword "${data.keyword}" fertig: ${data.searchFound} gefunden, ${data.searchImported} importiert, ${data.searchDuplicates} Duplikate (${((data.searchDuration || 0) / 1000).toFixed(1)}s)`, 'success');
        break;
      case 'batch_complete':
        addLog(`FERTIG — ${data.totalFound} Profile, ${data.totalImported} importiert, ${data.totalDuplicates} Duplikate (${((data.duration || 0) / 1000).toFixed(1)}s)`, 'success');
        break;
      case 'error':
        addLog(`FEHLER: ${data.error || 'Unbekannt'}`, 'error');
        break;
    }
  }, [addLog]);

  const loadJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/scraper/linkedin');
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch { /* silent */ }
  }, []);

  const loadEngineSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const settings = data.settings || data;
        setEngineSettings({
          searxng_url: settings.searxng_url || '',
        });
      }
    } catch { /* silent */ }
  }, []);

  const testEngines = async () => {
    setTestingEngines(true);
    setEngineResults(null);
    try {
      const res = await fetch('/api/scraper/linkedin/test', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setEngineResults(data.engines);
      }
    } catch { /* silent */ }
    setTestingEngines(false);
  };

  const saveEngineSetting = async (key: string, value: string) => {
    setSavingSettings(true);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });
      setEngineSettings(prev => ({ ...prev, [key]: value }));
    } catch { /* silent */ }
    setSavingSettings(false);
  };

  useEffect(() => {
    loadJobs();
    loadEngineSettings();
  }, [loadJobs, loadEngineSettings]);

  const loadLeadsForEnrich = useCallback(async () => {
    setEnrichLoading(true);
    try {
      const params = new URLSearchParams({ limit: '200', sort: 'created_at', dir: 'desc' });
      if (enrichCity) params.set('city', enrichCity);
      const res = await fetch(`/api/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setEnrichLeads((data.leads || []).map((l: Record<string, unknown>) => ({
          id: l.id as number,
          name: l.name as string,
          company: (l.company as string) || null,
          city: l.city as string,
          email: (l.email as string) || null,
        })));
      }
    } catch { /* silent */ }
    finally { setEnrichLoading(false); }
  }, [enrichCity]);

  useEffect(() => {
    if (mode === 'enrich') loadLeadsForEnrich();
  }, [mode, loadLeadsForEnrich]);

  const startEnrich = async () => {
    const leads = enrichLeads.filter(l => l.company || l.name);
    if (leads.length === 0) return;
    setScraping(true);
    setEnrichProgress({ current: 0, total: leads.length, found: 0 });
    setError(null);
    let found = 0;
    for (let i = 0; i < leads.length; i++) {
      try {
        const res = await fetch(`/api/leads/${leads[i].id}/find-decision-maker`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoSave: true }),
        });
        const d = await res.json();
        if (d.success && d.results?.length > 0) found++;
      } catch { /* continue */ }
      setEnrichProgress({ current: i + 1, total: leads.length, found });
    }
    setEnrichProgress(null);
    setScraping(false);
    setError(null);
    setFinalResult({
      type: 'enrich_complete',
      totalFound: found,
      totalImported: found,
      totalDuplicates: 0,
      totalNoEmail: leads.length - found,
      duration: 0,
    });
  };

  const startScraping = async () => {
    // Company mode: convert company names to Entscheider search queries
    let keywordsToSearch: string[];
    if (mode === 'company') {
      const companies = companyNames.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 0);
      if (companies.length === 0) return;
      keywordsToSearch = companies.map(c => `"${c}" Geschäftsführer OR Inhaber OR CEO`);
    } else {
      if (!keyword.trim()) return;
      keywordsToSearch = keyword.split(/[,\n]+/).map(k => k.trim()).filter(k => k.length > 0);
    }

    setScraping(true);
    setFinalResult(null);
    setError(null);
    setLiveProgress(null);
    setCompletedSearches([]);
    setConsoleLogs([]);
    addLog('Verbinde mit Server...', 'info');

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch('/api/scraper/linkedin/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keywords: keywordsToSearch,
          location: location.trim(),
          maxResults,
          onlyWithEmail,
          smtpVerification,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Scraping fehlgeschlagen');
        addLog(`Server-Fehler: ${data.error || res.status}`, 'error');
        setScraping(false);
        return;
      }

      addLog('Stream verbunden — warte auf Daten...', 'success');

      const reader = res.body?.getReader();
      if (!reader) {
        setError('Stream nicht verfügbar');
        addLog('Stream konnte nicht geöffnet werden', 'error');
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
              sseToLog(data);

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
        addLog('Scraping abgebrochen', 'warn');
      } else {
        setError('Netzwerkfehler - Server nicht erreichbar');
        addLog(`Netzwerkfehler: ${err instanceof Error ? err.message : 'Server nicht erreichbar'}`, 'error');
      }
    } finally {
      setScraping(false);
      abortRef.current = null;
      addLog('Stream geschlossen', 'info');
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
    const headers = ['Name', 'Position', 'Firma', 'E-Mail', 'E-Mail Genauigkeit', 'Standort', 'LinkedIn URL'];
    const rows = results.map(r => [
      r.name,
      r.title || '',
      r.company || '',
      r.email || '',
      r.emailConfidence || '',
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

  const keywordCount = mode === 'company'
    ? companyNames.split(/[,\n]+/).filter(k => k.trim().length > 0).length
    : keyword.split(/[,\n]+/).filter(k => k.trim().length > 0).length;
  const showingResults = jobResults.length > 0;

  // Calculate overall progress
  const overallProgress = liveProgress
    ? (() => {
        const kw = Math.max(liveProgress.currentKeyword || 0, 1);
        const totalKw = liveProgress.totalKeywords || 1;
        const prof = liveProgress.currentProfile || 0;
        const totalProf = liveProgress.totalProfiles || 1;
        return ((kw - 1) / totalKw + (prof / totalProf) / totalKw) * 100;
      })()
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Entscheider-Finder</h1>
          <p className="text-xs sm:text-sm text-elvora-text-dim mt-1">
            Geschäftsführer &amp; Inhaber auf LinkedIn finden – mit E-Mail
            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">KOSTENLOS</span>
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

      {/* Mode Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {([
          { key: 'keyword' as ScrapeMode, label: 'Keyword-Suche', desc: 'Nach Rolle/Branche suchen' },
          { key: 'company' as ScrapeMode, label: 'Firmen-Suche', desc: 'GF einer bestimmten Firma finden' },
          { key: 'enrich' as ScrapeMode, label: 'Leads anreichern', desc: 'Entscheider für bestehende Leads' },
        ]).map(m => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all ${
              mode === m.key
                ? 'bg-elvora-purple text-white shadow-lg'
                : 'text-elvora-text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <div>{m.label}</div>
            <div className="text-[9px] font-normal mt-0.5 opacity-70">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* Engine Status & Config */}
      <div className="card-glass overflow-hidden border border-white/10">
        <div
          className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
          onClick={() => setShowEngineConfig(!showEngineConfig)}
        >
          <div className="flex items-center gap-3">
            <svg className="w-4 h-4 text-elvora-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold text-white">Suchmaschine</span>
            {engineSettings.searxng_url ? (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-medium">SearXNG aktiv</span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">Nicht eingerichtet</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); testEngines(); }}
              disabled={testingEngines}
              className="px-3 py-1.5 rounded-lg bg-elvora-purple/20 text-elvora-purple-light text-xs font-medium hover:bg-elvora-purple/30 transition-colors disabled:opacity-50"
            >
              {testingEngines ? 'Teste...' : 'Testen'}
            </button>
            <svg className={`w-4 h-4 text-elvora-text-dim transition-transform ${showEngineConfig ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Engine Test Results */}
        {engineResults && (
          <div className="px-4 pb-3 grid grid-cols-3 gap-2">
            {engineResults.map((e, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-center border ${
                e.status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/20' :
                e.status === 'not_configured' ? 'bg-white/[0.02] border-white/5' :
                'bg-red-500/10 border-red-500/20'
              }`}>
                <div className="text-[10px] font-medium text-elvora-text-dim">{e.engine}</div>
                <div className={`text-xs font-semibold mt-0.5 ${
                  e.status === 'ok' ? 'text-emerald-400' :
                  e.status === 'not_configured' ? 'text-elvora-text-dim' :
                  'text-red-400'
                }`}>
                  {e.status === 'ok' ? `${e.results} Treffer` :
                   e.status === 'not_configured' ? 'Nicht konfiguriert' :
                   'Blockiert'}
                </div>
                {e.latency != null && <div className="text-[9px] text-elvora-text-dim mt-0.5">{(e.latency / 1000).toFixed(1)}s</div>}
              </div>
            ))}
          </div>
        )}

        {/* Config Panel */}
        {showEngineConfig && (
          <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-4">
            {/* SearXNG — Primary */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-white">SearXNG</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Kostenlos &middot; Unbegrenzt &middot; Self-Hosted</span>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 text-xs text-emerald-300/90 leading-relaxed space-y-2">
                <p><strong>Setup (1 Befehl auf dem Server):</strong></p>
                <code className="block bg-black/30 px-3 py-2 rounded text-[11px] text-white font-mono select-all">bash scripts/setup-searxng.sh</code>
                <p className="text-elvora-text-dim">Oder manuell: <code className="text-white">docker run -d --name searxng -p 8888:8080 searxng/searxng</code></p>
              </div>

              <div>
                <label className="block text-[10px] text-elvora-text-dim mb-1">SearXNG URL</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={engineSettings.searxng_url}
                    onChange={e => setEngineSettings(prev => ({ ...prev, searxng_url: e.target.value }))}
                    placeholder="http://localhost:8888"
                    className="flex-1 px-3 py-2 rounded-lg bg-elvora-bg border border-white/10 text-sm text-white placeholder-elvora-text-dim"
                    onKeyDown={e => e.key === 'Enter' && saveEngineSetting('searxng_url', engineSettings.searxng_url)}
                  />
                  <button
                    onClick={() => saveEngineSetting('searxng_url', engineSettings.searxng_url)}
                    disabled={savingSettings}
                    className="px-4 py-2 rounded-lg bg-elvora-purple/20 text-xs text-elvora-purple-light hover:bg-elvora-purple/30 border border-elvora-purple/20 font-medium"
                  >Speichern</button>
                </div>
              </div>

              <div className="text-[10px] text-elvora-text-dim leading-relaxed bg-white/[0.02] rounded-lg p-3 border border-white/5">
                <strong className="text-white">Warum SearXNG?</strong><br/>
                DuckDuckGo, Google und Bing blockieren Anfragen von Server-IPs (CAPTCHA/403).
                SearXNG laeuft auf deinem eigenen Server, nutzt 7+ Suchmaschinen gleichzeitig,
                hat kein Limit, ist kostenlos und du bist von niemandem abhaengig.
                Perfekt fuer 10.000+ Leads am Tag.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enrich Mode */}
      {mode === 'enrich' && (
        <div className="card-glass p-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-white">Bestehende Leads anreichern</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={enrichCity}
                  onChange={e => setEnrichCity(e.target.value)}
                  placeholder="Stadt filtern..."
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white w-32"
                />
                <button onClick={loadLeadsForEnrich} className="px-3 py-1.5 rounded-lg bg-white/5 text-xs text-elvora-text-muted hover:text-white border border-white/10">Laden</button>
              </div>
            </div>
            <p className="text-xs text-elvora-text-dim mb-3">
              Durchsucht LinkedIn + Impressum für jeden Lead und speichert den Entscheider als Kontaktperson.
            </p>
            {enrichLoading ? (
              <div className="text-sm text-elvora-text-dim text-center py-8">Leads werden geladen...</div>
            ) : (
              <div className="text-xs text-elvora-text-muted mb-3">
                {enrichLeads.length} Leads geladen {enrichCity && `(Stadt: ${enrichCity})`}
              </div>
            )}
            {enrichProgress && (
              <div className="space-y-2 mb-3">
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-elvora-purple rounded-full transition-all" style={{ width: `${(enrichProgress.current / enrichProgress.total) * 100}%` }} />
                </div>
                <div className="flex justify-between text-xs text-elvora-text-dim">
                  <span>{enrichProgress.current} / {enrichProgress.total} Leads</span>
                  <span className="text-elvora-success">{enrichProgress.found} Entscheider gefunden</span>
                </div>
              </div>
            )}
            <button
              onClick={startEnrich}
              disabled={scraping || enrichLeads.length === 0}
              className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                !scraping && enrichLeads.length > 0
                  ? 'bg-elvora-purple text-white hover:bg-elvora-purple/80'
                  : 'bg-white/5 text-elvora-text-dim cursor-not-allowed'
              }`}
            >
              {scraping ? `Anreichern... (${enrichProgress?.current || 0}/${enrichProgress?.total || 0})` : `${enrichLeads.length} Leads anreichern`}
            </button>
          </div>
        </div>
      )}

      {/* Search Form (keyword + company modes) */}
      {mode !== 'enrich' && (
      <div className="card-glass p-6 space-y-5">
        {mode === 'keyword' ? (
          <>
            {/* Manual / Category Toggle */}
            <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
              <button
                onClick={() => setKeywordMode('category')}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                  keywordMode === 'category' ? 'bg-elvora-purple text-white shadow' : 'text-elvora-text-muted hover:text-white'
                }`}
              >
                Kategorien
              </button>
              <button
                onClick={() => setKeywordMode('manual')}
                className={`flex-1 py-2 px-3 rounded-md text-xs font-semibold transition-all ${
                  keywordMode === 'manual' ? 'bg-elvora-purple text-white shadow' : 'text-elvora-text-muted hover:text-white'
                }`}
              >
                Manuell
              </button>
            </div>

            {keywordMode === 'category' ? (
              <>
                {/* Category Grid */}
                <div>
                  <label className="block text-xs font-medium text-elvora-text-dim mb-2">Branchen auswählen</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {CATEGORIES.map(cat => {
                      const isSelected = selectedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCategories(prev =>
                              isSelected ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
                            );
                          }}
                          className={`p-3 rounded-xl text-left transition-all border ${
                            isSelected
                              ? 'bg-elvora-purple/20 border-elvora-purple/40 ring-1 ring-elvora-purple/30'
                              : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-white/10'
                          }`}
                        >
                          <div className={`text-sm font-semibold ${isSelected ? 'text-elvora-purple-light' : 'text-white'}`}>
                            {cat.name}
                          </div>
                          <div className="text-[10px] text-elvora-text-dim mt-1">
                            {cat.scrapeKeywords.length} Keywords
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedCategories.length > 0 && (
                    <button
                      onClick={() => setSelectedCategories(CATEGORIES.map(c => c.id))}
                      className="mt-2 text-[10px] text-elvora-text-dim hover:text-white transition-colors"
                    >
                      {selectedCategories.length === CATEGORIES.length ? 'Alle abwählen' : 'Alle auswählen'}
                    </button>
                  )}
                </div>

                {/* Rollen Selection */}
                <div>
                  <label className="block text-xs font-medium text-elvora-text-dim mb-2">Entscheider-Rollen</label>
                  <div className="flex flex-wrap gap-2">
                    {ENTSCHEIDER_ROLLEN.map(rolle => {
                      const isSelected = selectedRollen.includes(rolle);
                      return (
                        <button
                          key={rolle}
                          onClick={() => {
                            setSelectedRollen(prev =>
                              isSelected ? prev.filter(r => r !== rolle) : [...prev, rolle]
                            );
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-elvora-purple/30 text-elvora-purple-light border border-elvora-purple/40'
                              : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                          }`}
                        >
                          {rolle}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Category Preview + Generate */}
                {selectedCategories.length > 0 && selectedRollen.length > 0 && (
                  <div className="bg-elvora-purple/5 border border-elvora-purple/20 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-elvora-text-muted">
                        <span className="text-white font-semibold">{selectedRollen.length}</span> Rollen
                        {' × '}
                        <span className="text-white font-semibold">
                          {selectedCategories.reduce((sum, id) => sum + (CATEGORIES.find(c => c.id === id)?.scrapeKeywords.length || 0), 0)}
                        </span> Keywords
                        {' = '}
                        <span className="text-elvora-purple-light font-bold">
                          {generateEntscheiderKeywords(selectedCategories, selectedRollen).length}
                        </span> Suchbegriffe
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const kws = generateEntscheiderKeywords(selectedCategories, selectedRollen);
                        if (kws.length > 0) setKeyword(kws.join(', '));
                      }}
                      className="mt-3 px-4 py-2.5 rounded-lg bg-elvora-purple/20 text-elvora-purple-light text-xs font-medium hover:bg-elvora-purple/30 transition-colors w-full"
                    >
                      Keywords generieren und übernehmen
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Manual Keyword Input */}
                <div>
                  <label className="block text-sm font-medium text-elvora-text-muted mb-2">
                    Suchbegriffe <span className="text-elvora-text-dim font-normal">(mehrere mit Komma trennen)</span>
                  </label>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="z.B. Geschäftsführer Handwerk, Inhaber SHK..."
                    className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-purple/50 focus:border-elvora-purple/50 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && !scraping && startScraping()}
                  />
                </div>

                {/* Entscheider Presets */}
                <div>
                  <label className="block text-xs font-medium text-elvora-text-dim mb-2">Entscheider-Rollen</label>
                  <div className="flex flex-wrap gap-2">
                    {entscheiderPresets.map(preset => (
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
                            ? 'bg-elvora-purple/30 text-elvora-purple-light border border-elvora-purple/40'
                            : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Branche + Rolle Presets */}
                <div>
                  <label className="block text-xs font-medium text-elvora-text-dim mb-2">Branche + Entscheider</label>
                  <div className="flex flex-wrap gap-2">
                    {branchenPresets.map(preset => (
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
                            ? 'bg-elvora-pink/30 text-elvora-pink border border-elvora-pink/40'
                            : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kombinator */}
                <div className="bg-white/[0.02] rounded-xl p-4 border border-white/5">
                  <label className="block text-xs font-medium text-elvora-text-dim mb-3">Kombinator — Branche × Rolle automatisch generieren</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-elvora-text-dim mb-1.5">Branchen (eine pro Zeile)</label>
                      <textarea
                        value={kombiBranchen}
                        onChange={e => setKombiBranchen(e.target.value)}
                        placeholder={"Sanitär\nElektro\nDachdecker\nMaler"}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-elvora-text-dim mb-1.5">Rollen (eine pro Zeile)</label>
                      <textarea
                        value={kombiRollen}
                        onChange={e => setKombiRollen(e.target.value)}
                        placeholder={"Geschäftsführer\nInhaber\nCEO"}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim text-xs"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const branchen = kombiBranchen.split('\n').map(b => b.trim()).filter(Boolean);
                      const rollen = kombiRollen.split('\n').map(r => r.trim()).filter(Boolean);
                      const combos = branchen.flatMap(b => rollen.map(r => `${r} ${b}`));
                      if (combos.length > 0) setKeyword(combos.join(', '));
                    }}
                    className="mt-3 px-4 py-2 rounded-lg bg-elvora-purple/20 text-elvora-purple-light text-xs font-medium hover:bg-elvora-purple/30 transition-colors w-full"
                  >
                    {(() => {
                      const b = kombiBranchen.split('\n').filter(x => x.trim()).length;
                      const r = kombiRollen.split('\n').filter(x => x.trim()).length;
                      return `${b} Branchen × ${r} Rollen = ${b * r} Keywords generieren`;
                    })()}
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Company Names Input */}
            <div>
              <label className="block text-sm font-medium text-elvora-text-muted mb-2">
                Firmennamen <span className="text-elvora-text-dim font-normal">(einer pro Zeile oder mit Komma getrennt)</span>
              </label>
              <textarea
                value={companyNames}
                onChange={(e) => setCompanyNames(e.target.value)}
                placeholder={"Müller Heizung GmbH\nSchmidt Elektrotechnik\nBäckerei Weber..."}
                rows={5}
                className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-purple/50 focus:border-elvora-purple/50 transition-all text-sm"
              />
              <p className="text-[10px] text-elvora-text-dim mt-2">
                Sucht automatisch nach Geschäftsführer / Inhaber / CEO jeder Firma auf LinkedIn.
              </p>
            </div>
          </>
        )}

        {/* Land / Region */}
        <div>
          <label className="block text-sm font-medium text-elvora-text-muted mb-2">
            Land / Region
          </label>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={['Deutschland', 'Österreich', 'Schweiz', 'Deutschland OR Österreich OR Schweiz', 'Nordrhein-Westfalen', 'Bayern', 'Baden-Württemberg', 'Hessen', 'Niedersachsen', 'Berlin', 'Hamburg', 'München', 'Frankfurt', 'Köln', 'Düsseldorf', ''].includes(location) ? location : '__custom__'}
              onChange={(e) => { if (e.target.value !== '__custom__') setLocation(e.target.value); }}
              className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            >
              <option value="">Weltweit</option>
              <option value="Deutschland">Deutschland</option>
              <option value="Österreich">Österreich</option>
              <option value="Schweiz">Schweiz</option>
              <option value="Deutschland OR Österreich OR Schweiz">DACH</option>
              <option value="Nordrhein-Westfalen">NRW</option>
              <option value="Bayern">Bayern</option>
              <option value="Baden-Württemberg">Baden-Württemberg</option>
              <option value="Hessen">Hessen</option>
              <option value="Niedersachsen">Niedersachsen</option>
              <option value="Berlin">Berlin</option>
              <option value="Hamburg">Hamburg</option>
              <option value="München">München</option>
              <option value="Frankfurt">Frankfurt</option>
              <option value="Köln">Köln</option>
              <option value="Düsseldorf">Düsseldorf</option>
              {!['Deutschland', 'Österreich', 'Schweiz', 'Deutschland OR Österreich OR Schweiz', 'Nordrhein-Westfalen', 'Bayern', 'Baden-Württemberg', 'Hessen', 'Niedersachsen', 'Berlin', 'Hamburg', 'München', 'Frankfurt', 'Köln', 'Düsseldorf', ''].includes(location) && (
                <option value="__custom__">{location}</option>
              )}
            </select>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Oder eigene Region..."
              className="w-full px-4 py-3 rounded-xl bg-elvora-bg border border-white/10 text-white placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
          </div>
        </div>

        {/* Max Results */}
        <div>
          <label className="block text-sm font-medium text-elvora-text-muted mb-2">
            Max. Profile pro Keyword
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Alle', value: 0 },
              { label: '25', value: 25 },
              { label: '50', value: 50 },
              { label: '100', value: 100 },
              { label: '250', value: 250 },
              { label: '500', value: 500 },
              { label: '1000', value: 1000 },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setMaxResults(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  maxResults === opt.value
                    ? 'bg-blue-500/30 text-blue-400 border border-blue-500/40'
                    : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-elvora-text-dim mt-2">
            {maxResults === 0
              ? 'Scrapt ALLE verfügbaren Ergebnisse – kein Limit.'
              : `Stoppt nach ${maxResults} Profilen pro Keyword.`}
          </p>
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
        {keywordCount > 0 && (
          <div className="bg-elvora-purple/5 border border-elvora-purple/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-elvora-purple-light flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-elvora-text-muted">
                <span className="text-white font-semibold">{keywordCount}</span> {mode === 'company' ? 'Firma' : 'Keyword'}{keywordCount !== 1 ? (mode === 'company' ? 'n' : 's') : ''}
                {maxResults > 0
                  ? <> {' × '}bis zu <span className="text-white font-semibold">{maxResults}</span> Profile</>
                  : <> – <span className="text-white font-semibold">Alle</span> Ergebnisse</>
                }
                {location && <span className="text-elvora-text-dim"> in {location}</span>}
              </span>
            </div>
          </div>
        )}

        {/* SMTP Verification Toggle */}
        <div className="flex items-center justify-between bg-white/[0.03] rounded-xl p-4 border border-white/5">
          <div className="flex-1 mr-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">SMTP-Verifikation</span>
            </div>
            <p className="text-xs text-elvora-text-dim mt-1">
              E-Mail-Adressen per SMTP prüfen (genauer, aber deutlich langsamer — ~7s pro E-Mail).
            </p>
          </div>
          <button
            onClick={() => setSmtpVerification(!smtpVerification)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${
              smtpVerification ? 'bg-elvora-purple' : 'bg-white/10'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform shadow-sm ${
                smtpVerification ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Start / Cancel Button */}
        {!scraping ? (
          <button
            onClick={startScraping}
            disabled={keywordCount === 0}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-3 ${
              keywordCount > 0
                ? 'bg-elvora-gradient text-white hover:shadow-lg hover:shadow-elvora-purple/20 hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-white/5 text-elvora-text-dim cursor-not-allowed'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
            {mode === 'company' ? 'Entscheider suchen' : 'LinkedIn Scraping starten'}
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
      )}

      {/* Error Message */}
      {error && (
        <div className="card-glass border border-red-500/20 bg-red-500/5 p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="text-red-300 text-sm">{error}</span>
            </div>
          </div>
        </div>
      )}

      {/* Live Console */}
      {(scraping || consoleLogs.length > 0) && (
        <div className="card-glass overflow-hidden border border-white/10">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between bg-black/20">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-green-400">{'>'}_</span>
              <span className="text-xs font-semibold text-white">Live-Konsole</span>
              {scraping && (
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
            </div>
            {!scraping && consoleLogs.length > 0 && (
              <button
                onClick={() => setConsoleLogs([])}
                className="text-[10px] text-elvora-text-dim hover:text-white transition-colors"
              >
                Leeren
              </button>
            )}
          </div>
          <div className="bg-black/30 p-3 max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
            {consoleLogs.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-elvora-text-dim flex-shrink-0">{log.time}</span>
                <span className={
                  log.level === 'error' ? 'text-red-400' :
                  log.level === 'warn' ? 'text-amber-400' :
                  log.level === 'success' ? 'text-emerald-400' :
                  'text-elvora-text-muted'
                }>
                  {log.msg}
                </span>
              </div>
            ))}
            {scraping && consoleLogs.length === 0 && (
              <div className="text-elvora-text-dim animate-pulse">Warte auf Server-Antwort...</div>
            )}
            <div ref={consoleEndRef} />
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Genauigkeit</th>
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
                    <td className="px-4 py-3">
                      {person.emailConfidence ? (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          person.emailConfidence === 'high' ? 'bg-emerald-500/15 text-emerald-400' :
                          person.emailConfidence === 'medium' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-white/5 text-elvora-text-dim'
                        }`}>
                          {person.emailConfidence === 'high' ? 'Verifiziert' :
                           person.emailConfidence === 'medium' ? 'Wahrscheinlich' :
                           'Geschätzt'}
                        </span>
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
              let jobErrors: string[] = [];
              try { jobErrors = job.errors ? JSON.parse(job.errors) : []; } catch { /* malformed */ }
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
