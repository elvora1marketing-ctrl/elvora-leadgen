'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface InboxMessage {
  id: number;
  lead_id: number | null;
  from_email: string;
  from_name: string;
  subject: string;
  body_text: string;
  is_read: number;
  is_archived: number;
  source: string;
  created_at: string;
  lead_name: string | null;
  lead_city: string | null;
  contact_status: string | null;
  lead_score: number | null;
}

interface AiClassification {
  classification: string;
  label: string;
  color: string;
  confidence: number;
  summary: string;
  suggested_action: string;
}

const classificationColors: Record<string, string> = {
  success: 'bg-elvora-success/15 text-elvora-success border-elvora-success/20',
  danger: 'bg-red-500/15 text-red-400 border-red-500/20',
  warning: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  muted: 'bg-white/10 text-elvora-text-dim border-white/10',
};

export default function InboxPage() {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // AI Classification
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<AiClassification | null>(null);
  const [classifyError, setClassifyError] = useState('');

  const loadMessages = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === 'unread') params.set('unread', '1');
      if (filter === 'archived') params.set('archived', '1');

      const res = await fetch(`/api/inbox?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
        setUnreadCount(data.unreadCount);
        setTotal(data.total);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const selectedMessage = messages.find(m => m.id === selectedId);

  async function markAs(ids: number[], action: 'read' | 'unread' | 'archive') {
    try {
      await fetch('/api/inbox', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action }),
      });
      await loadMessages();
      if (action === 'archive') {
        setSelectedId(null);
        setSelectedIds(new Set());
      }
    } catch { /* silent */ }
  }

  // Auto-mark as read when opening, reset classification
  useEffect(() => {
    setClassification(null);
    setClassifyError('');
    if (selectedMessage && !selectedMessage.is_read) {
      markAs([selectedMessage.id], 'read');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function toggleSelect(id: number) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  function selectAll() {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map(m => m.id)));
    }
  }

  function timeAgo(dateStr: string): string {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Gerade eben';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-white">Inbox</h1>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-elvora-pink/20 text-elvora-pink text-xs font-bold">
              {unreadCount} ungelesen
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => markAs([...selectedIds], 'read')}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs hover:bg-white/10 transition-all"
              >
                Gelesen
              </button>
              <button
                onClick={() => markAs([...selectedIds], 'archive')}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-elvora-text-dim text-xs hover:bg-white/10 transition-all"
              >
                Archivieren
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4">
        {[
          { key: 'all' as const, label: 'Alle' },
          { key: 'unread' as const, label: `Ungelesen (${unreadCount})` },
          { key: 'archived' as const, label: 'Archiv' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setSelectedId(null); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === tab.key
                ? 'bg-elvora-gradient text-white'
                : 'text-elvora-text-dim hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass rounded-xl p-8 text-center text-elvora-text-dim text-sm">Lade Nachrichten...</div>
      ) : messages.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <svg className="w-12 h-12 text-elvora-text-dim/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-elvora-text-dim text-sm">
            {filter === 'unread' ? 'Keine ungelesenen Nachrichten' : filter === 'archived' ? 'Kein Archiv' : 'Noch keine Antworten erhalten'}
          </p>
          <p className="text-elvora-text-dim/50 text-xs mt-1">
            Eingehende Email-Antworten erscheinen hier automatisch
          </p>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Message List */}
          <div className={`${selectedId ? 'hidden lg:block lg:w-2/5' : 'w-full'} space-y-1`}>
            {/* Select all */}
            <div className="flex items-center gap-2 px-2 py-1">
              <button
                onClick={selectAll}
                className="w-4 h-4 rounded border border-white/20 flex items-center justify-center hover:border-elvora-purple/50 transition-colors"
              >
                {selectedIds.size === messages.length && messages.length > 0 && (
                  <svg className="w-3 h-3 text-elvora-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <span className="text-[10px] text-elvora-text-dim">{total} Nachrichten</span>
            </div>

            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => setSelectedId(msg.id)}
                className={`glass rounded-xl p-3 cursor-pointer transition-all ${
                  selectedId === msg.id ? 'border border-elvora-purple/40 bg-elvora-purple/5' : 'hover:bg-white/[0.03]'
                } ${!msg.is_read ? 'border-l-2 border-l-elvora-pink' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelect(msg.id); }}
                    className={`mt-1 w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                      selectedIds.has(msg.id)
                        ? 'bg-elvora-purple border-elvora-purple'
                        : 'border-white/20 hover:border-elvora-purple/50'
                    }`}
                  >
                    {selectedIds.has(msg.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {!msg.is_read && <span className="w-2 h-2 rounded-full bg-elvora-pink flex-shrink-0" />}
                        <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-white' : 'text-elvora-text-muted'}`}>
                          {msg.lead_name || msg.from_name || msg.from_email}
                        </span>
                      </div>
                      <span className="text-[10px] text-elvora-text-dim flex-shrink-0">{timeAgo(msg.created_at)}</span>
                    </div>
                    <div className={`text-xs truncate mt-0.5 ${!msg.is_read ? 'text-white/80' : 'text-elvora-text-dim'}`}>
                      {msg.subject}
                    </div>
                    <div className="text-xs text-elvora-text-dim/60 truncate mt-0.5">
                      {msg.body_text?.substring(0, 80) || '(Kein Text)'}
                    </div>
                    {msg.lead_city && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-elvora-text-dim bg-white/5 px-1.5 py-0.5 rounded">{msg.lead_city}</span>
                        {msg.lead_score !== null && (
                          <span className="text-[10px] text-elvora-text-dim">Score: {msg.lead_score}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Message Detail */}
          {selectedMessage && (
            <div className={`${selectedId ? 'w-full lg:w-3/5' : 'hidden'}`}>
              <div className="glass rounded-xl p-5">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedId(null)}
                  className="lg:hidden flex items-center gap-1 text-elvora-text-dim text-xs mb-4 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Zurück
                </button>

                {/* From / Lead info */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-elvora-gradient flex items-center justify-center text-white text-sm font-bold">
                        {(selectedMessage.from_name || selectedMessage.from_email)[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">
                          {selectedMessage.lead_name || selectedMessage.from_name || selectedMessage.from_email}
                        </div>
                        <div className="text-xs text-elvora-text-dim">{selectedMessage.from_email}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-elvora-text-dim">
                      {new Date(selectedMessage.created_at + 'Z').toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                    <button
                      onClick={() => markAs([selectedMessage.id], 'archive')}
                      className="p-1.5 rounded-lg hover:bg-white/5 text-elvora-text-dim hover:text-white transition-all"
                      title="Archivieren"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Subject */}
                <div className="text-white font-medium mb-4">{selectedMessage.subject}</div>

                {/* Lead card if linked */}
                {selectedMessage.lead_id && (
                  <Link
                    href={`/akquise?lead=${selectedMessage.lead_id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-elvora-purple/5 border border-elvora-purple/20 mb-4 hover:bg-elvora-purple/10 transition-all"
                  >
                    <div className="flex-1">
                      <div className="text-xs text-elvora-text-dim">Verknüpfter Lead</div>
                      <div className="text-sm font-medium text-white">{selectedMessage.lead_name}</div>
                    </div>
                    {selectedMessage.lead_city && (
                      <span className="text-xs text-elvora-text-dim">{selectedMessage.lead_city}</span>
                    )}
                    {selectedMessage.contact_status && (
                      <span className="px-2 py-0.5 rounded-full bg-elvora-accent/15 text-elvora-accent text-[10px] font-bold">
                        {selectedMessage.contact_status}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}

                {/* AI Classification */}
                <div className="mb-4">
                  {classification && classification.classification ? (
                    <div className={`rounded-lg border p-3 ${classificationColors[classification.color] || classificationColors.muted}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-bold">KI-Analyse</span>
                          <span className="font-semibold text-xs">{classification.label}</span>
                          <span className="text-[10px] opacity-70">{Math.round(classification.confidence * 100)}%</span>
                        </div>
                        <button
                          onClick={() => setClassification(null)}
                          className="text-[10px] opacity-50 hover:opacity-100 transition-opacity"
                        >
                          Ausblenden
                        </button>
                      </div>
                      <p className="text-xs opacity-80">{classification.summary}</p>
                      <p className="text-[11px] opacity-60 mt-1">Empfehlung: {classification.suggested_action}</p>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (!selectedMessage) return;
                        setClassifying(true);
                        setClassifyError('');
                        try {
                          const res = await fetch('/api/ai/classify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              message_id: selectedMessage.id,
                              subject: selectedMessage.subject,
                              body: selectedMessage.body_text,
                              from_name: selectedMessage.from_name,
                              lead_name: selectedMessage.lead_name,
                            }),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            setClassification(data);
                          } else {
                            setClassifyError(data.error || 'Fehler');
                          }
                        } catch {
                          setClassifyError('Netzwerkfehler');
                        } finally {
                          setClassifying(false);
                        }
                      }}
                      disabled={classifying}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-all disabled:opacity-50"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      {classifying ? 'Analysiere...' : 'KI-Klassifizierung'}
                    </button>
                  )}
                  {classifyError && <div className="text-[11px] text-red-400 mt-1">{classifyError}</div>}
                </div>

                {/* Body */}
                <div className="rounded-lg bg-white/[0.02] border border-white/5 p-4">
                  <pre className="text-sm text-elvora-text-muted whitespace-pre-wrap font-sans leading-relaxed">
                    {selectedMessage.body_text || '(Kein Textinhalt)'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
