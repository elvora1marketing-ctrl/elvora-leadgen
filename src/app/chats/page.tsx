'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Widget {
  id: number;
  name: string;
  greeting_message: string;
  placeholder_text: string;
  color: string;
  position: string;
  offline_message: string;
  auto_replies: string;
  is_active: number;
  ai_enabled: number;
  knowledge_base: string;
  ai_instructions: string;
  ai_fallback_message: string;
}

interface Conversation {
  id: number;
  widget_id: number;
  visitor_name: string;
  visitor_email: string | null;
  visitor_page: string | null;
  status: string;
  unread_count: number;
  created_at: string;
  updated_at: string;
  last_message?: string;
  last_message_at?: string;
  message_count?: number;
}

interface Message {
  id: number;
  conversation_id: number;
  sender: 'visitor' | 'agent' | 'bot';
  content: string;
  created_at: string;
}

type Tab = 'conversations' | 'widgets' | 'embed';

const statusLabels: Record<string, { label: string; color: string }> = {
  open: { label: 'Offen', color: 'bg-elvora-success/15 text-elvora-success' },
  resolved: { label: 'Geloest', color: 'bg-elvora-purple/15 text-elvora-purple-light' },
  archived: { label: 'Archiviert', color: 'bg-elvora-border text-elvora-text-dim' },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return 'gerade';
  if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
  if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
  if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tag${Math.floor(diff / 86400) > 1 ? 'en' : ''}`;
  return d.toLocaleDateString('de-DE');
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatsPage() {
  const [tab, setTab] = useState<Tab>('conversations');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editWidget, setEditWidget] = useState<Widget | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [embedWidgetId, setEmbedWidgetId] = useState('1');
  const [embedType, setEmbedType] = useState<'standard' | 'custom'>('standard');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?action=conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch {} finally { setLoading(false); }
  }, []);

  const loadWidgets = useCallback(async () => {
    try {
      const res = await fetch('/api/chat?action=widgets');
      const data = await res.json();
      setWidgets(data.widgets || []);
    } catch {}
  }, []);

  const loadMessages = useCallback(async (convId: number) => {
    try {
      const res = await fetch(`/api/chat?action=messages&conversation_id=${convId}`);
      const data = await res.json();
      setMessages(data.messages || []);
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', conversation_id: convId }),
      });
    } catch {}
  }, []);

  useEffect(() => {
    loadConversations();
    loadWidgets();
  }, [loadConversations, loadWidgets]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  // Poll for new messages + conversations
  useEffect(() => {
    const interval = setInterval(() => {
      loadConversations();
      if (selectedId) loadMessages(selectedId);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId, loadConversations, loadMessages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendReply() {
    if (!replyText.trim() || !selectedId) return;
    setSending(true);
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_message', conversation_id: selectedId, sender: 'agent', content: replyText.trim() }),
      });
      setReplyText('');
      loadMessages(selectedId);
    } catch {} finally { setSending(false); }
  }

  async function resolveConv(id: number) {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', conversation_id: id }),
    });
    loadConversations();
  }

  async function saveWidget(w: Widget) {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_widget', ...w }),
    });
    loadWidgets();
    setEditWidget(null);
  }

  const selectedConv = conversations.find(c => c.id === selectedId);
  const filtered = filter === 'all' ? conversations : conversations.filter(c => c.status === filter);
  const openCount = conversations.filter(c => c.status === 'open').length;
  const unreadCount = conversations.reduce((sum, c) => sum + c.unread_count, 0);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  function getEmbedCode() {
    if (embedType === 'custom') {
      return `<script src="${baseUrl}/elvora-chat.js"\n  data-widget-id="${embedWidgetId}"\n  data-url="${baseUrl}"\n  data-color="${widgets.find(w => w.id === Number(embedWidgetId))?.color || '#8B5CF6'}"\n  data-position="${widgets.find(w => w.id === Number(embedWidgetId))?.position || 'bottom-right'}"></script>`;
    }
    return `<script src="${baseUrl}/elvora-chat.js" data-widget-id="${embedWidgetId}" data-url="${baseUrl}"></script>`;
  }

  function copyEmbed() {
    navigator.clipboard.writeText(getEmbedCode());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Live Chat</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Support-Chats verwalten und beantworten</p>
        </div>
        <div className="flex items-center gap-2">
          {[
            { key: 'conversations' as Tab, label: 'Chats', count: openCount },
            { key: 'widgets' as Tab, label: 'Widgets' },
            { key: 'embed' as Tab, label: 'Einbetten' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                tab === t.key
                  ? 'bg-elvora-primary/20 text-elvora-primary-light border border-elvora-primary/30'
                  : 'bg-elvora-bg-alt text-elvora-text-dim border border-elvora-border hover:border-elvora-border-light'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="w-5 h-5 rounded-full bg-elvora-purple text-white text-[10px] flex items-center justify-center">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Offene Chats</div>
          <div className="text-2xl font-bold text-elvora-success mt-1">{openCount}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Ungelesen</div>
          <div className="text-2xl font-bold text-elvora-accent mt-1">{unreadCount}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Gesamt</div>
          <div className="text-2xl font-bold text-elvora-purple-light mt-1">{conversations.length}</div>
        </div>
      </div>

      {/* Conversations Tab */}
      {tab === 'conversations' && (
        <div className="card rounded-xl overflow-hidden" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
          <div className="flex h-full">
            {/* Left: Conversation List */}
            <div className="w-[320px] border-r border-elvora-border flex flex-col">
              {/* Filters */}
              <div className="p-3 border-b border-elvora-border flex gap-1.5">
                {[
                  { key: 'all', label: 'Alle' },
                  { key: 'open', label: 'Offen' },
                  { key: 'resolved', label: 'Geloest' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                      filter === f.key
                        ? 'bg-elvora-purple/15 text-elvora-purple-light'
                        : 'text-elvora-text-dim hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-6 text-center text-sm text-elvora-text-dim">Keine Chats</div>
                ) : (
                  filtered.map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => setSelectedId(conv.id)}
                      className={`w-full text-left p-3.5 border-b border-elvora-border/50 transition-colors ${
                        selectedId === conv.id ? 'bg-elvora-purple/10' : 'hover:bg-white/3'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                            conv.status === 'open' ? 'bg-elvora-success/15 text-elvora-success' : 'bg-elvora-surface text-elvora-text-dim'
                          }`}>
                            {conv.visitor_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium text-white truncate">{conv.visitor_name}</span>
                              {conv.unread_count > 0 && (
                                <span className="w-4.5 h-4.5 rounded-full bg-elvora-purple text-white text-[9px] flex items-center justify-center flex-shrink-0">{conv.unread_count}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-elvora-text-dim truncate mt-0.5">{conv.last_message || 'Neuer Chat'}</p>
                          </div>
                        </div>
                        <span className="text-[10px] text-elvora-text-dim/60 flex-shrink-0 mt-0.5">{timeAgo(conv.updated_at || conv.created_at)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Right: Chat Thread */}
            <div className="flex-1 flex flex-col">
              {!selectedConv ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <svg className="w-12 h-12 text-elvora-text-dim/20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-elvora-text-dim">Waehlen Sie einen Chat aus</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Thread Header */}
                  <div className="p-4 border-b border-elvora-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        selectedConv.status === 'open' ? 'bg-elvora-success/15 text-elvora-success' : 'bg-elvora-surface text-elvora-text-dim'
                      }`}>
                        {selectedConv.visitor_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{selectedConv.visitor_name}</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${statusLabels[selectedConv.status]?.color || ''}`}>
                            {statusLabels[selectedConv.status]?.label || selectedConv.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-elvora-text-dim mt-0.5">
                          {selectedConv.visitor_email && <span>{selectedConv.visitor_email}</span>}
                          {selectedConv.visitor_page && <span className="truncate max-w-[200px]">{selectedConv.visitor_page}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selectedConv.status === 'open' && (
                        <button
                          onClick={() => resolveConv(selectedConv.id)}
                          className="px-3 py-1.5 rounded-lg bg-elvora-success/10 text-elvora-success text-xs font-medium hover:bg-elvora-success/20 transition-colors flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          Geloest
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg, i) => {
                      const isVisitor = msg.sender === 'visitor';
                      const isBot = msg.sender === 'bot';
                      const showTime = i === 0 || new Date(msg.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() > 300000;

                      return (
                        <div key={msg.id}>
                          {showTime && (
                            <div className="text-center text-[10px] text-elvora-text-dim/50 my-2">{formatTime(msg.created_at)}</div>
                          )}
                          <div className={`flex ${isVisitor ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] ${isVisitor ? 'order-2' : ''}`}>
                              {!isVisitor && (
                                <div className="text-[10px] text-elvora-text-dim mb-1 ml-1">
                                  {isBot ? 'Bot' : 'Agent'}
                                </div>
                              )}
                              <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isVisitor
                                  ? 'bg-elvora-purple text-white rounded-br-md'
                                  : isBot
                                    ? 'bg-elvora-surface text-elvora-text-muted rounded-bl-md border border-elvora-border'
                                    : 'bg-elvora-success/15 text-white rounded-bl-md'
                              }`}>
                                {msg.content}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Input */}
                  {selectedConv.status === 'open' && (
                    <div className="p-3 border-t border-elvora-border">
                      <form onSubmit={e => { e.preventDefault(); sendReply(); }} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={replyText}
                          onChange={e => setReplyText(e.target.value)}
                          placeholder="Antwort eingeben..."
                          className="flex-1 px-4 py-2.5 rounded-xl bg-elvora-bg border border-elvora-border text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={sending || !replyText.trim()}
                          className="p-2.5 rounded-xl bg-elvora-purple text-white hover:bg-elvora-purple/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {sending ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                          )}
                        </button>
                      </form>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Widgets Tab */}
      {tab === 'widgets' && (
        <div className="space-y-3">
          {widgets.map(w => (
            <div key={w.id} className="card rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: w.color + '20' }}>
                    <svg className="w-5 h-5" style={{ color: w.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{w.name}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${w.is_active ? 'bg-elvora-success/15 text-elvora-success' : 'bg-red-500/15 text-red-400'}`}>
                        {w.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                      {w.ai_enabled ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-elvora-purple/15 text-elvora-purple-light">KI</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-elvora-text-dim mt-0.5">{w.greeting_message}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditWidget(w)}
                  className="px-3 py-1.5 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 border border-elvora-border transition-colors"
                >
                  Bearbeiten
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-elvora-bg rounded-lg p-3">
                  <div className="text-elvora-text-dim">Farbe</div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: w.color }} />
                    <span className="text-white font-mono">{w.color}</span>
                  </div>
                </div>
                <div className="bg-elvora-bg rounded-lg p-3">
                  <div className="text-elvora-text-dim">Position</div>
                  <div className="text-white mt-1">{w.position === 'bottom-right' ? 'Unten rechts' : 'Unten links'}</div>
                </div>
                <div className="bg-elvora-bg rounded-lg p-3">
                  <div className="text-elvora-text-dim">Auto-Replies</div>
                  <div className="text-white mt-1">{(() => { try { return JSON.parse(w.auto_replies || '[]').length; } catch { return 0; } })()}</div>
                </div>
              </div>
            </div>
          ))}

          {widgets.length === 0 && (
            <div className="card rounded-xl p-12 text-center">
              <p className="text-sm text-elvora-text-dim">Noch keine Widgets angelegt</p>
            </div>
          )}
        </div>
      )}

      {/* Widget Edit Modal */}
      {editWidget && (
        <WidgetEditModal widget={editWidget} onSave={saveWidget} onClose={() => setEditWidget(null)} />
      )}

      {/* Embed Tab */}
      {tab === 'embed' && (
        <div className="card rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Chat-Widget einbetten</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Widget</label>
              <select
                value={embedWidgetId}
                onChange={e => setEmbedWidgetId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
              >
                {widgets.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Variante</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEmbedType('standard')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    embedType === 'standard'
                      ? 'bg-elvora-purple/15 text-elvora-purple-light border border-elvora-purple/30'
                      : 'bg-elvora-bg text-elvora-text-dim border border-elvora-border'
                  }`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setEmbedType('custom')}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    embedType === 'custom'
                      ? 'bg-elvora-purple/15 text-elvora-purple-light border border-elvora-purple/30'
                      : 'bg-elvora-bg text-elvora-text-dim border border-elvora-border'
                  }`}
                >
                  Mit Optionen
                </button>
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Vorschau</label>
              <div className="rounded-xl bg-white/5 border border-elvora-border p-6 flex items-end justify-end min-h-[100px]">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg cursor-pointer transition-transform hover:scale-110"
                  style={{ backgroundColor: widgets.find(w => w.id === Number(embedWidgetId))?.color || '#8B5CF6' }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Code */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-elvora-text-dim">Embed-Code</label>
                <button
                  onClick={copyEmbed}
                  className="text-xs text-elvora-purple-light hover:text-white transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copiedEmbed ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'} />
                  </svg>
                  {copiedEmbed ? 'Kopiert!' : 'Kopieren'}
                </button>
              </div>
              <pre className="bg-elvora-bg rounded-xl p-4 text-xs text-elvora-text-muted font-mono overflow-x-auto border border-elvora-border whitespace-pre-wrap break-all leading-relaxed">
                {getEmbedCode()}
              </pre>
            </div>

            <p className="text-[11px] text-elvora-text-dim/50">
              Fuegen Sie diesen Code vor dem schliessenden &lt;/body&gt;-Tag Ihrer Website ein. Das Chat-Widget erscheint automatisch.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function WidgetEditModal({ widget, onSave, onClose }: { widget: Widget; onSave: (w: Widget) => void; onClose: () => void }) {
  const [form, setForm] = useState({ ...widget });
  const [autoReplies, setAutoReplies] = useState<{ q: string; a: string }[]>(() => {
    try { return JSON.parse(widget.auto_replies || '[]'); } catch { return []; }
  });
  const [knowledgeBase, setKnowledgeBase] = useState<{ title: string; content: string }[]>(() => {
    try { return JSON.parse(widget.knowledge_base || '[]'); } catch { return []; }
  });
  const [activeSection, setActiveSection] = useState<'general' | 'ai'>('general');

  function handleSave() {
    onSave({ ...form, auto_replies: JSON.stringify(autoReplies), knowledge_base: JSON.stringify(knowledgeBase) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white">Widget bearbeiten</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-elvora-text-dim hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1.5 mb-4">
            <button onClick={() => setActiveSection('general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeSection === 'general' ? 'bg-elvora-purple/15 text-elvora-purple-light' : 'text-elvora-text-dim hover:text-white'}`}>
              Allgemein
            </button>
            <button onClick={() => setActiveSection('ai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${activeSection === 'ai' ? 'bg-elvora-purple/15 text-elvora-purple-light' : 'text-elvora-text-dim hover:text-white'}`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              KI-Chatbot
              {form.ai_enabled ? <span className="w-1.5 h-1.5 rounded-full bg-elvora-success" /> : null}
            </button>
          </div>

          {activeSection === 'general' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Name</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Begruessung</label>
              <textarea value={form.greeting_message} onChange={e => setForm({ ...form, greeting_message: e.target.value })} rows={2}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50 resize-none" />
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Platzhalter-Text</label>
              <input type="text" value={form.placeholder_text} onChange={e => setForm({ ...form, placeholder_text: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Offline-Nachricht</label>
              <textarea value={form.offline_message} onChange={e => setForm({ ...form, offline_message: e.target.value })} rows={2}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Farbe</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-elvora-border cursor-pointer bg-transparent" />
                  <input type="text" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm font-mono focus:outline-none focus:border-elvora-purple/50" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Position</label>
                <select value={form.position} onChange={e => setForm({ ...form, position: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50">
                  <option value="bottom-right">Unten rechts</option>
                  <option value="bottom-left">Unten links</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-elvora-text-dim">Widget aktiv</span>
              <button
                onClick={() => setForm({ ...form, is_active: form.is_active ? 0 : 1 })}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.is_active ? 'bg-elvora-success' : 'bg-elvora-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.is_active ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {/* Auto-Replies */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-elvora-text-dim">Auto-Replies (Keyword → Antwort)</label>
                <button
                  onClick={() => setAutoReplies([...autoReplies, { q: '', a: '' }])}
                  className="text-xs text-elvora-purple-light hover:text-white transition-colors"
                >
                  + Hinzufuegen
                </button>
              </div>
              <div className="space-y-2">
                {autoReplies.map((ar, i) => (
                  <div key={i} className="bg-elvora-bg rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ar.q}
                        onChange={e => { const n = [...autoReplies]; n[i].q = e.target.value; setAutoReplies(n); }}
                        placeholder="Keyword (z.B. Preis)"
                        className="flex-1 px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50"
                      />
                      <button onClick={() => setAutoReplies(autoReplies.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <textarea
                      value={ar.a}
                      onChange={e => { const n = [...autoReplies]; n[i].a = e.target.value; setAutoReplies(n); }}
                      placeholder="Automatische Antwort..."
                      rows={2}
                      className="w-full px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50 resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          )}

          {activeSection === 'ai' && (
          <div className="space-y-3">
            {/* AI Toggle */}
            <div className="flex items-center justify-between p-3 bg-elvora-bg rounded-xl border border-elvora-border">
              <div>
                <div className="text-sm font-medium text-white">KI-Chatbot aktivieren</div>
                <div className="text-[11px] text-elvora-text-dim mt-0.5">Beantwortet Fragen automatisch mit KI basierend auf der Wissensbasis</div>
              </div>
              <button
                onClick={() => setForm({ ...form, ai_enabled: form.ai_enabled ? 0 : 1 })}
                className={`w-10 h-5 rounded-full transition-colors relative ${form.ai_enabled ? 'bg-elvora-success' : 'bg-elvora-border'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.ai_enabled ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>

            {form.ai_enabled ? (
              <>
                {/* AI Instructions */}
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">KI-Anweisungen (optional)</label>
                  <textarea
                    value={form.ai_instructions || ''}
                    onChange={e => setForm({ ...form, ai_instructions: e.target.value })}
                    rows={3}
                    placeholder="z.B. Antworte immer freundlich und professionell. Verweise bei Preisfragen auf ein Erstgespraech."
                    className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50 resize-none"
                  />
                </div>

                {/* Fallback Message */}
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">Uebergabe-Nachricht (wenn KI nicht antworten kann)</label>
                  <input
                    type="text"
                    value={form.ai_fallback_message || ''}
                    onChange={e => setForm({ ...form, ai_fallback_message: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
                  />
                </div>

                {/* Knowledge Base */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="text-xs text-elvora-text-dim">Wissensbasis</label>
                      <p className="text-[10px] text-elvora-text-dim/60 mt-0.5">Texte und Infos, die die KI zum Antworten nutzt</p>
                    </div>
                    <button
                      onClick={() => setKnowledgeBase([...knowledgeBase, { title: '', content: '' }])}
                      className="text-xs text-elvora-purple-light hover:text-white transition-colors"
                    >
                      + Eintrag
                    </button>
                  </div>
                  <div className="space-y-2">
                    {knowledgeBase.map((kb, i) => (
                      <div key={i} className="bg-elvora-bg rounded-lg p-3 space-y-2 border border-elvora-border">
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={kb.title}
                            onChange={e => { const n = [...knowledgeBase]; n[i].title = e.target.value; setKnowledgeBase(n); }}
                            placeholder="Thema (z.B. Oeffnungszeiten, Preise, Leistungen)"
                            className="flex-1 px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50"
                          />
                          <button onClick={() => setKnowledgeBase(knowledgeBase.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        <textarea
                          value={kb.content}
                          onChange={e => { const n = [...knowledgeBase]; n[i].content = e.target.value; setKnowledgeBase(n); }}
                          placeholder="Inhalt: z.B. Montag-Freitag 9-17 Uhr, Samstag 10-14 Uhr. Sonntag geschlossen."
                          rows={3}
                          className="w-full px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50 resize-none"
                        />
                      </div>
                    ))}
                    {knowledgeBase.length === 0 && (
                      <div className="text-center py-4 text-xs text-elvora-text-dim/50">
                        Noch keine Eintraege. Fuegen Sie Informationen hinzu, damit die KI Fragen beantworten kann.
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-elvora-purple/5 border border-elvora-purple/15">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-elvora-purple-light flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="text-[11px] text-elvora-text-dim leading-relaxed">
                      Die KI nutzt die Wissensbasis um Besucherfragen zu beantworten. Stellen Sie sicher, dass ein OpenAI API-Key in den Einstellungen hinterlegt ist.
                      Bei Fragen die nicht beantwortet werden koennen, wird automatisch an einen Mitarbeiter uebergeben.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-sm text-elvora-text-dim">
                KI-Chatbot ist deaktiviert. Aktivieren Sie ihn, um automatische KI-Antworten zu erhalten.
              </div>
            )}
          </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors">
              Abbrechen
            </button>
            <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors">
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
