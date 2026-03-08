'use client';

import { useState } from 'react';

interface KeywordResult {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  difficulty: number;
  searchIntent: string;
}

interface OrganicResult {
  position: number;
  title: string;
  url: string;
  domain: string;
  description: string;
}

interface MapsResult {
  position: number;
  title: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number;
  category: string | null;
}

interface CompetitorResult {
  domain: string;
  urls: string[];
  avgPosition: number;
  topTitle: string;
  topDescription: string;
}

interface ResearchData {
  keywords: KeywordResult[];
  serp: {
    organic: OrganicResult[];
    mapsPack: MapsResult[];
    totalResults: number;
  };
  maps: MapsResult[];
  competitors: CompetitorResult[];
  searchedAt: string;
}

type TabKey = 'keywords' | 'serp' | 'konkurrenten' | 'maps';
type SortKey = 'keyword' | 'searchVolume' | 'difficulty' | 'cpc' | 'competition';

export default function LocalSeoPage() {
  const [branche, setBranche] = useState('');
  const [stadt, setStadt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<ResearchData | null>(null);
  const [cached, setCached] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('keywords');
  const [sortKey, setSortKey] = useState<SortKey>('searchVolume');
  const [sortAsc, setSortAsc] = useState(false);

  async function handleSearch() {
    if (!branche.trim() || !stadt.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch('/api/local-seo/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branche: branche.trim(), stadt: stadt.trim() }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      setData(json.data);
      setCached(json.cached || false);
      setActiveTab('keywords');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const sortedKeywords = data?.keywords
    ? [...data.keywords].sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return sortAsc ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
      })
    : [];

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'keywords', label: 'Keywords', count: data?.keywords.length || 0 },
    { key: 'serp', label: 'SERP Ergebnisse', count: (data?.serp.organic.length || 0) + (data?.serp.mapsPack.length || 0) },
    { key: 'konkurrenten', label: 'Konkurrenten', count: data?.competitors.length || 0 },
    { key: 'maps', label: 'Google Maps', count: data?.maps.length || 0 },
  ];

  function difficultyColor(d: number): string {
    if (d <= 30) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (d <= 60) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    if (d <= 80) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    return 'bg-red-500/20 text-red-400 border-red-500/30';
  }

  function intentColor(intent: string): string {
    switch (intent) {
      case 'commercial': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'transactional': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'navigational': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  }

  function competitionLabel(level: string): string {
    switch (level) {
      case 'HIGH': return 'Hoch';
      case 'MEDIUM': return 'Mittel';
      default: return 'Niedrig';
    }
  }

  function competitionColor(level: string): string {
    switch (level) {
      case 'HIGH': return 'text-red-400';
      case 'MEDIUM': return 'text-yellow-400';
      default: return 'text-emerald-400';
    }
  }

  function renderStars(rating: number | null) {
    if (rating === null) return <span className="text-elvora-text-dim text-xs">–</span>;
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    return (
      <div className="flex items-center gap-1">
        <div className="flex">
          {[...Array(5)].map((_, i) => (
            <svg key={i} className={`w-3.5 h-3.5 ${i < full ? 'text-yellow-400' : i === full && half ? 'text-yellow-400/50' : 'text-white/10'}`} fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
        <span className="text-xs text-white/70 font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  }

  const SortIcon = ({ col }: { col: SortKey }) => (
    <svg className={`w-3 h-3 inline ml-1 transition-transform ${sortKey === col ? 'text-white' : 'text-white/30'} ${sortKey === col && sortAsc ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-white">Lokale SEO-Recherche</h1>
        <p className="text-sm text-elvora-text-dim mt-1">Keyword-Recherche und Wettbewerbsanalyse für lokale Suchergebnisse</p>
      </div>

      {/* Search Input */}
      <div className="glass rounded-xl p-4 sm:p-5 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs text-elvora-text-dim mb-1">Branche</label>
            <input
              type="text"
              value={branche}
              onChange={(e) => setBranche(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="z.B. Heizungsbau, Pflegedienst, Zahnarzt..."
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-elvora-text-dim mb-1">Stadt</label>
            <input
              type="text"
              value={stadt}
              onChange={(e) => setStadt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="z.B. Essen, Düsseldorf, München..."
              className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSearch}
              disabled={loading || !branche.trim() || !stadt.trim()}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-medium bg-elvora-gradient text-white hover:shadow-elvora-lg disabled:opacity-50 transition-all whitespace-nowrap"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Recherche läuft...
                </span>
              ) : 'Recherche starten'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
          {error}
          {error.includes('Zugangsdaten') && (
            <a href="/settings" className="ml-2 underline text-red-300 hover:text-red-200">Einstellungen öffnen</a>
          )}
        </div>
      )}

      {/* Results */}
      {data && (
        <div className="animate-fade-in">
          {/* Cache indicator */}
          {cached && (
            <div className="mb-4 flex items-center gap-2 text-xs text-elvora-text-dim">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Gecachte Ergebnisse (max. 24h alt)
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-elvora-gradient text-white shadow-elvora'
                    : 'text-elvora-text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-white/70' : 'text-elvora-text-dim'}`}>
                    ({tab.count})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Keywords Tab */}
          {activeTab === 'keywords' && (
            <div className="glass rounded-xl overflow-hidden">
              {sortedKeywords.length === 0 ? (
                <div className="p-8 text-center text-elvora-text-dim text-sm">Keine Keywords gefunden</div>
              ) : (
                <>
                  {/* Desktop Table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/5">
                          <th className="text-left px-4 py-3 text-elvora-text-dim font-medium cursor-pointer hover:text-white" onClick={() => handleSort('keyword')}>
                            Keyword <SortIcon col="keyword" />
                          </th>
                          <th className="text-right px-4 py-3 text-elvora-text-dim font-medium cursor-pointer hover:text-white" onClick={() => handleSort('searchVolume')}>
                            Suchvolumen <SortIcon col="searchVolume" />
                          </th>
                          <th className="text-center px-4 py-3 text-elvora-text-dim font-medium cursor-pointer hover:text-white" onClick={() => handleSort('difficulty')}>
                            Schwierigkeit <SortIcon col="difficulty" />
                          </th>
                          <th className="text-right px-4 py-3 text-elvora-text-dim font-medium cursor-pointer hover:text-white" onClick={() => handleSort('cpc')}>
                            CPC <SortIcon col="cpc" />
                          </th>
                          <th className="text-center px-4 py-3 text-elvora-text-dim font-medium cursor-pointer hover:text-white" onClick={() => handleSort('competition')}>
                            Wettbewerb <SortIcon col="competition" />
                          </th>
                          <th className="text-center px-4 py-3 text-elvora-text-dim font-medium">Intent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedKeywords.map((kw, i) => (
                          <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3 text-white font-medium">{kw.keyword}</td>
                            <td className="px-4 py-3 text-right text-white font-mono">{kw.searchVolume.toLocaleString('de-DE')}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold border ${difficultyColor(kw.difficulty)}`}>
                                {kw.difficulty}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-white font-mono">{kw.cpc.toFixed(2)}€</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-xs font-medium ${competitionColor(kw.competitionLevel)}`}>
                                {competitionLabel(kw.competitionLevel)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${intentColor(kw.searchIntent)}`}>
                                {kw.searchIntent}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="sm:hidden divide-y divide-white/5">
                    {sortedKeywords.map((kw, i) => (
                      <div key={i} className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-white font-medium text-sm">{kw.keyword}</span>
                          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold border ${difficultyColor(kw.difficulty)}`}>
                            {kw.difficulty}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-elvora-text-dim">Vol: <span className="text-white font-mono">{kw.searchVolume.toLocaleString('de-DE')}</span></span>
                          <span className="text-elvora-text-dim">CPC: <span className="text-white font-mono">{kw.cpc.toFixed(2)}€</span></span>
                          <span className={`${competitionColor(kw.competitionLevel)}`}>{competitionLabel(kw.competitionLevel)}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${intentColor(kw.searchIntent)}`}>
                            {kw.searchIntent}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* SERP Tab */}
          {activeTab === 'serp' && (
            <div className="space-y-4">
              {/* Maps Pack */}
              {data.serp.mapsPack.length > 0 && (
                <div className="glass rounded-xl p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <h3 className="text-sm font-semibold text-white">Maps Pack</h3>
                    <span className="text-xs text-elvora-text-dim">({data.serp.mapsPack.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {data.serp.mapsPack.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center">
                            {item.position}
                          </span>
                          <span className="text-white text-sm font-medium leading-tight">{item.title}</span>
                        </div>
                        {renderStars(item.rating)}
                        {item.reviewCount > 0 && (
                          <span className="text-xs text-elvora-text-dim ml-1">({item.reviewCount} Bewertungen)</span>
                        )}
                        <p className="text-xs text-elvora-text-dim mt-1.5 truncate">{item.address}</p>
                        {item.phone && <p className="text-xs text-elvora-text-dim">{item.phone}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Organic Results */}
              <div className="glass rounded-xl p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-white">Organische Ergebnisse</h3>
                  <span className="text-xs text-elvora-text-dim">({data.serp.organic.length})</span>
                </div>
                {data.serp.organic.length === 0 ? (
                  <p className="text-elvora-text-dim text-sm">Keine organischen Ergebnisse gefunden</p>
                ) : (
                  <div className="space-y-3">
                    {data.serp.organic.map((item, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                        <span className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 text-sm font-bold flex items-center justify-center border border-emerald-500/20">
                          #{item.position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white font-medium hover:text-elvora-purple-light transition-colors line-clamp-1">
                            {item.title}
                          </a>
                          <p className="text-xs text-emerald-400/70 truncate">{item.domain}</p>
                          <p className="text-xs text-elvora-text-dim mt-1 line-clamp-2">{item.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Competitors Tab */}
          {activeTab === 'konkurrenten' && (
            <div className="glass rounded-xl p-4 sm:p-5">
              {data.competitors.length === 0 ? (
                <p className="text-elvora-text-dim text-sm text-center py-8">Keine Konkurrenten gefunden</p>
              ) : (
                <div className="space-y-3">
                  {data.competitors.map((comp, i) => (
                    <div key={i} className="p-4 rounded-lg bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 w-7 h-7 rounded-full bg-elvora-purple/20 text-elvora-purple-light text-xs font-bold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span className="text-white font-semibold text-sm">{comp.domain}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-elvora-text-dim">
                            Ø Position: <span className="text-white font-mono font-bold">{comp.avgPosition}</span>
                          </span>
                          <span className="text-elvora-text-dim">
                            URLs: <span className="text-white font-mono">{comp.urls.length}</span>
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-elvora-text-dim line-clamp-2">{comp.topDescription}</p>
                      {comp.urls.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {comp.urls.slice(0, 3).map((url, j) => (
                            <a key={j} href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-elvora-purple-light/70 hover:text-elvora-purple-light truncate max-w-[200px] block">
                              {url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Google Maps Tab */}
          {activeTab === 'maps' && (
            <div className="glass rounded-xl p-4 sm:p-5">
              {data.maps.length === 0 ? (
                <p className="text-elvora-text-dim text-sm text-center py-8">Keine Google Maps Ergebnisse gefunden</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {data.maps.map((item, i) => (
                    <div key={i} className="p-4 rounded-lg bg-white/[0.03] border border-white/5">
                      <div className="flex items-start gap-3">
                        <span className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-bold flex items-center justify-center border border-blue-500/20">
                          {item.position}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm text-white font-medium leading-tight">{item.title}</h4>
                          {item.category && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-elvora-text-dim border border-white/5">
                              {item.category}
                            </span>
                          )}
                          <div className="mt-2">
                            {renderStars(item.rating)}
                            {item.reviewCount > 0 && (
                              <span className="text-xs text-elvora-text-dim ml-1">({item.reviewCount})</span>
                            )}
                          </div>
                          <p className="text-xs text-elvora-text-dim mt-1.5">{item.address}</p>
                          <div className="flex flex-wrap gap-3 mt-2">
                            {item.phone && (
                              <a href={`tel:${item.phone}`} className="text-xs text-blue-400 hover:text-blue-300">
                                {item.phone}
                              </a>
                            )}
                            {item.website && (
                              <a href={item.website.startsWith('http') ? item.website : `https://${item.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-elvora-purple-light hover:text-elvora-purple-light/80 truncate max-w-[180px]">
                                {item.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div className="text-center py-16">
          <svg className="w-16 h-16 mx-auto text-elvora-text-dim/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
          <p className="text-elvora-text-dim text-sm">Gib eine Branche und Stadt ein, um die lokale SEO-Recherche zu starten</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16 animate-fade-in">
          <svg className="w-12 h-12 mx-auto text-elvora-purple-light animate-spin mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-elvora-text-dim text-sm">Recherche läuft... Keywords, SERP und Maps werden abgefragt</p>
          <p className="text-elvora-text-dim/50 text-xs mt-1">Dies kann 5-15 Sekunden dauern</p>
        </div>
      )}
    </div>
  );
}
