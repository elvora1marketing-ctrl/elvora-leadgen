'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Lead {
  id: number;
  name: string;
  company: string | null;
  city: string;
  website_original: string | null;
  phone: string | null;
  email: string | null;
  linkedin_url: string | null;
  score: number;
  contact_status: string;
  status: string;
  priority: string;
  deal_value: number | null;
  expected_close_date: string | null;
  win_probability: number | null;
  lost_reason: string | null;
  notes: string | null;
  problems: string | null;
  seo_issues: string | null;
  found_via_keywords: string | null;
  times_found: number;
  engagement_score: number;
  engagement_signals: string;
  followup_date: string | null;
  created_at: string;
  updated_at: string;
  email_opens: number;
  total_opens: number;
  replies_count: number;
  followups_sent: number;
  followups_pending: number;
}

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface Task {
  id: number;
  title: string;
  description: string | null;
  type: string;
  due_date: string | null;
  is_completed: number;
  created_at: string;
}

interface AuditPage {
  id: number;
  slug: string;
  views: number;
  cta_clicks: number;
  created_at: string;
}

interface Activity {
  id: number;
  type: string;
  content: string;
  created_at: string;
}

interface ThreadItem {
  id: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

const stages = [
  { key: 'not_contacted', label: 'Nicht kontaktiert' },
  { key: 'email_sent', label: 'Mail gesendet' },
  { key: 'called', label: 'Angerufen' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'proposal', label: 'Angebot' },
  { key: 'won', label: 'Gewonnen' },
];

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Niedrig', color: 'bg-white/10 text-elvora-text-muted' },
  medium: { label: 'Mittel', color: 'bg-elvora-warning/15 text-elvora-warning' },
  high: { label: 'Hoch', color: 'bg-red-500/15 text-red-400' },
};

function getScoreColor(score: number) {
  if (score >= 70) return 'text-elvora-success';
  if (score >= 40) return 'text-elvora-warning';
  return 'text-red-400';
}

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

export default function CrmDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = parseInt(params.id as string);

  const [lead, setLead] = useState<Lead | null>(null);
  const [leadTags, setLeadTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [audit, setAudit] = useState<AuditPage | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'thread' | 'activities' | 'tasks' | 'deal' | 'info'>('thread');

  // Forms
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');
  const [taskType, setTaskType] = useState('todo');

  // Deal fields
  const [dealValue, setDealValue] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const [winProb, setWinProb] = useState(50);
  const [lostReason, setLostReason] = useState('');

  // Reply
  const [replySubject, setReplySubject] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [sending, setSending] = useState(false);

  const loadAll = useCallback(async () => {
    if (isNaN(leadId)) return;
    try {
      const [leadRes, threadRes, actRes, tagsRes] = await Promise.all([
        fetch(`/api/leads/${leadId}`),
        fetch(`/api/leads/${leadId}/thread`),
        fetch(`/api/leads/${leadId}/notes`),
        fetch('/api/tags'),
      ]);

      if (leadRes.ok) {
        const d = await leadRes.json();
        setLead(d.lead);
        setLeadTags(d.tags || []);
        setTasks(d.tasks || []);
        setAudit(d.audit);
        if (d.lead) {
          setDealValue(d.lead.deal_value?.toString() || '');
          setCloseDate(d.lead.expected_close_date || '');
          setWinProb(d.lead.win_probability ?? 50);
          setLostReason(d.lead.lost_reason || '');
        }
      }
      if (threadRes.ok) {
        const d = await threadRes.json();
        setThread(d.thread || []);
      }
      if (actRes.ok) {
        const d = await actRes.json();
        setActivities(d.activities || []);
      }
      if (tagsRes.ok) {
        const d = await tagsRes.json();
        setAllTags(d.tags || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [leadId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const updateStatus = async (newStatus: string) => {
    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_status: newStatus }),
      });
      loadAll();
    } catch { /* silent */ }
  };

  const saveDeal = async () => {
    try {
      await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deal_value: dealValue ? parseFloat(dealValue) : 0,
          expected_close_date: closeDate || '',
          win_probability: winProb,
          lost_reason: lostReason,
        }),
      });
      loadAll();
    } catch { /* silent */ }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    try {
      await fetch(`/api/leads/${leadId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: noteType, content: noteText.trim() }),
      });
      setNoteText('');
      loadAll();
    } catch { /* silent */ }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          title: taskTitle.trim(),
          type: taskType,
          due_date: taskDue || undefined,
        }),
      });
      setTaskTitle('');
      setTaskDue('');
      loadAll();
    } catch { /* silent */ }
  };

  const toggleTask = async (id: number, current: number) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: current === 0 }),
    });
    loadAll();
  };

  const addTag = async (tagId: number) => {
    await fetch(`/api/leads/${leadId}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag_id: tagId }),
    });
    setShowTagPicker(false);
    loadAll();
  };

  const removeTag = async (tagId: number) => {
    await fetch(`/api/leads/${leadId}/tags/${tagId}`, { method: 'DELETE' });
    loadAll();
  };

  const createAndAddTag = async () => {
    if (!newTagName.trim()) return;
    const res = await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName.trim() }),
    });
    if (res.ok) {
      const d = await res.json();
      if (d.tag?.id) await addTag(d.tag.id);
      setNewTagName('');
    }
  };

  const sendReply = async () => {
    if (!replyBody.trim() || !replySubject.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/leads/${leadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: replySubject, body: replyBody }),
      });
      setReplyBody('');
      setReplySubject('');
      setShowReply(false);
      loadAll();
    } catch { /* silent */ }
    finally { setSending(false); }
  };

  if (loading) {
    return <div className="p-8 text-center text-elvora-text-dim">Laden...</div>;
  }

  if (!lead) {
    return (
      <div className="p-8 text-center">
        <div className="text-elvora-text-dim mb-4">Lead nicht gefunden</div>
        <Link href="/akquise" className="text-elvora-purple-light hover:underline">Zuruck zur Akquise</Link>
      </div>
    );
  }

  const problems = parseJson<Array<{ id?: string; label: string; severity?: string }>>(lead.problems, []);
  const seoIssues = parseJson<Array<{ id?: string; label: string; impact?: string }>>(lead.seo_issues, []);
  const weightedValue = (lead.deal_value || 0) * winProb / 100;

  const availableTags = allTags.filter(t => !leadTags.some(lt => lt.id === t.id));

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto pb-20">
      {/* Back */}
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-elvora-text-dim hover:text-white mb-4 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Zuruck
      </button>

      {/* Header */}
      <div className="glass-strong rounded-2xl p-6 mb-4">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">{lead.name}</h1>
            {lead.company && lead.company !== lead.name && (
              <p className="text-sm text-elvora-text-muted mt-0.5">{lead.company}</p>
            )}
            <p className="text-sm text-elvora-text-dim mt-1 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {lead.city}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Engagement Score Ring */}
            <div className="flex flex-col items-center">
              <div className={`text-2xl font-bold ${getScoreColor(lead.engagement_score)}`}>{lead.engagement_score}</div>
              <div className="text-[9px] uppercase tracking-wider text-elvora-text-dim">Engagement</div>
            </div>
            <div className="flex flex-col items-center">
              <div className={`text-2xl font-bold ${getScoreColor(100 - lead.score)}`}>{lead.score}</div>
              <div className="text-[9px] uppercase tracking-wider text-elvora-text-dim">Website</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${priorityConfig[lead.priority]?.color || 'bg-white/10'}`}>
              {priorityConfig[lead.priority]?.label || lead.priority}
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mt-4">
          {leadTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border"
              style={{ backgroundColor: tag.color + '20', borderColor: tag.color + '40', color: tag.color }}
            >
              {tag.name}
              <button onClick={() => removeTag(tag.id)} className="opacity-50 hover:opacity-100">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          <div className="relative">
            <button
              onClick={() => setShowTagPicker(!showTagPicker)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white/5 hover:bg-white/10 text-elvora-text-dim transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tag
            </button>
            {showTagPicker && (
              <div className="absolute z-10 mt-1 left-0 bg-elvora-bg-alt border border-white/10 rounded-lg p-2 shadow-2xl min-w-[200px]">
                <div className="flex gap-1 mb-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="Neuer Tag..."
                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder:text-elvora-text-dim focus:outline-none"
                    onKeyDown={e => e.key === 'Enter' && createAndAddTag()}
                  />
                  <button onClick={createAndAddTag} className="px-2 py-1 rounded bg-elvora-purple text-white text-xs">+</button>
                </div>
                {availableTags.length > 0 && (
                  <div className="space-y-0.5 max-h-40 overflow-y-auto">
                    {availableTags.map(t => (
                      <button
                        key={t.id}
                        onClick={() => addTag(t.id)}
                        className="w-full text-left px-2 py-1 rounded text-xs text-white hover:bg-white/5 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                        {t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Contact Info Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {lead.phone && (
          <a href={`tel:${lead.phone}`} className="glass rounded-xl p-3 border border-white/5 hover:border-elvora-purple/30 transition-all">
            <div className="text-[9px] uppercase tracking-wider text-elvora-text-dim mb-1">Telefon</div>
            <div className="text-sm text-white truncate">{lead.phone}</div>
          </a>
        )}
        {lead.email && (
          <a href={`mailto:${lead.email}`} className="glass rounded-xl p-3 border border-white/5 hover:border-elvora-purple/30 transition-all">
            <div className="text-[9px] uppercase tracking-wider text-elvora-text-dim mb-1">E-Mail</div>
            <div className="text-sm text-white truncate">{lead.email}</div>
          </a>
        )}
        {lead.website_original && (
          <a href={lead.website_original} target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-3 border border-white/5 hover:border-elvora-purple/30 transition-all">
            <div className="text-[9px] uppercase tracking-wider text-elvora-text-dim mb-1">Website</div>
            <div className="text-sm text-white truncate">{lead.website_original.replace(/^https?:\/\//, '')}</div>
          </a>
        )}
        {lead.linkedin_url && (
          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="glass rounded-xl p-3 border border-white/5 hover:border-elvora-purple/30 transition-all">
            <div className="text-[9px] uppercase tracking-wider text-elvora-text-dim mb-1">LinkedIn</div>
            <div className="text-sm text-white truncate">Profil</div>
          </a>
        )}
      </div>

      {/* Status Stepper */}
      <div className="glass rounded-2xl p-4 mb-4 border border-white/5">
        <div className="flex items-center gap-1 overflow-x-auto">
          {stages.map((stage, idx) => {
            const currentIdx = stages.findIndex(s => s.key === lead.contact_status);
            const isActive = stage.key === lead.contact_status;
            const isPast = currentIdx > idx;
            return (
              <button
                key={stage.key}
                onClick={() => updateStatus(stage.key)}
                className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg text-[11px] font-medium transition-all ${
                  isActive
                    ? 'bg-elvora-gradient text-white shadow-elvora'
                    : isPast
                      ? 'bg-elvora-purple/20 text-elvora-purple-light'
                      : 'bg-white/5 text-elvora-text-dim hover:bg-white/10'
                }`}
              >
                {stage.label}
              </button>
            );
          })}
          <button
            onClick={() => updateStatus('lost')}
            className={`px-3 py-2 rounded-lg text-[11px] font-medium transition-all ${
              lead.contact_status === 'lost' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40' : 'bg-white/5 text-elvora-text-dim hover:bg-red-500/10 hover:text-red-400'
            }`}
          >
            Verloren
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-white/5">
        {([
          ['thread', 'Thread', thread.length],
          ['activities', 'Aktivitaten', activities.length],
          ['tasks', 'Aufgaben', tasks.length],
          ['deal', 'Deal', null],
          ['info', 'Info', null],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
              tab === key ? 'border-elvora-purple text-white' : 'border-transparent text-elvora-text-dim hover:text-white'
            }`}
          >
            {label}{count !== null && count > 0 && <span className="ml-1.5 text-xs text-elvora-text-dim">({count})</span>}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'thread' && (
        <div className="space-y-2">
          {thread.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-elvora-text-dim text-sm">Noch keine E-Mail-Konversation</div>
          ) : thread.map(item => {
            const time = new Date(item.timestamp + 'Z');
            const timeStr = `${time.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} ${time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;

            if (item.type === 'initial_email') {
              return (
                <div key={item.id} className="glass rounded-xl p-3 border border-elvora-purple/20 bg-elvora-purple/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-elvora-purple-light">Erstansprache gesendet</span>
                    <span className="text-[10px] text-elvora-text-dim">{timeStr}</span>
                  </div>
                  <div className="text-[11px] text-elvora-text-dim mt-1">
                    {item.data.opened ? `${item.data.open_count}x geoffnet` : 'Nicht geoffnet'}
                  </div>
                </div>
              );
            }
            if (item.type === 'followup_sent') {
              return (
                <div key={item.id} className="glass rounded-xl p-3 border border-elvora-accent/20 bg-elvora-accent/5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-elvora-accent">Follow-Up {item.data.step as number} gesendet</span>
                    <span className="text-[10px] text-elvora-text-dim">{timeStr}</span>
                  </div>
                </div>
              );
            }
            if (item.type === 'followup_scheduled') {
              return (
                <div key={item.id} className="rounded-xl p-3 border border-dashed border-white/10 opacity-60">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-elvora-text-dim">Follow-Up {item.data.step as number} geplant</span>
                    <span className="text-[10px] text-elvora-text-dim">{timeStr}</span>
                  </div>
                </div>
              );
            }
            if (item.type === 'followup_cancelled') {
              return (
                <div key={item.id} className="rounded-xl p-2 opacity-40">
                  <span className="text-[11px] text-elvora-text-dim line-through">Follow-Up {item.data.step as number} abgebrochen</span>
                </div>
              );
            }
            if (item.type === 'reply') {
              return (
                <div key={item.id} className="glass rounded-xl p-3 border border-elvora-pink/20 bg-elvora-pink/5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-elvora-pink">
                      Antwort von {(item.data.from_name as string) || (item.data.from_email as string)}
                    </span>
                    <span className="text-[10px] text-elvora-text-dim">{timeStr}</span>
                  </div>
                  {Boolean(item.data.subject) && (
                    <div className="text-[11px] text-elvora-text-muted mb-1">Re: {item.data.subject as string}</div>
                  )}
                  <div className="text-xs text-elvora-text-muted whitespace-pre-wrap leading-relaxed">
                    {(item.data.body_text as string)?.substring(0, 400) || '(Kein Text)'}
                    {((item.data.body_text as string)?.length || 0) > 400 && '...'}
                  </div>
                </div>
              );
            }
            if (item.type === 'event') {
              const labels: Record<string, { label: string; color: string }> = {
                delivered: { label: 'Zugestellt', color: 'text-elvora-success' },
                bounced: { label: 'Bounce', color: 'text-red-400' },
                opened: { label: 'Geoffnet', color: 'text-elvora-success' },
                clicked: { label: 'Geklickt', color: 'text-elvora-accent' },
              };
              const ev = labels[item.data.event_type as string] || { label: item.data.event_type as string, color: 'text-elvora-text-dim' };
              return (
                <div key={item.id} className="flex items-center gap-2 px-4 py-1">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className={`text-[10px] font-medium ${ev.color}`}>{ev.label}</span>
                  <span className="text-[10px] text-elvora-text-dim">{timeStr}</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
              );
            }
            return null;
          })}

          {/* Reply form */}
          {lead.email && (
            <div className="mt-4">
              {!showReply ? (
                <button onClick={() => setShowReply(true)} className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple-light transition-colors">
                  Antwort schreiben
                </button>
              ) : (
                <div className="glass rounded-xl p-4 border border-white/5 space-y-2">
                  <input
                    type="text"
                    value={replySubject}
                    onChange={e => setReplySubject(e.target.value)}
                    placeholder="Betreff"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                  />
                  <textarea
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    placeholder="Nachricht..."
                    rows={6}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                  />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowReply(false)} className="px-3 py-1.5 rounded-lg text-sm text-elvora-text-dim hover:text-white">Abbrechen</button>
                    <button
                      onClick={sendReply}
                      disabled={sending || !replyBody.trim() || !replySubject.trim()}
                      className="px-4 py-1.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple-light disabled:opacity-50"
                    >
                      {sending ? 'Senden...' : 'Senden'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'activities' && (
        <div className="space-y-2">
          <div className="glass rounded-xl p-4 border border-white/5 mb-3">
            <div className="flex gap-2 mb-2">
              <select
                value={noteType}
                onChange={e => setNoteType(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
              >
                <option value="note">Notiz</option>
                <option value="call">Anruf</option>
                <option value="meeting">Meeting</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Was ist passiert?"
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 mb-2"
            />
            <div className="flex justify-end">
              <button
                onClick={addNote}
                disabled={!noteText.trim()}
                className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple-light disabled:opacity-50"
              >
                Hinzufugen
              </button>
            </div>
          </div>
          {activities.length === 0 ? (
            <div className="text-center text-elvora-text-dim text-sm py-6">Noch keine Aktivitaten</div>
          ) : activities.map(act => (
            <div key={act.id} className="glass rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">{act.type}</span>
                <span className="text-[10px] text-elvora-text-dim">{new Date(act.created_at + 'Z').toLocaleString('de-DE')}</span>
              </div>
              <p className="text-sm text-elvora-text-muted whitespace-pre-wrap">{act.content}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-2">
          <div className="glass rounded-xl p-4 border border-white/5 mb-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
              <input
                type="text"
                value={taskTitle}
                onChange={e => setTaskTitle(e.target.value)}
                placeholder="Aufgabe..."
                className="md:col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                onKeyDown={e => e.key === 'Enter' && addTask()}
              />
              <input
                type="date"
                value={taskDue}
                onChange={e => setTaskDue(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
              />
            </div>
            <div className="flex justify-between items-center">
              <select
                value={taskType}
                onChange={e => setTaskType(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
              >
                <option value="todo">To-Do</option>
                <option value="call">Anruf</option>
                <option value="email">E-Mail</option>
                <option value="meeting">Meeting</option>
                <option value="follow_up">Follow-Up</option>
              </select>
              <button
                onClick={addTask}
                disabled={!taskTitle.trim()}
                className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple-light disabled:opacity-50"
              >
                Aufgabe erstellen
              </button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <div className="text-center text-elvora-text-dim text-sm py-6">Keine Aufgaben fur diesen Lead</div>
          ) : tasks.map(t => {
            const overdue = t.is_completed === 0 && t.due_date && t.due_date < new Date().toISOString().split('T')[0];
            return (
              <div key={t.id} className={`glass rounded-xl p-3 border ${overdue ? 'border-red-500/30' : 'border-white/5'} ${t.is_completed ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleTask(t.id, t.is_completed)}
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      t.is_completed ? 'bg-elvora-success border-elvora-success' : 'border-white/20 hover:border-elvora-purple'
                    }`}
                  >
                    {t.is_completed === 1 && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1">
                    <div className={`text-sm ${t.is_completed ? 'line-through text-elvora-text-dim' : 'text-white'}`}>{t.title}</div>
                    {t.due_date && (
                      <span className={`text-[11px] ${overdue ? 'text-red-400 font-semibold' : 'text-elvora-text-dim'}`}>
                        {overdue ? 'Uberfallig: ' : 'Fallig: '}
                        {new Date(t.due_date).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'deal' && (
        <div className="glass rounded-2xl p-6 border border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold block mb-1.5">Deal-Wert (EUR)</label>
              <input
                type="number"
                value={dealValue}
                onChange={e => setDealValue(e.target.value)}
                placeholder="0"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold block mb-1.5">Erwartetes Abschlussdatum</label>
              <input
                type="date"
                value={closeDate}
                onChange={e => setCloseDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold block mb-1.5">Gewinnwahrscheinlichkeit</label>
              <select
                value={winProb}
                onChange={e => setWinProb(parseInt(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-elvora-purple/50"
              >
                <option value={10}>10%</option>
                <option value={25}>25%</option>
                <option value={50}>50%</option>
                <option value={75}>75%</option>
                <option value={90}>90%</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold block mb-1.5">Gewichteter Wert</label>
              <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-elvora-success font-bold">
                {weightedValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR
              </div>
            </div>
          </div>
          {lead.contact_status === 'lost' && (
            <div className="mt-4">
              <label className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold block mb-1.5">Grund (verloren)</label>
              <textarea
                value={lostReason}
                onChange={e => setLostReason(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-elvora-text-dim focus:outline-none focus:border-elvora-purple/50"
                placeholder="Warum verloren?"
              />
            </div>
          )}
          <div className="flex justify-end mt-4">
            <button
              onClick={saveDeal}
              className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple-light"
            >
              Deal speichern
            </button>
          </div>
        </div>
      )}

      {tab === 'info' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim mb-1">Website-Score</div>
              <div className={`text-3xl font-bold ${getScoreColor(100 - lead.score)}`}>{lead.score}/100</div>
            </div>
            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim mb-1">E-Mail Opens</div>
              <div className="text-3xl font-bold text-white">{lead.total_opens || 0}</div>
            </div>
            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim mb-1">Antworten</div>
              <div className="text-3xl font-bold text-white">{lead.replies_count || 0}</div>
            </div>
          </div>

          {audit && (
            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-white font-medium">Audit-Seite</div>
                  <div className="text-[11px] text-elvora-text-dim">{audit.views} Aufrufe, {audit.cta_clicks} CTA-Klicks</div>
                </div>
                <Link href={`/audit/${audit.slug}`} target="_blank" className="text-elvora-purple-light text-sm hover:underline">Offnen</Link>
              </div>
            </div>
          )}

          {problems.length > 0 && (
            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim mb-2 font-semibold">Probleme</div>
              <div className="space-y-1.5">
                {problems.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {p.severity && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        p.severity === 'critical' ? 'bg-red-500/15 text-red-400' :
                        p.severity === 'major' ? 'bg-elvora-warning/15 text-elvora-warning' :
                        'bg-white/10 text-elvora-text-dim'
                      }`}>{p.severity}</span>
                    )}
                    <span className="text-sm text-elvora-text-muted">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {seoIssues.length > 0 && (
            <div className="glass rounded-xl p-4 border border-white/5">
              <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim mb-2 font-semibold">SEO-Probleme</div>
              <div className="space-y-1.5">
                {seoIssues.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {p.impact && (
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                        p.impact === 'high' ? 'bg-red-500/15 text-red-400' :
                        p.impact === 'medium' ? 'bg-elvora-warning/15 text-elvora-warning' :
                        'bg-white/10 text-elvora-text-dim'
                      }`}>{p.impact}</span>
                    )}
                    <span className="text-sm text-elvora-text-muted">{p.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass rounded-xl p-4 border border-white/5 text-[11px] text-elvora-text-dim space-y-1">
            {lead.found_via_keywords && <div>Gefunden uber: <span className="text-elvora-text-muted">{lead.found_via_keywords}</span></div>}
            <div>Gefunden: {lead.times_found}x</div>
            <div>Erstellt: {new Date(lead.created_at + 'Z').toLocaleString('de-DE')}</div>
            <div>Aktualisiert: {new Date(lead.updated_at + 'Z').toLocaleString('de-DE')}</div>
          </div>
        </div>
      )}
    </div>
  );
}
