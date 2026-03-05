'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';

interface PoolLead {
  id: number;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  city: string;
  score: number;
  status: string;
  contact_status: string;
  rating: string;
  problems: string | null;
  seo_issues: string | null;
  found_via_keywords: string | null;
  times_found: number;
  created_at: string;
  updated_at: string;
}

type SortField = 'score' | 'name' | 'city' | 'created_at' | 'times_found';
type CategoryType = 'status' | 'city' | 'keyword';
type ViewMode = 'categories' | 'leads';

interface CategoryItem {
  type: CategoryType;
  key: string;
  label: string;
  count: number;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export default function LeadPoolPage() {
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [cities, setCities] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const pageSize = 50;

  // Category data
  const [statusCounts, setStatusCounts] = useState<{ status: string; count: number }[]>([]);
  const [cityCounts, setCityCounts] = useState<{ city: string; count: number }[]>([]);
  const [keywordsWithCounts, setKeywordsWithCounts] = useState<{ keyword: string; count: number }[]>([]);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [activeCategory, setActiveCategory] = useState<CategoryItem | null>(null);
  const [categoryTab, setCategoryTab] = useState<'status' | 'cities' | 'keywords'>('status');

  // Filters for lead view
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Bulk action feedback
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Website analysis
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ current: number; total: number } | null>(null);
  const [analyzingLeadId, setAnalyzingLeadId] = useState<number | null>(null);
  const [expandedLead, setExpandedLead] = useState<number | null>(null);

  const metaLoaded = useRef(false);

  // Debounce search
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(searchTimeout.current);
  }, [search]);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));
      params.set('sort', sortBy);
      params.set('dir', sortDir);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterCity) params.set('city', filterCity);
      if (filterStatus) params.set('status', filterStatus);
      if (filterKeyword) params.set('keyword', filterKeyword);
      if (!metaLoaded.current) params.set('include_meta', '1');

      const res = await fetch(`/api/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        if (data.cities) { setCities(data.cities); metaLoaded.current = true; }
        if (data.keywords) setKeywordsWithCounts(data.keywords);
        if (data.statusCounts) setStatusCounts(data.statusCounts);
        if (data.cityCounts) setCityCounts(data.cityCounts);
        setApiError(null);
      } else {
        const errData = await res.json().catch(() => ({}));
        setApiError(`API Fehler ${res.status}: ${errData.error || res.statusText}`);
      }
    } catch (e) { setApiError(`Netzwerkfehler: ${e instanceof Error ? e.message : 'Unbekannt'}`); }
    finally { setLoading(false); }
  }, [page, sortBy, sortDir, debouncedSearch, filterCity, filterStatus, filterKeyword]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Open a category -> switch to leads view with that filter
  const openCategory = (cat: CategoryItem) => {
    setActiveCategory(cat);
    setViewMode('leads');
    setPage(0);
    setSelected(new Set());
    setSelectAll(false);
    setSearch('');

    if (cat.type === 'status') {
      setFilterStatus(cat.key);
      setFilterCity('');
      setFilterKeyword('');
    } else if (cat.type === 'city') {
      setFilterCity(cat.key);
      setFilterStatus('');
      setFilterKeyword('');
    } else if (cat.type === 'keyword') {
      setFilterKeyword(cat.key);
      setFilterStatus('');
      setFilterCity('');
    }
  };

  // Back to categories
  const backToCategories = () => {
    setViewMode('categories');
    setActiveCategory(null);
    setFilterStatus('');
    setFilterCity('');
    setFilterKeyword('');
    setSearch('');
    setPage(0);
    setSelected(new Set());
    setSelectAll(false);
    // Reload metadata
    metaLoaded.current = false;
    loadLeads();
  };

  // Selection handlers
  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelected(new Set());
    } else {
      setSelected(new Set(leads.map(l => l.id)));
    }
    setSelectAll(!selectAll);
  };

  // Bulk actions
  const bulkUpdateStatus = async (status: string) => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      });
      if (res.ok) {
        const data = await res.json();
        setBulkMessage({ type: 'success', text: `${data.updated} Leads aktualisiert` });
        setSelected(new Set());
        setSelectAll(false);
        loadLeads();
      } else {
        setBulkMessage({ type: 'error', text: 'Fehler beim Aktualisieren' });
      }
    } catch { setBulkMessage({ type: 'error', text: 'Netzwerkfehler' }); }
    finally {
      setBulkLoading(false);
      setTimeout(() => setBulkMessage(null), 3000);
    }
  };

  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`${selected.size} Lead(s) wirklich löschen? Das kann nicht rückgängig gemacht werden.`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/leads/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (res.ok) {
        const data = await res.json();
        setBulkMessage({ type: 'success', text: `${data.deleted} Leads gelöscht` });
        setSelected(new Set());
        setSelectAll(false);
        loadLeads();
      } else {
        setBulkMessage({ type: 'error', text: 'Fehler beim Löschen' });
      }
    } catch { setBulkMessage({ type: 'error', text: 'Netzwerkfehler' }); }
    finally {
      setBulkLoading(false);
      setTimeout(() => setBulkMessage(null), 3000);
    }
  };

  const exportCsv = () => {
    const csvHeaders = ['Name', 'Website', 'Telefon', 'E-Mail', 'Stadt', 'Score', 'Status', 'Keywords', 'Erstellt'];
    const rows = leads.map(l => [
      l.name, l.website || '', l.phone || '', l.email || '', l.city,
      String(l.score), l.status, l.found_via_keywords || '', l.created_at,
    ]);
    const csv = [csvHeaders, ...rows]
      .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-pool-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Analyze all unscored leads (in current category if filtered)
  const analyzeAll = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    setBulkMessage(null);
    try {
      // Pass current filters so only leads in the active category are analyzed
      const analyzeParams = new URLSearchParams();
      if (filterCity) analyzeParams.set('city', filterCity);
      if (filterStatus) analyzeParams.set('status', filterStatus);
      if (filterKeyword) analyzeParams.set('keyword', filterKeyword);
      const statsRes = await fetch(`/api/analyze?${analyzeParams}`);
      const statsData = await statsRes.json();
      const pendingIds: number[] = statsData.pendingIds || [];
      if (pendingIds.length === 0) {
        setBulkMessage({ type: 'success', text: 'Alle Leads mit Website sind bereits analysiert!' });
        setAnalyzing(false);
        setTimeout(() => setBulkMessage(null), 5000);
        return;
      }
      setAnalyzeProgress({ current: 0, total: pendingIds.length });
      let analyzed = 0;
      let errors = 0;
      let totalScore = 0;
      for (let i = 0; i < pendingIds.length; i++) {
        setAnalyzeProgress({ current: i + 1, total: pendingIds.length });
        try {
          const res = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leadId: pendingIds[i] }),
          });
          const data = await res.json();
          if (res.ok && data.success) { analyzed++; totalScore += data.analysis.score; }
          else { errors++; }
        } catch { errors++; }
        if ((i + 1) % 5 === 0) loadLeads();
      }
      const avgScore = analyzed > 0 ? Math.round(totalScore / analyzed) : 0;
      setBulkMessage({
        type: 'success',
        text: `${analyzed} Websites analysiert (Durchschnitt: ${avgScore}/100)${errors > 0 ? ` - ${errors} Fehler` : ''}`,
      });
      loadLeads();
    } catch { setBulkMessage({ type: 'error', text: 'Netzwerkfehler bei Analyse' }); }
    finally {
      setAnalyzing(false);
      setAnalyzeProgress(null);
      setTimeout(() => setBulkMessage(null), 10000);
    }
  };

  const analyzeSingle = async (leadId: number) => {
    if (analyzingLeadId) return;
    setAnalyzingLeadId(leadId);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBulkMessage({ type: 'success', text: `${data.lead.name}: Score ${data.analysis.score}/100` });
        loadLeads();
      } else {
        setBulkMessage({ type: 'error', text: data.error || 'Analyse fehlgeschlagen' });
      }
    } catch { setBulkMessage({ type: 'error', text: 'Netzwerkfehler' }); }
    finally {
      setAnalyzingLeadId(null);
      setTimeout(() => setBulkMessage(null), 5000);
    }
  };

  const parseProblems = (problemsJson: string | null): { id: string; label: string; severity: string }[] => {
    if (!problemsJson) return [];
    try { return JSON.parse(problemsJson); } catch { return []; }
  };

  const parseSeoIssues = (seoJson: string | null): { id: string; label: string; impact: string }[] => {
    if (!seoJson) return [];
    try { return JSON.parse(seoJson); } catch { return []; }
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir(field === 'name' || field === 'city' ? 'asc' : 'desc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <span className="text-elvora-text-dim ml-1 opacity-0 group-hover:opacity-50">&#x25B2;</span>;
    return <span className="text-elvora-primary ml-1">{sortDir === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  const statusConfig: Record<string, { label: string; icon: string; color: string; bgColor: string; borderColor: string }> = {
    pending: { label: 'Neue Leads', icon: 'M12 6v6m0 0v6m0-6h6m-6 0H6', color: 'text-blue-400', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
    akquise: { label: 'In Akquise', icon: 'M17 8l4 4m0 0l-4 4m4-4H3', color: 'text-elvora-accent', bgColor: 'bg-elvora-accent/10', borderColor: 'border-elvora-accent/20' },
    qualified: { label: 'Qualifiziert', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'text-elvora-success', bgColor: 'bg-elvora-success/10', borderColor: 'border-elvora-success/20' },
    rejected: { label: 'Abgelehnt', icon: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636', color: 'text-red-400', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/20' },
    archived: { label: 'Archiviert', icon: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4', color: 'text-elvora-text-dim', bgColor: 'bg-white/5', borderColor: 'border-white/10' },
  };

  const totalLeads = statusCounts.reduce((sum, s) => sum + s.count, 0);
  const totalPages = Math.ceil(total / pageSize);

  // Build category items
  const statusCategories: CategoryItem[] = Object.entries(statusConfig).map(([key, cfg]) => ({
    type: 'status' as CategoryType,
    key,
    label: cfg.label,
    count: statusCounts.find(s => s.status === key)?.count || 0,
    icon: cfg.icon,
    color: cfg.color,
    bgColor: cfg.bgColor,
    borderColor: cfg.borderColor,
  })).filter(c => c.count > 0);

  const cityCategories: CategoryItem[] = cityCounts.map(c => ({
    type: 'city' as CategoryType,
    key: c.city,
    label: c.city,
    count: c.count,
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
    color: 'text-elvora-primary',
    bgColor: 'bg-elvora-primary/10',
    borderColor: 'border-elvora-primary/20',
  }));

  const keywordCategories: CategoryItem[] = keywordsWithCounts.map(k => ({
    type: 'keyword' as CategoryType,
    key: k.keyword,
    label: k.keyword,
    count: k.count,
    icon: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
    color: 'text-elvora-pink-light',
    bgColor: 'bg-elvora-pink/10',
    borderColor: 'border-elvora-pink/20',
  }));

  // ─── CATEGORY VIEW ──────────────────────────────────────────────────────────
  if (viewMode === 'categories') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Lead-Pool</h1>
            <p className="text-sm text-elvora-text-dim mt-1">
              {totalLeads.toLocaleString('de-DE')} Leads in {statusCategories.length} Kategorien
            </p>
          </div>
          <div className="flex items-center gap-2">
            {analyzing && analyzeProgress ? (
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-elvora-primary/10 border border-elvora-primary/20">
                <div className="w-4 h-4 border-2 border-elvora-primary/30 border-t-elvora-primary rounded-full animate-spin flex-shrink-0" />
                <div className="flex flex-col gap-1 min-w-[140px]">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-elvora-primary font-semibold">{analyzeProgress.current} / {analyzeProgress.total}</span>
                    <span className="text-elvora-text-dim">{Math.round((analyzeProgress.current / analyzeProgress.total) * 100)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-elvora-primary to-elvora-accent rounded-full transition-all duration-300" style={{ width: `${(analyzeProgress.current / analyzeProgress.total) * 100}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={analyzeAll} disabled={analyzing} className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all bg-elvora-primary/20 text-elvora-primary hover:bg-elvora-primary/30 border border-elvora-primary/20 disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                Websites analysieren
              </button>
            )}
            <button
              onClick={() => {
                setViewMode('leads');
                setActiveCategory(null);
                setFilterStatus('');
                setFilterCity('');
                setFilterKeyword('');
              }}
              className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all bg-white/5 text-elvora-text-muted hover:bg-white/10 hover:text-white border border-white/10"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Alle anzeigen
            </button>
          </div>
        </div>

        {/* Messages */}
        {apiError && (
          <div className="p-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">{apiError}</div>
        )}
        {bulkMessage && (
          <div className={`p-3 rounded-xl text-sm ${bulkMessage.type === 'success' ? 'bg-elvora-success/10 border border-elvora-success/20 text-elvora-success' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {bulkMessage.text}
          </div>
        )}

        {/* Category Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10 pb-0">
          {[
            { id: 'status' as const, label: 'Nach Status', count: statusCategories.length },
            { id: 'cities' as const, label: 'Nach Stadt', count: cityCategories.length },
            { id: 'keywords' as const, label: 'Nach Keyword', count: keywordCategories.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCategoryTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium transition-all relative ${
                categoryTab === tab.id
                  ? 'text-white'
                  : 'text-elvora-text-dim hover:text-elvora-text-muted'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                categoryTab === tab.id ? 'bg-elvora-primary/20 text-elvora-primary' : 'bg-white/5 text-elvora-text-dim'
              }`}>
                {tab.count}
              </span>
              {categoryTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-elvora-primary rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Category Grid */}
        {loading && statusCounts.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-elvora-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(categoryTab === 'status' ? statusCategories : categoryTab === 'cities' ? cityCategories : keywordCategories).map(cat => (
              <button
                key={`${cat.type}-${cat.key}`}
                onClick={() => openCategory(cat)}
                className={`group relative p-4 rounded-xl border transition-all duration-200 text-left hover:scale-[1.02] hover:shadow-lg ${cat.bgColor} ${cat.borderColor} hover:bg-opacity-20`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${cat.bgColor} flex items-center justify-center`}>
                      <svg className={`w-5 h-5 ${cat.color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cat.icon} />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white group-hover:text-white/90 truncate max-w-[140px]">{cat.label}</h3>
                      <p className={`text-xs ${cat.color} mt-0.5`}>{cat.count.toLocaleString('de-DE')} Leads</p>
                    </div>
                  </div>
                  <svg className="w-4 h-4 text-elvora-text-dim group-hover:text-white/50 transition-all group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Progress bar showing proportion of total */}
                <div className="mt-3 w-full h-1 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      cat.color.includes('blue') ? 'bg-blue-400/60' :
                      cat.color.includes('accent') ? 'bg-elvora-accent/60' :
                      cat.color.includes('success') ? 'bg-elvora-success/60' :
                      cat.color.includes('red') ? 'bg-red-400/60' :
                      cat.color.includes('pink') ? 'bg-elvora-pink/60' :
                      cat.color.includes('primary') ? 'bg-elvora-primary/60' :
                      'bg-white/20'
                    }`}
                    style={{ width: `${totalLeads > 0 ? Math.max(2, (cat.count / totalLeads) * 100) : 0}%` }}
                  />
                </div>
              </button>
            ))}

            {(categoryTab === 'status' ? statusCategories : categoryTab === 'cities' ? cityCategories : keywordCategories).length === 0 && (
              <div className="col-span-full py-12 text-center text-elvora-text-dim text-sm">
                Keine Kategorien vorhanden.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── LEADS VIEW ─────────────────────────────────────────────────────────────
  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'Neu', color: 'bg-blue-500/15 text-blue-400' },
    akquise: { label: 'Akquise', color: 'bg-elvora-accent/15 text-elvora-accent' },
    qualified: { label: 'Qualifiziert', color: 'bg-elvora-success/15 text-elvora-success' },
    rejected: { label: 'Abgelehnt', color: 'bg-red-500/15 text-red-400' },
    archived: { label: 'Archiviert', color: 'bg-white/5 text-elvora-text-dim' },
  };

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={backToCategories}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-elvora-text-dim hover:text-white hover:bg-white/10 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              {activeCategory ? (
                <>
                  <span className={activeCategory.color}>{activeCategory.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${activeCategory.bgColor} ${activeCategory.color} ${activeCategory.borderColor} border`}>
                    {total.toLocaleString('de-DE')}
                  </span>
                </>
              ) : (
                <>Alle Leads <span className="text-sm font-normal text-elvora-text-dim">({total.toLocaleString('de-DE')})</span></>
              )}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {analyzing && analyzeProgress ? (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-elvora-primary/10 border border-elvora-primary/20">
              <div className="w-4 h-4 border-2 border-elvora-primary/30 border-t-elvora-primary rounded-full animate-spin flex-shrink-0" />
              <div className="flex flex-col gap-1 min-w-[120px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-elvora-primary font-semibold">{analyzeProgress.current}/{analyzeProgress.total}</span>
                  <span className="text-elvora-text-dim">{Math.round((analyzeProgress.current / analyzeProgress.total) * 100)}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-elvora-primary to-elvora-accent rounded-full transition-all duration-300" style={{ width: `${(analyzeProgress.current / analyzeProgress.total) * 100}%` }} />
                </div>
              </div>
            </div>
          ) : (
            <button onClick={analyzeAll} disabled={analyzing} className="px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all bg-elvora-primary/20 text-elvora-primary hover:bg-elvora-primary/30 border border-elvora-primary/20 disabled:opacity-50">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              Analysieren
            </button>
          )}
          <button onClick={exportCsv} className="px-3 py-2 rounded-xl bg-elvora-success/20 text-elvora-success hover:bg-elvora-success/30 transition-colors text-xs font-medium flex items-center gap-2">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            CSV
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <svg className="w-4 h-4 text-elvora-text-dim absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche nach Name, Stadt, Website..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-elvora-bg border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 focus:border-elvora-primary/50 transition-all"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-elvora-text-dim hover:text-white">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="card-glass p-3 border border-elvora-primary/20 flex items-center gap-3 animate-fade-in flex-wrap">
          <span className="text-sm font-semibold text-white">{selected.size} ausgewählt</span>
          <div className="flex-1" />
          <button onClick={() => bulkUpdateStatus('akquise')} disabled={bulkLoading} className="px-3 py-1.5 rounded-lg bg-elvora-accent/15 text-elvora-accent text-xs font-semibold border border-elvora-accent/20 hover:bg-elvora-accent/25 transition-all disabled:opacity-50">Akquise</button>
          <button onClick={() => bulkUpdateStatus('qualified')} disabled={bulkLoading} className="px-3 py-1.5 rounded-lg bg-elvora-success/15 text-elvora-success text-xs font-semibold border border-elvora-success/20 hover:bg-elvora-success/25 transition-all disabled:opacity-50">Qualifizieren</button>
          <button onClick={() => bulkUpdateStatus('rejected')} disabled={bulkLoading} className="px-3 py-1.5 rounded-lg bg-elvora-warning/15 text-elvora-warning text-xs font-semibold border border-elvora-warning/20 hover:bg-elvora-warning/25 transition-all disabled:opacity-50">Ablehnen</button>
          <button onClick={() => bulkUpdateStatus('archived')} disabled={bulkLoading} className="px-3 py-1.5 rounded-lg bg-white/5 text-elvora-text-muted text-xs font-semibold border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50">Archiv</button>
          <button onClick={bulkDelete} disabled={bulkLoading} className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold border border-red-500/20 hover:bg-red-500/25 transition-all disabled:opacity-50">Löschen</button>
          <button onClick={() => { setSelected(new Set()); setSelectAll(false); }} className="px-2 py-1.5 rounded-lg text-elvora-text-dim hover:text-white text-xs transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Messages */}
      {apiError && <div className="p-3 rounded-xl text-sm bg-red-500/10 border border-red-500/20 text-red-400">{apiError}</div>}
      {bulkMessage && (
        <div className={`p-3 rounded-xl text-sm ${bulkMessage.type === 'success' ? 'bg-elvora-success/10 border border-elvora-success/20 text-elvora-success' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
          {bulkMessage.text}
        </div>
      )}

      {/* Lead Table */}
      <div className="card-glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-3 py-3 text-left w-10">
                  <input type="checkbox" checked={selectAll && leads.length > 0} onChange={toggleSelectAll} className="rounded border-white/20 bg-white/5 text-elvora-primary focus:ring-elvora-primary/50 cursor-pointer" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group" onClick={() => handleSort('name')}>
                  Firma <SortIcon field="name" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Kontakt</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group" onClick={() => handleSort('city')}>
                  Stadt <SortIcon field="city" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group" onClick={() => handleSort('score')}>
                  Score <SortIcon field="score" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group" onClick={() => handleSort('created_at')}>
                  Erstellt <SortIcon field="created_at" />
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-elvora-text-dim uppercase tracking-wider">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && leads.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center"><div className="w-6 h-6 border-2 border-elvora-primary border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-elvora-text-dim text-sm">Keine Leads gefunden.</td></tr>
              ) : leads.map(lead => {
                const st = statusLabels[lead.status] || statusLabels.pending;
                return (
                  <React.Fragment key={lead.id}>
                    <tr className={`hover:bg-white/[0.02] transition-colors ${selected.has(lead.id) ? 'bg-elvora-primary/5' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded border-white/20 bg-white/5 text-elvora-primary focus:ring-elvora-primary/50 cursor-pointer" />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-white font-medium text-sm block truncate max-w-[200px]">{lead.name}</span>
                        {lead.website && (
                          <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-elvora-primary text-[11px] hover:underline truncate block max-w-[200px]">
                            {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          {lead.phone && <a href={`tel:${lead.phone}`} className="text-elvora-text-muted text-xs hover:text-elvora-primary block truncate max-w-[140px]">{lead.phone}</a>}
                          {lead.email && <a href={`mailto:${lead.email}`} className="text-elvora-text-muted text-xs hover:text-elvora-primary block truncate max-w-[140px]">{lead.email}</a>}
                          {!lead.phone && !lead.email && <span className="text-elvora-text-dim text-xs">-</span>}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-elvora-text-muted text-xs">{lead.city}</td>
                      <td className="px-3 py-2.5">
                        {lead.score > 0 ? (
                          <button
                            onClick={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all hover:scale-105 ${
                              lead.score >= 70 ? 'bg-elvora-success/15 text-elvora-success' :
                              lead.score >= 50 ? 'bg-elvora-warning/15 text-elvora-warning' :
                              lead.score >= 30 ? 'bg-orange-500/15 text-orange-400' :
                              'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {lead.score}
                            {lead.score < 40 && <span className="text-[9px]">HOT</span>}
                          </button>
                        ) : lead.website ? (
                          <button onClick={() => analyzeSingle(lead.id)} disabled={analyzingLeadId === lead.id} className="px-2 py-1 rounded-lg bg-elvora-primary/10 text-elvora-primary text-[10px] font-semibold border border-elvora-primary/20 hover:bg-elvora-primary/20 transition-all disabled:opacity-50">
                            {analyzingLeadId === lead.id ? <div className="w-3 h-3 border-2 border-elvora-primary/30 border-t-elvora-primary rounded-full animate-spin" /> : 'Prüfen'}
                          </button>
                        ) : <span className="text-elvora-text-dim text-xs">-</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-3 py-2.5 text-elvora-text-dim text-xs whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.status === 'pending' && (
                            <button
                              onClick={async () => { await fetch('/api/leads/bulk', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [lead.id], status: 'akquise' }) }); loadLeads(); }}
                              className="px-2 py-1 rounded-lg bg-elvora-accent/10 text-elvora-accent text-[11px] font-semibold border border-elvora-accent/20 hover:bg-elvora-accent/20 transition-all"
                              title="In Akquise"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </button>
                          )}
                          {lead.website && (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-lg bg-white/5 text-elvora-text-dim text-[11px] border border-white/10 hover:text-white hover:bg-white/10 transition-all" title="Website öffnen">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            </a>
                          )}
                          <button
                            onClick={async () => { if (!confirm(`"${lead.name}" wirklich löschen?`)) return; await fetch('/api/leads/bulk', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [lead.id] }) }); loadLeads(); }}
                            className="px-2 py-1 rounded-lg bg-red-500/5 text-elvora-text-dim text-[11px] border border-white/5 hover:text-red-400 hover:bg-red-500/15 hover:border-red-500/20 transition-all"
                            title="Löschen"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {/* Expandable detail row */}
                    {expandedLead === lead.id && lead.score > 0 && (
                      <tr className="bg-white/[0.02]">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <h4 className="text-[11px] font-semibold text-elvora-text-dim uppercase tracking-wider mb-2">Probleme</h4>
                              {parseProblems(lead.problems).length > 0 ? (
                                <div className="space-y-1">
                                  {parseProblems(lead.problems).map((p, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.severity === 'critical' ? 'bg-red-400' : p.severity === 'major' ? 'bg-orange-400' : 'bg-yellow-400'}`} />
                                      <span className="text-elvora-text-muted">{p.label}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-elvora-success">Keine Probleme</span>}
                            </div>
                            <div>
                              <h4 className="text-[11px] font-semibold text-elvora-text-dim uppercase tracking-wider mb-2">SEO</h4>
                              {parseSeoIssues(lead.seo_issues).length > 0 ? (
                                <div className="space-y-1">
                                  {parseSeoIssues(lead.seo_issues).map((s, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.impact === 'high' ? 'bg-red-400' : s.impact === 'medium' ? 'bg-orange-400' : 'bg-yellow-400'}`} />
                                      <span className="text-elvora-text-muted">{s.label}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-elvora-success">Keine SEO-Probleme</span>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
            <span className="text-xs text-elvora-text-dim">
              {(page * pageSize) + 1}–{Math.min((page + 1) * pageSize, total)} von {total.toLocaleString('de-DE')}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(0)} disabled={page === 0} className="px-2 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all">&laquo;</button>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-2.5 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all">&lsaquo; Zurück</button>
              <span className="px-3 py-1 text-xs text-white font-medium">{page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-2.5 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all">Weiter &rsaquo;</button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className="px-2 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all">&raquo;</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
