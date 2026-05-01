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
  best_contact_hour: number | null;
  best_contact_day: string | null;
  predicted_close_probability: number | null;
  predicted_reasons: string | null;
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

interface Contact {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_primary: number;
}

interface Competitor {
  id: number;
  competitor_name: string;
  competitor_website: string | null;
  competitor_score: number | null;
  competitor_has_ssl: number;
  competitor_response_ms: number;
}

interface Proposal {
  id: number;
  title: string;
  amount: number | null;
  status: string;
  sent_at: string | null;
  created_at: string;
}

interface ReviewSnapshot {
  id: number;
  rating: number;
  review_count: number;
  checked_at: string;
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
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [reviews, setReviews] = useState<ReviewSnapshot[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'thread' | 'activities' | 'tasks' | 'deal' | 'info' | 'extras'>('thread');

  // Extras: AI Predict / Call Script / Competitor / Contact / Proposal forms
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<{ probability: number; reasons: string[]; estimated_days_to_close: number | null } | null>(null);
  const [scriptGenerating, setScriptGenerating] = useState(false);
  const [callScript, setCallScript] = useState<Record<string, string> | null>(null);
  const [analyzingComp, setAnalyzingComp] = useState(false);
  const [checkingReviews, setCheckingReviews] = useState(false);
  const [reviewMsg, setReviewMsg] = useState('');
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [propTitle, setPropTitle] = useState('');
  const [propAmount, setPropAmount] = useState('');
  const [propStatus, setPropStatus] = useState('draft');

  // Decision Maker Finder
  const [findingDM, setFindingDM] = useState(false);
  const [dmResults, setDmResults] = useState<Array<{ name: string; headline: string; linkedinUrl: string; relevanceScore: number; source: string; email: string | null; phone: string | null }>>([]);
  const [impressumData, setImpressumData] = useState<{ geschaeftsfuehrer: string | null; emails: string[]; phones: string[]; ustIdNr: string | null } | null>(null);

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
        setContacts(d.contacts || []);
        setCompetitors(d.competitors || []);
        setProposals(d.proposals || []);
        setReviews(d.reviews || []);
        if (d.lead?.predicted_close_probability !== null && d.lead?.predicted_close_probability !== undefined) {
          let reasons: string[] = [];
          try { reasons = JSON.parse(d.lead.predicted_reasons || '[]'); } catch { /* ignore */ }
          setPrediction({ probability: d.lead.predicted_close_probability, reasons, estimated_days_to_close: null });
        }
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

  const runPredict = async () => {
    setPredicting(true);
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setPrediction({ probability: d.probability, reasons: d.reasons, estimated_days_to_close: d.estimated_days_to_close });
      }
    } catch { /* silent */ }
    finally { setPredicting(false); }
  };

  const generateScript = async () => {
    setScriptGenerating(true);
    try {
      const res = await fetch('/api/ai/call-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId }),
      });
      const d = await res.json();
      if (res.ok && d.script) setCallScript(d.script);
    } catch { /* silent */ }
    finally { setScriptGenerating(false); }
  };

  const analyzeCompetitors = async () => {
    setAnalyzingComp(true);
    try {
      const res = await fetch(`/api/competitors/${leadId}`, { method: 'POST' });
      if (res.ok) loadAll();
    } catch { /* silent */ }
    finally { setAnalyzingComp(false); }
  };

  const checkReviews = async () => {
    setCheckingReviews(true);
    setReviewMsg('');
    try {
      const res = await fetch(`/api/leads/${leadId}/reviews`, { method: 'POST' });
      const d = await res.json();
      if (res.ok && d.success) {
        setReviewMsg(`Aktuell: ${d.snapshot.rating}★ (${d.snapshot.review_count})`);
        loadAll();
      } else {
        setReviewMsg(d.message || 'Fehler');
      }
    } catch { setReviewMsg('Netzwerkfehler'); }
    finally { setCheckingReviews(false); }
  };

  const calcBestTime = async () => {
    try {
      await fetch(`/api/leads/${leadId}/best-time`);
      loadAll();
    } catch { /* silent */ }
  };

  const findDecisionMaker = async () => {
    setFindingDM(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/find-decision-maker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoSave: true }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setDmResults(d.results || []);
        if (d.impressum) setImpressumData(d.impressum);
        loadAll();
      }
    } catch { /* silent */ }
    finally { setFindingDM(false); }
  };

  const saveDmAsContact = async (person: { name: string; headline: string; linkedinUrl: string; email: string | null; phone: string | null }) => {
    await fetch(`/api/leads/${leadId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: person.name,
        role: person.headline,
        email: person.email || undefined,
        phone: person.phone || undefined,
        is_primary: true,
        notes: person.linkedinUrl ? `LinkedIn: ${person.linkedinUrl}` : undefined,
      }),
    });
    loadAll();
  };

  const addContact = async () => {
    if (!contactName.trim()) return;
    await fetch(`/api/leads/${leadId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: contactName.trim(),
        role: contactRole || undefined,
        email: contactEmail || undefined,
        phone: contactPhone || undefined,
      }),
    });
    setContactName(''); setContactRole(''); setContactEmail(''); setContactPhone('');
    setShowContactForm(false);
    loadAll();
  };

  const deleteContact = async (id: number) => {
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    loadAll();
  };

  const addProposal = async () => {
    if (!propTitle.trim()) return;
    await fetch(`/api/leads/${leadId}/proposals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: propTitle.trim(),
        amount: propAmount ? parseFloat(propAmount) : undefined,
        status: propStatus,
      }),
    });
    setPropTitle(''); setPropAmount(''); setPropStatus('draft');
    setShowProposalForm(false);
    loadAll();
  };

  const updateProposalStatus = async (id: number, status: string) => {
    await fetch(`/api/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAll();
  };

  const deleteProposal = async (id: number) => {
    await fetch(`/api/proposals/${id}`, { method: 'DELETE' });
    loadAll();
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
          ['extras', 'Mehr', contacts.length + proposals.length + competitors.length],
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

      {tab === 'extras' && (
        <div className="space-y-4">
          {/* AI Predict */}
          <div className="glass rounded-2xl p-5 border border-elvora-purple/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">KI-Prognose</span>
                {prediction && <span className="px-1.5 py-0.5 rounded bg-elvora-purple/15 text-elvora-purple-light text-[9px] font-bold">Aktiv</span>}
              </div>
              <button
                onClick={runPredict}
                disabled={predicting}
                className="px-3 py-1.5 rounded-lg bg-elvora-purple/15 border border-elvora-purple/30 text-elvora-purple-light text-xs font-semibold hover:bg-elvora-purple/25 disabled:opacity-50"
              >
                {predicting ? 'Berechne...' : prediction ? 'Neu berechnen' : 'Abschluss-Wahrscheinlichkeit'}
              </button>
            </div>
            {prediction && (
              <div>
                <div className="flex items-baseline gap-3 mb-2">
                  <span className={`text-4xl font-bold ${prediction.probability >= 70 ? 'text-elvora-success' : prediction.probability >= 40 ? 'text-elvora-warning' : 'text-red-400'}`}>{prediction.probability}%</span>
                  <span className="text-xs text-elvora-text-dim">Abschluss-Wahrscheinlichkeit</span>
                </div>
                {prediction.reasons.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {prediction.reasons.map((r, i) => (
                      <li key={i} className="text-xs text-elvora-text-muted flex items-start gap-2">
                        <span className="text-elvora-purple-light mt-0.5">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* AI Call Script */}
          <div className="glass rounded-2xl p-5 border border-elvora-accent/20">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">KI-Anruf-Coach</span>
              <button
                onClick={generateScript}
                disabled={scriptGenerating}
                className="px-3 py-1.5 rounded-lg bg-elvora-accent/15 border border-elvora-accent/30 text-elvora-accent text-xs font-semibold hover:bg-elvora-accent/25 disabled:opacity-50"
              >
                {scriptGenerating ? 'Generiere...' : callScript ? 'Neu generieren' : 'Skript erstellen'}
              </button>
            </div>
            {callScript && (
              <div className="space-y-3">
                {(['einstieg', 'problem', 'loesung', 'cta'] as const).map(k => callScript[k] && (
                  <div key={k}>
                    <div className="text-[10px] uppercase tracking-wider text-elvora-accent font-semibold mb-1">{k}</div>
                    <p className="text-sm text-white">{callScript[k]}</p>
                  </div>
                ))}
                <div className="border-t border-white/5 pt-3 space-y-2">
                  <div className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">Einwand-Antworten</div>
                  {(['einwand_kein_interesse', 'einwand_zu_teuer', 'einwand_keine_zeit'] as const).map(k => callScript[k] && (
                    <div key={k} className="text-xs">
                      <span className="text-elvora-text-dim">{k.replace('einwand_', '').replace(/_/g, ' ')}: </span>
                      <span className="text-elvora-text-muted">{callScript[k]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Smart Timing */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">Beste Kontaktzeit</span>
              <button
                onClick={calcBestTime}
                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-elvora-text-muted text-xs font-semibold hover:bg-white/10"
              >
                Berechnen
              </button>
            </div>
            {lead.best_contact_hour !== null && lead.best_contact_day ? (
              <div className="text-sm text-white">
                <span className="text-elvora-success font-bold">{lead.best_contact_day}</span> um <span className="text-elvora-success font-bold">{String(lead.best_contact_hour).padStart(2, '0')}:00</span>
                <div className="text-[11px] text-elvora-text-dim mt-1">basiert auf E-Mail-Engagement</div>
              </div>
            ) : (
              <div className="text-xs text-elvora-text-dim">Noch keine Engagement-Daten</div>
            )}
          </div>

          {/* Entscheider-Finder */}
          <div className="glass rounded-2xl p-5 border border-elvora-pink/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">Entscheider finden</span>
                {dmResults.length > 0 && <span className="px-1.5 py-0.5 rounded bg-elvora-pink/15 text-elvora-pink text-[9px] font-bold">{dmResults.length} gefunden</span>}
              </div>
              <button
                onClick={findDecisionMaker}
                disabled={findingDM}
                className="px-3 py-1.5 rounded-lg bg-elvora-pink/15 border border-elvora-pink/30 text-elvora-pink text-xs font-semibold hover:bg-elvora-pink/25 disabled:opacity-50"
              >
                {findingDM ? 'Suche...' : 'LinkedIn + Impressum durchsuchen'}
              </button>
            </div>
            <div className="text-[10px] text-elvora-text-dim mb-3">Durchsucht LinkedIn und das Impressum der Website nach Geschäftsführer / Inhaber</div>

            {impressumData && (impressumData.geschaeftsfuehrer || impressumData.emails.length > 0) && (
              <div className="mb-3 rounded-lg bg-elvora-success/10 border border-elvora-success/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-elvora-success font-semibold mb-1">Impressum-Daten</div>
                {impressumData.geschaeftsfuehrer && <div className="text-sm text-white font-medium">{impressumData.geschaeftsfuehrer}</div>}
                {impressumData.emails.map((e, i) => <div key={i} className="text-xs text-elvora-text-muted">{e}</div>)}
                {impressumData.phones.map((p, i) => <div key={i} className="text-xs text-elvora-text-muted">{p}</div>)}
                {impressumData.ustIdNr && <div className="text-[10px] text-elvora-text-dim mt-1">USt-IdNr: {impressumData.ustIdNr}</div>}
              </div>
            )}

            {dmResults.length > 0 && (
              <div className="space-y-2">
                {dmResults.map((p, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium truncate">{p.name}</span>
                        <span className={`px-1 py-0.5 rounded text-[8px] font-bold ${p.source === 'impressum' ? 'bg-elvora-success/15 text-elvora-success' : 'bg-elvora-accent/15 text-elvora-accent'}`}>
                          {p.source === 'impressum' ? 'Impressum' : 'LinkedIn'}
                        </span>
                        {p.relevanceScore >= 90 && <span className="px-1 py-0.5 rounded bg-elvora-pink/15 text-elvora-pink text-[8px] font-bold">Top</span>}
                      </div>
                      <div className="text-xs text-elvora-text-dim truncate">{p.headline}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {p.email && <span className="text-[10px] text-elvora-text-muted">{p.email}</span>}
                        {p.linkedinUrl && (
                          <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-elvora-accent hover:underline">LinkedIn</a>
                        )}
                      </div>
                    </div>
                    {!contacts.find(c => c.name === p.name) && (
                      <button
                        onClick={() => saveDmAsContact(p)}
                        className="ml-2 px-2 py-1 rounded bg-elvora-purple/15 text-elvora-purple-light text-[10px] font-semibold hover:bg-elvora-purple/25 whitespace-nowrap"
                      >
                        + Kontakt
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kontakte */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">Kontaktpersonen ({contacts.length})</span>
              <button onClick={() => setShowContactForm(!showContactForm)} className="text-xs text-elvora-purple-light hover:underline">
                {showContactForm ? 'Abbrechen' : '+ Hinzufügen'}
              </button>
            </div>
            {showContactForm && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                <input type="text" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Name" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
                <input type="text" value={contactRole} onChange={e => setContactRole(e.target.value)} placeholder="Rolle" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="E-Mail" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
                <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Telefon" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
                <button onClick={addContact} className="md:col-span-2 px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-sm">Hinzufügen</button>
              </div>
            )}
            {contacts.length === 0 ? (
              <div className="text-xs text-elvora-text-dim">Keine Kontakte</div>
            ) : (
              <div className="space-y-2">
                {contacts.map(c => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 group">
                    <div>
                      <div className="text-sm text-white font-medium">{c.name} {c.is_primary === 1 && <span className="ml-1 px-1 py-0.5 rounded bg-elvora-purple/20 text-elvora-purple-light text-[9px] font-bold">PRIMARY</span>}</div>
                      <div className="text-xs text-elvora-text-dim">
                        {c.role && <span>{c.role}</span>}
                        {c.email && <span className="ml-2">{c.email}</span>}
                        {c.phone && <span className="ml-2">{c.phone}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteContact(c.id)} className="opacity-0 group-hover:opacity-100 text-elvora-text-dim hover:text-red-400 transition-all p-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Konkurrenz-Vergleich */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">Konkurrenz-Vergleich ({competitors.length})</span>
              <button onClick={analyzeCompetitors} disabled={analyzingComp} className="text-xs text-elvora-purple-light hover:underline disabled:opacity-50">
                {analyzingComp ? 'Analysiere...' : '↻ Konkurrenten finden'}
              </button>
            </div>
            {competitors.length === 0 ? (
              <div className="text-xs text-elvora-text-dim">Noch keine Konkurrenten analysiert</div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-elvora-purple/10 border border-elvora-purple/20">
                  <span className="text-white font-bold">{lead.name} (Sie)</span>
                  <span className="text-elvora-purple-light font-bold">{lead.score}/100</span>
                </div>
                {competitors.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">{c.competitor_name}</div>
                      <div className="text-[10px] text-elvora-text-dim">
                        {c.competitor_has_ssl === 1 ? '🔒 SSL' : '⚠ Kein SSL'} · {c.competitor_response_ms}ms
                      </div>
                    </div>
                    <span className={`font-bold ml-2 ${(c.competitor_score || 0) >= (lead.score || 0) ? 'text-elvora-success' : 'text-red-400'}`}>
                      {c.competitor_score || 0}/100
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviews */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">Google-Bewertungen</span>
              <button onClick={checkReviews} disabled={checkingReviews} className="text-xs text-elvora-purple-light hover:underline disabled:opacity-50">
                {checkingReviews ? 'Prüfe...' : '↻ Aktualisieren'}
              </button>
            </div>
            {reviewMsg && <div className="text-xs text-elvora-text-muted mb-2">{reviewMsg}</div>}
            {reviews.length === 0 ? (
              <div className="text-xs text-elvora-text-dim">Noch keine Bewertungs-Snapshots</div>
            ) : (
              <div className="space-y-1">
                {reviews.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-xs px-3 py-1.5 rounded bg-white/5">
                    <span className="text-elvora-text-dim">{new Date(r.checked_at + 'Z').toLocaleDateString('de-DE')}</span>
                    <span className="text-white font-bold">{r.rating}★ <span className="text-elvora-text-dim font-normal">({r.review_count} Bewertungen)</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Angebote */}
          <div className="glass rounded-2xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-semibold">Angebote ({proposals.length})</span>
              <button onClick={() => setShowProposalForm(!showProposalForm)} className="text-xs text-elvora-purple-light hover:underline">
                {showProposalForm ? 'Abbrechen' : '+ Angebot'}
              </button>
            </div>
            {showProposalForm && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                <input type="text" value={propTitle} onChange={e => setPropTitle(e.target.value)} placeholder="Titel" className="md:col-span-2 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
                <input type="number" value={propAmount} onChange={e => setPropAmount(e.target.value)} placeholder="Betrag (EUR)" className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white" />
                <select value={propStatus} onChange={e => setPropStatus(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white">
                  <option value="draft">Entwurf</option>
                  <option value="sent">Gesendet</option>
                  <option value="viewed">Angesehen</option>
                  <option value="accepted">Angenommen</option>
                  <option value="rejected">Abgelehnt</option>
                </select>
                <button onClick={addProposal} className="md:col-span-2 px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-sm">Hinzufügen</button>
              </div>
            )}
            {proposals.length === 0 ? (
              <div className="text-xs text-elvora-text-dim">Keine Angebote</div>
            ) : (
              <div className="space-y-2">
                {proposals.map(p => {
                  const statusColors: Record<string, string> = {
                    draft: 'bg-white/10 text-elvora-text-muted',
                    sent: 'bg-elvora-purple/15 text-elvora-purple-light',
                    viewed: 'bg-elvora-accent/15 text-elvora-accent',
                    accepted: 'bg-elvora-success/15 text-elvora-success',
                    rejected: 'bg-red-500/15 text-red-400',
                  };
                  return (
                    <div key={p.id} className="rounded-lg bg-white/5 px-3 py-2 group">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-white font-medium">{p.title}</div>
                          <div className="text-xs text-elvora-text-dim">{p.amount ? `${p.amount.toLocaleString('de-DE')} EUR` : 'Kein Betrag'} · {new Date(p.created_at + 'Z').toLocaleDateString('de-DE')}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select value={p.status} onChange={e => updateProposalStatus(p.id, e.target.value)} className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${statusColors[p.status]} border-0 focus:outline-none`}>
                            <option value="draft">Entwurf</option>
                            <option value="sent">Gesendet</option>
                            <option value="viewed">Angesehen</option>
                            <option value="accepted">Angenommen</option>
                            <option value="rejected">Abgelehnt</option>
                          </select>
                          <button onClick={() => deleteProposal(p.id)} className="opacity-0 group-hover:opacity-100 text-elvora-text-dim hover:text-red-400 transition-all p-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
