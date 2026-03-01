'use client';

import { useState, useEffect, useCallback } from 'react';

interface AkquiseLead {
  id: number;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  city: string;
  score: number;
  contact_status: string;
  found_via_keywords: string | null;
  times_found: number;
  created_at: string;
  updated_at: string;
}

interface Activity {
  id: number;
  type: string;
  content: string;
  created_at: string;
}

const contactLabels: Record<string, { label: string; color: string; icon: string }> = {
  not_contacted: { label: 'Offen', color: 'bg-white/10 text-elvora-text-muted', icon: '' },
  email_sent: { label: 'Mail gesendet', color: 'bg-elvora-purple/15 text-elvora-purple-light', icon: '' },
  called: { label: 'Angerufen', color: 'bg-elvora-warning/15 text-elvora-warning', icon: '' },
  meeting: { label: 'Meeting', color: 'bg-elvora-accent/15 text-elvora-accent', icon: '' },
  proposal: { label: 'Angebot', color: 'bg-elvora-pink/15 text-elvora-pink', icon: '' },
  won: { label: 'Gewonnen', color: 'bg-elvora-success/15 text-elvora-success', icon: '' },
  lost: { label: 'Verloren', color: 'bg-red-500/15 text-red-400', icon: '' },
};

export default function AkquisePage() {
  const [leads, setLeads] = useState<AkquiseLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filter
  const [filterContact, setFilterContact] = useState('');
  const [search, setSearch] = useState('');

  // Expanded lead detail
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [noteInput, setNoteInput] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [callResult, setCallResult] = useState('');
  const [emailNote, setEmailNote] = useState('');

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('status', 'akquise');
      params.set('limit', '200');
      params.set('sort', 'updated_at');
      params.set('dir', 'desc');
      if (filterContact) params.set('contact_status', filterContact);
      if (search) params.set('search', search);

      const res = await fetch(`/api/leads?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setTotal(data.total || 0);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filterContact, search]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const loadActivities = async (leadId: number) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch { /* silent */ }
  };

  const toggleExpand = (leadId: number) => {
    if (expandedId === leadId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(leadId);
    setActivities([]);
    setNoteInput('');
    setCallResult('');
    setEmailNote('');
    loadActivities(leadId);
  };

  const addActivity = async (leadId: number, type: string, content: string) => {
    if (!content.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content: content.trim() }),
      });
      if (res.ok) {
        const newActivity = await res.json();
        setActivities(prev => [newActivity, ...prev]);
        if (type === 'note') setNoteInput('');
        if (type === 'call') setCallResult('');
        if (type === 'email') setEmailNote('');
        loadLeads(); // refresh contact_status
      }
    } catch { /* silent */ }
    finally { setAddingNote(false); }
  };

  const updateContactStatus = async (leadId: number, newStatus: string) => {
    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_status: newStatus }),
      });
      // also log activity
      await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'status_change',
          content: `Status geändert: ${contactLabels[newStatus]?.label || newStatus}`,
        }),
      });
      loadLeads();
      if (expandedId === leadId) loadActivities(leadId);
    } catch { /* silent */ }
  };

  const removeFromAkquise = async (leadId: number) => {
    try {
      await fetch('/api/leads/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [leadId], status: 'archived' }),
      });
      loadLeads();
      if (expandedId === leadId) setExpandedId(null);
    } catch { /* silent */ }
  };

  // Stats
  const statCounts = leads.reduce((acc, l) => {
    acc[l.contact_status] = (acc[l.contact_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-elvora-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Akquise</h1>
        <p className="text-sm text-elvora-text-dim mt-1">
          {total} Leads in Bearbeitung - Anrufe, Mails und Notizen dokumentieren
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterContact('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            !filterContact
              ? 'bg-elvora-primary/20 text-elvora-primary border-elvora-primary/30'
              : 'bg-white/5 text-elvora-text-dim border-white/10 hover:text-white'
          }`}
        >
          Alle ({total})
        </button>
        {Object.entries(contactLabels).map(([key, val]) => {
          const count = statCounts[key] || 0;
          if (count === 0 && !['not_contacted', 'called', 'email_sent'].includes(key)) return null;
          return (
            <button
              key={key}
              onClick={() => setFilterContact(filterContact === key ? '' : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                filterContact === key
                  ? `${val.color} border-current`
                  : 'bg-white/5 text-elvora-text-dim border-white/10 hover:text-white'
              }`}
            >
              {val.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="w-4 h-4 text-elvora-text-dim absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Lead suchen..."
          className="w-full pl-10 pr-4 py-2 rounded-xl bg-elvora-bg border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:ring-2 focus:ring-elvora-primary/50 transition-all"
        />
      </div>

      {/* Empty state */}
      {leads.length === 0 && !loading && (
        <div className="card-glass p-12 text-center">
          <svg className="w-12 h-12 text-elvora-text-dim mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-elvora-text-muted font-medium mb-1">Keine Leads in der Akquise</p>
          <p className="text-elvora-text-dim text-sm">
            Verschiebe Leads aus dem Lead-Pool hierher, um mit der Akquise zu starten.
          </p>
        </div>
      )}

      {/* Lead Cards */}
      <div className="space-y-2">
        {leads.map(lead => {
          const cs = contactLabels[lead.contact_status] || contactLabels.not_contacted;
          const isExpanded = expandedId === lead.id;

          return (
            <div key={lead.id} className="card-glass rounded-xl overflow-hidden">
              {/* Lead Row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                onClick={() => toggleExpand(lead.id)}
              >
                {/* Status badge */}
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${cs.color}`}>
                  {cs.label}
                </span>

                {/* Name + City */}
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium text-sm truncate block">{lead.name}</span>
                  <span className="text-elvora-text-dim text-xs">{lead.city}</span>
                </div>

                {/* Contact info icons */}
                <div className="flex items-center gap-2">
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 rounded-lg bg-elvora-success/10 text-elvora-success text-[11px] font-semibold border border-elvora-success/20 hover:bg-elvora-success/20 transition-all flex items-center gap-1"
                      title={lead.phone}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Anrufen
                    </a>
                  )}
                  {lead.website && (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 rounded-lg bg-white/5 text-elvora-text-dim text-[11px] border border-white/10 hover:text-white hover:bg-white/10 transition-all"
                      title="Website"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>

                {/* Expand icon */}
                <svg className={`w-4 h-4 text-elvora-text-dim transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-white/5 px-4 py-4 space-y-4 animate-fade-in bg-white/[0.01]">
                  {/* Lead Info */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-elvora-text-dim block mb-0.5">Telefon</span>
                      <span className="text-white font-mono">{lead.phone || '-'}</span>
                    </div>
                    <div>
                      <span className="text-elvora-text-dim block mb-0.5">E-Mail</span>
                      <span className="text-white">{lead.email || '-'}</span>
                    </div>
                    <div>
                      <span className="text-elvora-text-dim block mb-0.5">Website</span>
                      {lead.website ? (
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-elvora-primary hover:underline truncate block">
                          {lead.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
                        </a>
                      ) : (
                        <span className="text-elvora-text-muted">Keine</span>
                      )}
                    </div>
                    <div>
                      <span className="text-elvora-text-dim block mb-0.5">Keywords</span>
                      <span className="text-elvora-text-muted">{lead.found_via_keywords || '-'}</span>
                    </div>
                  </div>

                  {/* Status ändern */}
                  <div>
                    <span className="text-xs text-elvora-text-dim block mb-1.5">Status ändern</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(['not_contacted', 'email_sent', 'called', 'meeting', 'proposal', 'won', 'lost'] as const).map(s => {
                        const cl = contactLabels[s];
                        const active = lead.contact_status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => !active && updateContactStatus(lead.id, s)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border ${
                              active
                                ? `${cl.color} border-current ring-1 ring-current/20`
                                : 'bg-white/5 text-elvora-text-dim border-white/10 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {cl.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Anruf dokumentieren */}
                  <div className="bg-elvora-success/5 rounded-xl p-3 border border-elvora-success/10">
                    <span className="text-xs font-semibold text-elvora-success block mb-1.5">Anruf dokumentieren</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={callResult}
                        onChange={(e) => setCallResult(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addActivity(lead.id, 'call', callResult)}
                        placeholder="Ergebnis des Anrufs..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-elvora-text-dim focus:outline-none focus:border-elvora-success/30"
                      />
                      <button
                        onClick={() => addActivity(lead.id, 'call', callResult)}
                        disabled={addingNote || !callResult.trim()}
                        className="px-3 py-1.5 rounded-lg bg-elvora-success/15 text-elvora-success text-xs font-semibold border border-elvora-success/20 hover:bg-elvora-success/25 transition-all disabled:opacity-50 whitespace-nowrap"
                      >
                        Anruf speichern
                      </button>
                    </div>
                    {/* Quick call outcomes */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {['Nicht erreicht', 'AB gesprochen', 'Interesse', 'Kein Interesse', 'Rückruf vereinbart', 'Termin vereinbart'].map(preset => (
                        <button
                          key={preset}
                          onClick={() => setCallResult(preset)}
                          className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-elvora-text-dim border border-white/5 hover:text-white hover:bg-white/10 transition-all"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* E-Mail dokumentieren */}
                  <div className="bg-elvora-purple/5 rounded-xl p-3 border border-elvora-purple/10">
                    <span className="text-xs font-semibold text-elvora-purple-light block mb-1.5">E-Mail dokumentieren</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={emailNote}
                        onChange={(e) => setEmailNote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addActivity(lead.id, 'email', emailNote)}
                        placeholder="Was wurde gesendet? z.B. Erstansprache, Follow-Up, Angebot..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/30"
                      />
                      <button
                        onClick={() => addActivity(lead.id, 'email', emailNote)}
                        disabled={addingNote || !emailNote.trim()}
                        className="px-3 py-1.5 rounded-lg bg-elvora-purple/15 text-elvora-purple-light text-xs font-semibold border border-elvora-purple/20 hover:bg-elvora-purple/25 transition-all disabled:opacity-50 whitespace-nowrap"
                      >
                        Mail speichern
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {['Erstansprache gesendet', 'Follow-Up gesendet', 'Angebot gesendet', 'Info-Material gesendet'].map(preset => (
                        <button
                          key={preset}
                          onClick={() => setEmailNote(preset)}
                          className="px-2 py-0.5 rounded text-[10px] bg-white/5 text-elvora-text-dim border border-white/5 hover:text-white hover:bg-white/10 transition-all"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notiz */}
                  <div>
                    <span className="text-xs text-elvora-text-dim block mb-1.5">Notiz hinzufügen</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addActivity(lead.id, 'note', noteInput)}
                        placeholder="Notiz..."
                        className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs placeholder-elvora-text-dim focus:outline-none focus:border-white/20"
                      />
                      <button
                        onClick={() => addActivity(lead.id, 'note', noteInput)}
                        disabled={addingNote || !noteInput.trim()}
                        className="px-3 py-1.5 rounded-lg bg-white/10 text-elvora-text-muted text-xs font-semibold border border-white/10 hover:bg-white/15 transition-all disabled:opacity-50"
                      >
                        Speichern
                      </button>
                    </div>
                  </div>

                  {/* Activity Log */}
                  {activities.length > 0 && (
                    <div>
                      <span className="text-xs text-elvora-text-dim block mb-2">Verlauf</span>
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {activities.map(a => {
                          const typeStyles: Record<string, { icon: string; color: string }> = {
                            call: { icon: '\u{1F4DE}', color: 'border-l-elvora-success' },
                            email: { icon: '\u{1F4E7}', color: 'border-l-elvora-purple' },
                            note: { icon: '\u{1F4DD}', color: 'border-l-white/20' },
                            meeting: { icon: '\u{1F91D}', color: 'border-l-elvora-accent' },
                            status_change: { icon: '\u{1F504}', color: 'border-l-elvora-warning' },
                            whatsapp: { icon: '\u{1F4AC}', color: 'border-l-green-500' },
                          };
                          const ts = typeStyles[a.type] || typeStyles.note;
                          return (
                            <div key={a.id} className={`flex items-start gap-2 px-3 py-2 bg-white/[0.02] rounded-lg border-l-2 ${ts.color}`}>
                              <span className="text-sm flex-shrink-0">{ts.icon}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-xs text-elvora-text-muted block">{a.content}</span>
                              </div>
                              <span className="text-[10px] text-elvora-text-dim whitespace-nowrap flex-shrink-0">
                                {new Date(a.created_at).toLocaleDateString('de-DE', {
                                  day: '2-digit', month: '2-digit',
                                })}{' '}
                                {new Date(a.created_at).toLocaleTimeString('de-DE', {
                                  hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Remove from Akquise */}
                  <div className="flex justify-end pt-2 border-t border-white/5">
                    <button
                      onClick={() => removeFromAkquise(lead.id)}
                      className="px-3 py-1.5 rounded-lg text-xs text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                      Aus Akquise entfernen
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
