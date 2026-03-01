'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  found_via_keywords: string | null;
  times_found: number;
  created_at: string;
  updated_at: string;
}

type SortField = 'score' | 'name' | 'city' | 'created_at' | 'times_found';

export default function LeadPoolPage() {
  const [leads, setLeads] = useState<PoolLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [cities, setCities] = useState<string[]>([]);
  const pageSize = 50;

  // Filters
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWebsite, setFilterWebsite] = useState<'' | 'yes' | 'no'>('');
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Bulk action feedback
  const [bulkMessage, setBulkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

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
      if (filterWebsite === 'yes') params.set('has_website', '1');
      if (filterWebsite === 'no') params.set('has_website', '0');
      if (filterHasPhone) params.set('has_phone', '1');
      if (filterHasEmail) params.set('has_email', '1');

      const res = await fetch(`/api/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setTotal(data.total || 0);
        if (data.cities) setCities(data.cities);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [page, sortBy, sortDir, debouncedSearch, filterCity, filterStatus, filterWebsite, filterHasPhone, filterHasEmail]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

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
        body: JSON.stringify({ ids: [...selected], status }),
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
        body: JSON.stringify({ ids: [...selected] }),
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
    const headers = ['Name', 'Website', 'Telefon', 'E-Mail', 'Stadt', 'Score', 'Status', 'Keywords', 'Erstellt'];
    const rows = leads.map(l => [
      l.name,
      l.website || '',
      l.phone || '',
      l.email || '',
      l.city,
      String(l.score),
      l.status,
      l.found_via_keywords || '',
      l.created_at,
    ]);
    const csv = [headers, ...rows]
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

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: 'Neu', color: 'bg-white/10 text-elvora-text-muted' },
    akquise: { label: 'Akquise', color: 'bg-elvora-accent/15 text-elvora-accent' },
    qualified: { label: 'Qualifiziert', color: 'bg-elvora-success/15 text-elvora-success' },
    rejected: { label: 'Abgelehnt', color: 'bg-red-500/15 text-red-400' },
    archived: { label: 'Archiviert', color: 'bg-white/5 text-elvora-text-dim' },
  };

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = debouncedSearch || filterCity || filterStatus || filterWebsite || filterHasPhone || filterHasEmail;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead-Pool</h1>
          <p className="text-sm text-elvora-text-dim mt-1">
            Alle gescrapten Firmen - {total.toLocaleString('de-DE')} Leads gesamt
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-xl bg-elvora-success/20 text-elvora-success hover:bg-elvora-success/30 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV Export
        </button>
      </div>

      {/* Search + Filters */}
      <div className="card-glass p-4 space-y-3">
        {/* Search bar */}
        <div className="relative">
          <svg className="w-4 h-4 text-elvora-text-dim absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Name, Stadt, Website, Telefon, Keywords..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-elvora-bg border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 focus:border-elvora-primary/50 transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-elvora-text-dim hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* City filter */}
          <select
            value={filterCity}
            onChange={(e) => { setFilterCity(e.target.value); setPage(0); }}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text-muted focus:outline-none cursor-pointer"
          >
            <option value="">Alle Städte</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text-muted focus:outline-none cursor-pointer"
          >
            <option value="">Alle Status</option>
            <option value="pending">Neu</option>
            <option value="akquise">Akquise</option>
            <option value="qualified">Qualifiziert</option>
            <option value="rejected">Abgelehnt</option>
            <option value="archived">Archiviert</option>
          </select>

          {/* Website filter */}
          <button
            onClick={() => { setFilterWebsite(filterWebsite === 'yes' ? '' : 'yes'); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filterWebsite === 'yes'
                ? 'bg-elvora-primary/20 text-elvora-primary border-elvora-primary/30'
                : 'bg-white/5 text-elvora-text-dim border-white/10 hover:text-white'
            }`}
          >
            Mit Website
          </button>
          <button
            onClick={() => { setFilterWebsite(filterWebsite === 'no' ? '' : 'no'); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filterWebsite === 'no'
                ? 'bg-elvora-warning/20 text-elvora-warning border-elvora-warning/30'
                : 'bg-white/5 text-elvora-text-dim border-white/10 hover:text-white'
            }`}
          >
            Ohne Website
          </button>
          <button
            onClick={() => { setFilterHasPhone(!filterHasPhone); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filterHasPhone
                ? 'bg-elvora-primary/20 text-elvora-primary border-elvora-primary/30'
                : 'bg-white/5 text-elvora-text-dim border-white/10 hover:text-white'
            }`}
          >
            Mit Telefon
          </button>
          <button
            onClick={() => { setFilterHasEmail(!filterHasEmail); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filterHasEmail
                ? 'bg-elvora-primary/20 text-elvora-primary border-elvora-primary/30'
                : 'bg-white/5 text-elvora-text-dim border-white/10 hover:text-white'
            }`}
          >
            Mit E-Mail
          </button>

          {hasFilters && (
            <button
              onClick={() => {
                setSearch(''); setFilterCity(''); setFilterStatus('');
                setFilterWebsite(''); setFilterHasPhone(false); setFilterHasEmail(false);
                setPage(0);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 transition-all"
            >
              Filter zurücksetzen
            </button>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="card-glass p-3 border border-elvora-primary/20 flex items-center gap-3 animate-fade-in">
          <span className="text-sm font-semibold text-white">{selected.size} ausgewählt</span>
          <div className="flex-1" />
          <button
            onClick={() => bulkUpdateStatus('akquise')}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-lg bg-elvora-accent/15 text-elvora-accent text-xs font-semibold border border-elvora-accent/20 hover:bg-elvora-accent/25 transition-all disabled:opacity-50"
          >
            In Akquise
          </button>
          <button
            onClick={() => bulkUpdateStatus('qualified')}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-lg bg-elvora-success/15 text-elvora-success text-xs font-semibold border border-elvora-success/20 hover:bg-elvora-success/25 transition-all disabled:opacity-50"
          >
            Qualifizieren
          </button>
          <button
            onClick={() => bulkUpdateStatus('rejected')}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-lg bg-elvora-warning/15 text-elvora-warning text-xs font-semibold border border-elvora-warning/20 hover:bg-elvora-warning/25 transition-all disabled:opacity-50"
          >
            Ablehnen
          </button>
          <button
            onClick={() => bulkUpdateStatus('archived')}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-elvora-text-muted text-xs font-semibold border border-white/10 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            Archivieren
          </button>
          <button
            onClick={bulkDelete}
            disabled={bulkLoading}
            className="px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold border border-red-500/20 hover:bg-red-500/25 transition-all disabled:opacity-50"
          >
            Löschen
          </button>
          <button
            onClick={() => { setSelected(new Set()); setSelectAll(false); }}
            className="px-2 py-1.5 rounded-lg text-elvora-text-dim hover:text-white text-xs transition-all"
          >
            Abbrechen
          </button>
        </div>
      )}

      {/* Bulk action message */}
      {bulkMessage && (
        <div className={`p-3 rounded-xl text-sm animate-fade-in ${
          bulkMessage.type === 'success'
            ? 'bg-elvora-success/10 border border-elvora-success/20 text-elvora-success'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {bulkMessage.text}
        </div>
      )}

      {/* Table */}
      <div className="card-glass overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    checked={selectAll && leads.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-white/20 bg-white/5 text-elvora-primary focus:ring-elvora-primary/50 cursor-pointer"
                  />
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group"
                  onClick={() => handleSort('name')}
                >
                  Firma <SortIcon field="name" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">
                  Kontakt
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group"
                  onClick={() => handleSort('city')}
                >
                  Stadt <SortIcon field="city" />
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group"
                  onClick={() => handleSort('score')}
                >
                  Score <SortIcon field="score" />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider">
                  Keywords
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group"
                  onClick={() => handleSort('times_found')}
                >
                  Gefunden <SortIcon field="times_found" />
                </th>
                <th
                  className="px-3 py-3 text-left text-xs font-medium text-elvora-text-dim uppercase tracking-wider cursor-pointer hover:text-white group"
                  onClick={() => handleSort('created_at')}
                >
                  Erstellt <SortIcon field="created_at" />
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium text-elvora-text-dim uppercase tracking-wider">
                  Aktion
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <div className="w-6 h-6 border-2 border-elvora-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-elvora-text-dim text-sm">
                    {hasFilters ? 'Keine Leads mit diesen Filtern gefunden.' : 'Noch keine Leads vorhanden. Starte einen Scraping-Job!'}
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const st = statusLabels[lead.status] || statusLabels.pending;
                  return (
                    <tr key={lead.id} className={`hover:bg-white/[0.02] transition-colors ${selected.has(lead.id) ? 'bg-elvora-primary/5' : ''}`}>
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selected.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                          className="rounded border-white/20 bg-white/5 text-elvora-primary focus:ring-elvora-primary/50 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-white font-medium text-sm block truncate max-w-[200px]">{lead.name}</span>
                        {lead.website && (
                          <a
                            href={lead.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-elvora-primary text-[11px] hover:underline truncate block max-w-[200px]"
                          >
                            {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                          </a>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="text-elvora-text-muted text-xs hover:text-elvora-primary block truncate max-w-[140px]">
                              {lead.phone}
                            </a>
                          )}
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="text-elvora-text-muted text-xs hover:text-elvora-primary block truncate max-w-[140px]">
                              {lead.email}
                            </a>
                          )}
                          {!lead.phone && !lead.email && (
                            <span className="text-elvora-text-dim text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-elvora-text-muted text-xs">{lead.city}</td>
                      <td className="px-3 py-2.5">
                        {lead.score > 0 ? (
                          <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${
                            lead.score >= 85 ? 'bg-red-500/15 text-red-400' :
                            lead.score >= 70 ? 'bg-elvora-warning/15 text-elvora-warning' :
                            lead.score >= 50 ? 'bg-elvora-primary/15 text-elvora-primary' :
                            'bg-white/5 text-elvora-text-dim'
                          }`}>
                            {lead.score}
                          </div>
                        ) : (
                          <span className="text-elvora-text-dim text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${st.color}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {lead.found_via_keywords ? (
                          <span className="text-[11px] text-elvora-text-dim truncate block max-w-[160px]" title={lead.found_via_keywords}>
                            {lead.found_via_keywords}
                          </span>
                        ) : (
                          <span className="text-elvora-text-dim text-xs">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {lead.times_found > 1 ? (
                          <span className="px-1.5 py-0.5 rounded text-[11px] font-bold bg-elvora-accent/15 text-elvora-accent">
                            {lead.times_found}x
                          </span>
                        ) : (
                          <span className="text-elvora-text-dim text-xs">1x</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-elvora-text-dim text-xs whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString('de-DE', {
                          day: '2-digit', month: '2-digit', year: '2-digit',
                        })}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {lead.status === 'pending' && (
                            <button
                              onClick={async () => {
                                await fetch('/api/leads/bulk', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ ids: [lead.id], status: 'akquise' }),
                                });
                                loadLeads();
                              }}
                              className="px-2 py-1 rounded-lg bg-elvora-accent/10 text-elvora-accent text-[11px] font-semibold border border-elvora-accent/20 hover:bg-elvora-accent/20 transition-all"
                              title="In Akquise verschieben"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                            </button>
                          )}
                          {lead.status === 'pending' && (
                            <button
                              onClick={async () => {
                                await fetch('/api/leads/bulk', {
                                  method: 'PATCH',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ ids: [lead.id], status: 'rejected' }),
                                });
                                loadLeads();
                              }}
                              className="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-semibold border border-red-500/20 hover:bg-red-500/20 transition-all"
                              title="Ablehnen"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          {lead.website && (
                            <a
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded-lg bg-white/5 text-elvora-text-dim text-[11px] border border-white/10 hover:text-white hover:bg-white/10 transition-all"
                              title="Website öffnen"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
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
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-2 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                &laquo;
              </button>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2.5 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                &lsaquo; Zurück
              </button>
              <span className="px-3 py-1 text-xs text-white font-medium">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                Weiter &rsaquo;
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 disabled:opacity-30 transition-all"
              >
                &raquo;
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
