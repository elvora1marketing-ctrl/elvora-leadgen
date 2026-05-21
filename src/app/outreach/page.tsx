'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface LeadSample {
  id: number;
  name: string;
  city: string;
  score: number;
  email: string | null;
  entscheider_email: string | null;
  entscheider_name: string | null;
  contact_status: string;
}

interface Campaign {
  id: number;
  name: string;
  status: string;
  filters: Record<string, unknown>;
  lead_count: number;
  sent: number;
  failed: number;
  skipped: number;
  opened: number;
  replied: number;
  bounced: number;
  clicked: number;
  mails_per_hour: number;
  prefer_entscheider: boolean;
  schedule_type: string;
  subject_variant_b: string | null;
  ab_split: boolean;
  job_id: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  liveStatus: string | null;
  liveProgress: {
    currentIndex: number;
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    results: Array<{ leadId: number; recipient: string | null; type: string | null; success: boolean; error?: string; at: string }>;
  } | null;
  openRate: number;
  replyRate: number;
  bounceRate: number;
}

interface Analytics {
  overview: {
    totalSent: number;
    totalOpened: number;
    totalReplied: number;
    totalBounced: number;
    totalCampaigns: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
    blacklisted: number;
  };
  dailySends: { day: string; count: number }[];
  recentCampaigns: Array<Campaign & { openRate: number; replyRate: number }>;
  contactStatusDist: { contact_status: string; count: number }[];
}

interface BlacklistEntry { id: number; email: string; reason: string; created_at: string }

interface RenderedEmail {
  recipient: string | null;
  recipientType: string | null;
  ansprechpartner: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
  error?: string;
}

type Tab = 'campaigns' | 'new' | 'analytics' | 'blacklist';

export default function OutreachPage() {
  const [tab, setTab] = useState<Tab>('campaigns');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blacklistCount, setBlacklistCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New campaign state
  const [campaignName, setCampaignName] = useState('');
  const [city, setCity] = useState('');
  const [keyword, setKeyword] = useState('');
  const [minScore, setMinScore] = useState<number | ''>('');
  const [maxScore, setMaxScore] = useState<number | ''>(60);
  const [contactStatus, setContactStatus] = useState('not_contacted');
  const [onlyWithEmail, setOnlyWithEmail] = useState(true);
  const [preferEntscheider, setPreferEntscheider] = useState(true);
  const [mailsPerHour, setMailsPerHour] = useState(60);
  const [scheduleType, setScheduleType] = useState<'immediate' | 'business_hours'>('immediate');
  const [abEnabled, setAbEnabled] = useState(false);
  const [subjectVariantB, setSubjectVariantB] = useState('');

  // Lead preview
  const [count, setCount] = useState<number | null>(null);
  const [sample, setSample] = useState<LeadSample[]>([]);
  const [previewLead, setPreviewLead] = useState<LeadSample | null>(null);
  const [preview, setPreview] = useState<RenderedEmail | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Campaign detail
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);

  // Blacklist
  const [newBlacklistEmail, setNewBlacklistEmail] = useState('');

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.outreach_default_mails_per_hour) setMailsPerHour(parseInt(data.outreach_default_mails_per_hour));
        if (data.outreach_prefer_entscheider) setPreferEntscheider(data.outreach_prefer_entscheider === 'true');
      })
      .catch(() => {});
  }, []);

  const loadCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/outreach/campaigns');
      if (res.ok) { const data = await res.json(); setCampaigns(data.campaigns || []); }
    } catch {}
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/outreach/analytics');
      if (res.ok) setAnalytics(await res.json());
    } catch {}
  }, []);

  const loadBlacklist = useCallback(async () => {
    try {
      const res = await fetch('/api/outreach/blacklist');
      if (res.ok) { const data = await res.json(); setBlacklist(data.entries || []); setBlacklistCount(data.count || 0); }
    } catch {}
  }, []);

  useEffect(() => {
    loadCampaigns();
    loadAnalytics();
  }, [loadCampaigns, loadAnalytics]);

  useEffect(() => {
    if (tab === 'blacklist') loadBlacklist();
  }, [tab, loadBlacklist]);

  // Poll running campaigns
  useEffect(() => {
    const hasRunning = campaigns.some(c => c.status === 'running' || c.liveStatus === 'running');
    if (hasRunning) {
      if (!pollTimer.current) {
        pollTimer.current = setInterval(() => {
          loadCampaigns();
          loadAnalytics();
        }, 3000);
      }
    } else {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    }
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [campaigns, loadCampaigns, loadAnalytics]);

  // Filter count for new campaign
  const loadFilterCount = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'count' });
      if (city) params.set('city', city);
      if (keyword) params.set('keyword', keyword);
      if (minScore !== '') params.set('minScore', String(minScore));
      if (maxScore !== '') params.set('maxScore', String(maxScore));
      if (contactStatus) params.set('contactStatus', contactStatus);
      params.set('onlyWithEmail', String(onlyWithEmail));
      const res = await fetch(`/api/email/outreach?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCount(data.count);
        setSample(data.sample || []);
        if (data.sample?.length > 0 && !previewLead) setPreviewLead(data.sample[0]);
      }
    } catch {}
    finally { setLoading(false); }
  }, [city, keyword, minScore, maxScore, contactStatus, onlyWithEmail, previewLead]);

  useEffect(() => {
    if (tab !== 'new') return;
    const t = setTimeout(() => loadFilterCount(), 400);
    return () => clearTimeout(t);
  }, [tab, loadFilterCount]);

  const loadPreview = useCallback(async (leadId: number) => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/email/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview: { leadId }, preferEntscheider }),
      });
      const data = await res.json();
      setPreview(data);
    } catch { setPreview(null); }
    finally { setPreviewLoading(false); }
  }, [preferEntscheider]);

  useEffect(() => { if (previewLead) loadPreview(previewLead.id); }, [previewLead, loadPreview]);

  const createCampaign = async () => {
    if (!campaignName.trim()) { setError('Kampagnenname erforderlich'); return; }
    if (!count || count === 0) { setError('Keine Leads gefunden'); return; }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName,
          filters: { city: city || undefined, keyword: keyword || undefined, minScore: minScore || undefined, maxScore: maxScore || undefined, contactStatus: contactStatus || undefined, onlyWithEmail },
          mailsPerHour,
          preferEntscheider,
          scheduleType,
          subjectVariantB: abEnabled ? subjectVariantB : undefined,
          abSplit: abEnabled,
        }),
      });
      if (!res.ok) { const data = await res.json(); setError(data.error); return; }
      const data = await res.json();
      setSuccess(`Kampagne "${data.campaign.name}" erstellt mit ${data.campaign.lead_count} Leads`);
      setCampaignName('');
      setTab('campaigns');
      loadCampaigns();
      setTimeout(() => setSuccess(null), 4000);
    } catch { setError('Netzwerkfehler'); }
    finally { setLoading(false); }
  };

  const startCampaign = async (id: number) => {
    try {
      const res = await fetch('/api/outreach/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', campaignId: id }),
      });
      if (!res.ok) { const data = await res.json(); setError(data.error); return; }
      setSuccess('Kampagne gestartet');
      loadCampaigns();
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError('Startfehler'); }
  };

  const campaignAction = async (id: number, action: string) => {
    try {
      await fetch(`/api/outreach/campaigns/${id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      loadCampaigns();
    } catch {}
  };

  const addToBlacklist = async () => {
    if (!newBlacklistEmail.trim()) return;
    const emails = newBlacklistEmail.split(/[,;\n]/).map(e => e.trim()).filter(Boolean);
    await fetch('/api/outreach/blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    setNewBlacklistEmail('');
    loadBlacklist();
  };

  const removeFromBlacklist = async (id: number) => {
    await fetch('/api/outreach/blacklist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    loadBlacklist();
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: 'Entwurf', running: 'Aktiv', paused: 'Pausiert', completed: 'Fertig', cancelled: 'Abgebrochen' };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-white/10 text-elvora-text-dim',
      running: 'bg-elvora-success/15 text-elvora-success',
      paused: 'bg-elvora-warning/15 text-elvora-warning',
      completed: 'bg-elvora-purple/15 text-elvora-purple-light',
      cancelled: 'bg-red-500/15 text-red-400',
    };
    return map[s] || 'bg-white/10 text-elvora-text-dim';
  };

  const estimateMinutes = count && count > 0 ? Math.ceil((count * (3600 / mailsPerHour)) / 60) : 0;

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'campaigns', label: 'Kampagnen', badge: campaigns.filter(c => c.status === 'running').length || undefined },
    { id: 'new', label: 'Neue Kampagne' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'blacklist', label: 'Blacklist', badge: blacklistCount || undefined },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto pt-16 lg:pt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Email Outreach</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Kampagnen erstellen, verwalten und analysieren</p>
        </div>
        <button
          onClick={() => setTab('new')}
          className="px-4 py-2 rounded-lg bg-elvora-gradient text-white text-sm font-semibold shadow-elvora hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Neue Kampagne
        </button>
      </div>

      {/* KPI Cards */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Gesendet', value: analytics.overview.totalSent, color: 'text-elvora-text', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
            { label: 'Öffnungsrate', value: `${analytics.overview.openRate}%`, color: 'text-elvora-success', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
            { label: 'Antwortrate', value: `${analytics.overview.replyRate}%`, color: 'text-elvora-purple-light', icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6' },
            { label: 'Bounce-Rate', value: `${analytics.overview.bounceRate}%`, color: analytics.overview.bounceRate > 5 ? 'text-red-400' : 'text-elvora-text-dim', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
            { label: 'Kampagnen', value: analytics.overview.totalCampaigns, color: 'text-elvora-text', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
          ].map((kpi, i) => (
            <div key={i} className="card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={kpi.icon} /></svg>
                <span className="text-[10px] uppercase tracking-wider text-elvora-text-dim font-medium">{kpi.label}</span>
              </div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">×</button>
        </div>
      )}
      {success && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-elvora-success/10 border border-elvora-success/30 text-elvora-success text-sm">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              tab === t.id
                ? 'bg-elvora-purple/15 text-elvora-purple-light border border-elvora-purple/30'
                : 'text-elvora-text-muted hover:text-elvora-text hover:bg-white/5'
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="min-w-[18px] h-[18px] rounded-full bg-elvora-purple/20 text-elvora-purple-light text-[10px] font-semibold flex items-center justify-center px-1">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ==================== CAMPAIGNS TAB ==================== */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="card rounded-xl p-12 text-center">
              <svg className="w-12 h-12 text-elvora-text-dim mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              <h3 className="text-lg font-semibold text-elvora-text mb-2">Keine Kampagnen</h3>
              <p className="text-sm text-elvora-text-dim mb-4">Erstelle deine erste Outreach-Kampagne, um personalisierte Mails an Leads zu versenden.</p>
              <button onClick={() => setTab('new')} className="px-4 py-2 rounded-lg bg-elvora-gradient text-white text-sm font-semibold">
                Kampagne erstellen
              </button>
            </div>
          ) : (
            campaigns.map(c => {
              const isLive = c.liveStatus === 'running' || c.status === 'running';
              const progress = c.liveProgress ? Math.round((c.liveProgress.currentIndex / Math.max(1, c.liveProgress.total)) * 100) : (c.sent > 0 ? Math.round((c.sent / Math.max(1, c.lead_count)) * 100) : 0);
              const effectiveStatus = c.liveStatus || c.status;

              return (
                <div key={c.id} className={`card rounded-xl p-5 ${isLive ? 'border border-elvora-success/30' : ''}`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-base font-semibold text-elvora-text truncate">{c.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(effectiveStatus)}`}>
                          {statusLabel(effectiveStatus)}
                        </span>
                        {c.ab_split && <span className="text-[10px] px-2 py-0.5 rounded-full bg-elvora-accent/15 text-elvora-accent font-medium">A/B</span>}
                        {c.schedule_type === 'business_hours' && <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">9-18 Uhr</span>}
                      </div>
                      <div className="text-xs text-elvora-text-dim flex items-center gap-3 flex-wrap">
                        <span>{c.lead_count} Leads</span>
                        <span>{c.mails_per_hour}/h</span>
                        {c.prefer_entscheider && <span className="text-elvora-purple-light">GF-Targeting</span>}
                        <span>{new Date(c.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {effectiveStatus === 'draft' && (
                        <button onClick={() => startCampaign(c.id)} className="px-3 py-1.5 rounded-lg bg-elvora-gradient text-white text-xs font-semibold shadow-elvora hover:opacity-90">
                          Starten
                        </button>
                      )}
                      {effectiveStatus === 'running' && (
                        <button onClick={() => campaignAction(c.id, 'pause')} className="px-3 py-1.5 rounded-lg bg-elvora-warning/15 text-elvora-warning text-xs font-medium hover:bg-elvora-warning/25">
                          Pause
                        </button>
                      )}
                      {effectiveStatus === 'paused' && (
                        <button onClick={() => campaignAction(c.id, 'resume')} className="px-3 py-1.5 rounded-lg bg-elvora-success/15 text-elvora-success text-xs font-medium hover:bg-elvora-success/25">
                          Fortsetzen
                        </button>
                      )}
                      {(effectiveStatus === 'running' || effectiveStatus === 'paused') && (
                        <button onClick={() => campaignAction(c.id, 'cancel')} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20">
                          Stop
                        </button>
                      )}
                      {(effectiveStatus === 'completed' || effectiveStatus === 'cancelled' || effectiveStatus === 'draft') && (
                        <button onClick={() => campaignAction(c.id, 'delete')} className="px-3 py-1.5 rounded-lg bg-white/5 text-elvora-text-dim text-xs hover:bg-white/10 hover:text-red-400">
                          Löschen
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-4">
                    <div
                      className={`h-full transition-all duration-500 ${isLive ? 'bg-elvora-success' : 'bg-elvora-gradient'}`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {[
                      { label: 'Gesendet', value: c.liveProgress?.sent ?? c.sent, color: 'text-elvora-text' },
                      { label: 'Geöffnet', value: c.opened, color: 'text-elvora-success' },
                      { label: 'Geantwortet', value: c.replied, color: 'text-elvora-purple-light' },
                      { label: 'Fehlgeschlagen', value: c.liveProgress?.failed ?? c.failed, color: 'text-red-400' },
                      { label: 'Übersprungen', value: c.liveProgress?.skipped ?? c.skipped, color: 'text-elvora-text-dim' },
                      { label: 'Bounce', value: c.bounced, color: c.bounced > 0 ? 'text-elvora-warning' : 'text-elvora-text-dim' },
                    ].map((s, i) => (
                      <div key={i} className="bg-white/[0.03] rounded-lg px-3 py-2 text-center">
                        <div className={`text-lg font-semibold ${s.color}`}>{s.value}</div>
                        <div className="text-[9px] text-elvora-text-dim uppercase tracking-wider">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Live Activity */}
                  {c.liveProgress && c.liveProgress.results.length > 0 && (
                    <div className="mt-4 max-h-32 overflow-y-auto space-y-0.5 text-xs font-mono border-t border-white/5 pt-3">
                      {c.liveProgress.results.slice().reverse().map((r, i) => (
                        <div key={i} className={`px-2 py-0.5 rounded ${r.success ? 'text-elvora-success/80' : 'text-red-400/80'}`}>
                          {r.success ? '✓' : '✗'} #{r.leadId} → {r.recipient || 'keine Email'} {r.type ? `(${r.type})` : ''} {r.error ? `· ${r.error}` : ''}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ==================== NEW CAMPAIGN TAB ==================== */}
      {tab === 'new' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          <div className="space-y-5">
            {/* Campaign Name + Schedule */}
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-4">Kampagne konfigurieren</h2>
              <div className="mb-4">
                <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Kampagnenname</label>
                <input
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="z.B. Friseure Berlin Mai 2026"
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text focus:border-elvora-purple/40 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Versandplan</label>
                  <select
                    value={scheduleType}
                    onChange={e => setScheduleType(e.target.value as 'immediate' | 'business_hours')}
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text"
                  >
                    <option value="immediate">Sofort senden</option>
                    <option value="business_hours">Nur Geschäftszeiten (Mo-Fr 9-18h)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">
                    Geschwindigkeit: <span className="text-elvora-purple-light font-semibold">{mailsPerHour}/h</span>
                  </label>
                  <input
                    type="range" min="6" max="600" value={mailsPerHour}
                    onChange={e => setMailsPerHour(parseInt(e.target.value))}
                    className="w-full accent-elvora-purple mt-1"
                  />
                  <div className="flex justify-between text-[9px] text-elvora-text-dim mt-0.5">
                    <span>6/h</span><span>60/h</span><span>600/h</span>
                  </div>
                </div>
              </div>
            </div>

            {/* A/B Test */}
            <div className="card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-elvora-text">A/B Testing</h2>
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-elvora-text-dim">Aktivieren</span>
                  <div className={`relative w-9 h-5 rounded-full transition-colors ${abEnabled ? 'bg-elvora-purple' : 'bg-white/10'}`} onClick={() => setAbEnabled(!abEnabled)}>
                    <div className={`absolute w-4 h-4 rounded-full bg-white top-0.5 transition-transform ${abEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              </div>
              {abEnabled && (
                <div>
                  <p className="text-xs text-elvora-text-dim mb-3">Variante B wird an 50% der Leads gesendet. Die Standard-Betreffzeile ist Variante A.</p>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Betreffzeile Variante B</label>
                  <input
                    value={subjectVariantB}
                    onChange={e => setSubjectVariantB(e.target.value)}
                    placeholder="z.B. {firmenname}: Ihre Website verliert Kunden"
                    className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text focus:border-elvora-purple/40 focus:outline-none"
                  />
                  <p className="text-[10px] text-elvora-text-dim mt-1">Variablen: {'{firmenname}'} {'{score}'} {'{stadt}'} {'{ansprechpartner}'}</p>
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-4">Zielgruppe</h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Stadt</label>
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="z.B. Berlin" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text focus:border-elvora-purple/40 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Branche</label>
                  <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="z.B. Friseur" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text focus:border-elvora-purple/40 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Score min</label>
                  <input type="number" value={minScore} onChange={e => setMinScore(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="0" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Score max</label>
                  <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value === '' ? '' : parseInt(e.target.value))} placeholder="60" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-elvora-text-dim mb-1">Status</label>
                  <select value={contactStatus} onChange={e => setContactStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text">
                    <option value="">Alle</option>
                    <option value="not_contacted">Nicht kontaktiert</option>
                    <option value="email_sent">Bereits gesendet</option>
                    <option value="called">Angerufen</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2 pt-4">
                  <label className="flex items-center gap-2 text-xs text-elvora-text cursor-pointer">
                    <input type="checkbox" checked={onlyWithEmail} onChange={e => setOnlyWithEmail(e.target.checked)} className="accent-elvora-purple" />
                    Nur mit Email
                  </label>
                  <label className="flex items-center gap-2 text-xs text-elvora-text cursor-pointer">
                    <input type="checkbox" checked={preferEntscheider} onChange={e => setPreferEntscheider(e.target.checked)} className="accent-elvora-purple" />
                    Entscheider bevorzugen
                  </label>
                </div>
              </div>
            </div>

            {/* Results Summary + Start */}
            <div className="card rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-elvora-text">Zusammenfassung</h2>
                <button onClick={loadFilterCount} disabled={loading} className="text-xs text-elvora-purple-light hover:text-elvora-purple">
                  {loading ? 'Lade...' : 'Aktualisieren'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-elvora-text">{count ?? '–'}</div>
                  <div className="text-[9px] text-elvora-text-dim uppercase tracking-wider mt-0.5">Leads</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-elvora-text">
                    {estimateMinutes > 60 ? `${Math.round(estimateMinutes / 60)}h` : `${estimateMinutes}m`}
                  </div>
                  <div className="text-[9px] text-elvora-text-dim uppercase tracking-wider mt-0.5">Dauer</div>
                </div>
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-elvora-text">{mailsPerHour}</div>
                  <div className="text-[9px] text-elvora-text-dim uppercase tracking-wider mt-0.5">Mails/h</div>
                </div>
              </div>

              <button
                onClick={createCampaign}
                disabled={loading || !count || count === 0 || !campaignName.trim()}
                className="w-full px-4 py-3 rounded-lg bg-elvora-gradient text-white font-semibold text-sm shadow-elvora hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {!campaignName.trim() ? 'Kampagnenname eingeben' : !count ? 'Keine Leads' : `Kampagne erstellen (${count} Leads)`}
              </button>
              <p className="text-[10px] text-elvora-text-dim text-center mt-2">
                Kampagne wird als Entwurf erstellt. Du kannst sie vor dem Start nochmal prüfen.
              </p>
            </div>

            {/* Lead Preview List */}
            {sample.length > 0 && (
              <div className="card rounded-xl p-5">
                <h2 className="text-sm font-semibold text-elvora-text mb-3">
                  Lead-Vorschau <span className="text-elvora-text-dim font-normal">({sample.length} von {count ?? 0})</span>
                </h2>
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {sample.map(l => {
                    const emailToUse = preferEntscheider && l.entscheider_email ? l.entscheider_email : l.email || l.entscheider_email;
                    const isSelected = previewLead?.id === l.id;
                    return (
                      <button
                        key={l.id}
                        onClick={() => setPreviewLead(l)}
                        className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${isSelected ? 'bg-elvora-purple/15 border border-elvora-purple/30' : 'bg-white/[0.02] border border-transparent hover:bg-white/5'}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-elvora-text truncate">{l.name}</div>
                            <div className="text-[11px] text-elvora-text-dim truncate font-mono">{emailToUse || 'keine Email'}</div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.score < 30 ? 'bg-red-500/15 text-red-400' : l.score < 60 ? 'bg-orange-500/15 text-orange-400' : 'bg-green-500/15 text-green-400'}`}>
                              {l.score}
                            </span>
                            {l.entscheider_name && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-elvora-purple/15 text-elvora-purple-light" title={l.entscheider_name}>GF</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: Email Preview */}
          <div className="card rounded-xl p-5 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
            <h2 className="text-sm font-semibold text-elvora-text mb-3">Mail-Vorschau</h2>
            {!previewLead && <p className="text-sm text-elvora-text-dim">Wähle einen Lead aus der Liste</p>}
            {previewLoading && <div className="text-sm text-elvora-text-dim animate-pulse">Lade Vorschau...</div>}
            {preview && !previewLoading && (
              <>
                <div className="space-y-2 mb-4 text-xs">
                  <div className="flex gap-2"><span className="text-elvora-text-dim w-16 flex-shrink-0">An:</span><span className="text-elvora-text font-mono break-all">{preview.recipient}{preview.recipientType && <span className="ml-1 text-elvora-purple-light">({preview.recipientType})</span>}</span></div>
                  <div className="flex gap-2"><span className="text-elvora-text-dim w-16 flex-shrink-0">Von:</span><span className="text-elvora-text font-mono">{preview.fromName} &lt;{preview.fromEmail}&gt;</span></div>
                  <div className="flex gap-2"><span className="text-elvora-text-dim w-16 flex-shrink-0">Betreff:</span><span className="text-elvora-text">{preview.subject}</span></div>
                </div>
                <div className="border border-white/10 rounded-lg overflow-hidden bg-white">
                  <iframe srcDoc={preview.html} className="w-full h-[500px]" sandbox="" title="Email Preview" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ==================== ANALYTICS TAB ==================== */}
      {tab === 'analytics' && analytics && (
        <div className="space-y-5">
          {/* Send Volume Chart */}
          {analytics.dailySends.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-4">Versand-Volumen (30 Tage)</h2>
              <div className="flex items-end gap-1 h-32">
                {(() => {
                  const maxVal = Math.max(...analytics.dailySends.map(d => d.count), 1);
                  return analytics.dailySends.slice(-30).map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div
                        className="w-full bg-elvora-purple/40 rounded-t-sm hover:bg-elvora-purple/60 transition-colors min-h-[2px]"
                        style={{ height: `${Math.max(2, (d.count / maxVal) * 100)}%` }}
                      />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block px-2 py-1 rounded bg-elvora-bg-alt border border-white/10 text-[10px] text-elvora-text whitespace-nowrap z-10">
                        {d.day}: {d.count} Mails
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex justify-between mt-2 text-[9px] text-elvora-text-dim">
                <span>{analytics.dailySends[0]?.day}</span>
                <span>{analytics.dailySends[analytics.dailySends.length - 1]?.day}</span>
              </div>
            </div>
          )}

          {/* Conversion Funnel */}
          {analytics.contactStatusDist.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-4">Outreach-Funnel</h2>
              <div className="space-y-2">
                {(() => {
                  const order = ['email_sent', 'called', 'meeting', 'proposal', 'won'];
                  const labels: Record<string, string> = { email_sent: 'Kontaktiert', called: 'Angerufen', meeting: 'Meeting', proposal: 'Angebot', won: 'Gewonnen' };
                  const colors: Record<string, string> = { email_sent: 'bg-elvora-purple/50', called: 'bg-elvora-accent/50', meeting: 'bg-elvora-warning/50', proposal: 'bg-elvora-pink/50', won: 'bg-elvora-success/50' };
                  const map = new Map(analytics.contactStatusDist.map(d => [d.contact_status, d.count]));
                  const maxVal = Math.max(...order.map(k => map.get(k) || 0), 1);
                  return order.map(key => {
                    const val = map.get(key) || 0;
                    const pct = Math.max(5, (val / maxVal) * 100);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="w-24 text-right text-xs text-elvora-text-muted">{labels[key]}</div>
                        <div className="flex-1 h-7 bg-white/[0.03] rounded-md overflow-hidden">
                          <div className={`h-full ${colors[key]} rounded-md flex items-center px-3`} style={{ width: `${pct}%` }}>
                            <span className="text-xs font-semibold text-white">{val}</span>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}

          {/* Campaign Performance Table */}
          {analytics.recentCampaigns.length > 0 && (
            <div className="card rounded-xl p-5">
              <h2 className="text-sm font-semibold text-elvora-text mb-4">Kampagnen-Performance</h2>
              <div className="overflow-x-auto -mx-5 px-5">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3">Kampagne</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3">Leads</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3">Gesendet</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3">Öffnungsrate</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3">Antwortrate</th>
                      <th className="text-right text-[10px] text-elvora-text-dim uppercase tracking-wider pb-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {analytics.recentCampaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 text-sm text-elvora-text font-medium">{c.name}</td>
                        <td className="py-3 text-sm text-elvora-text-muted text-right">{c.lead_count}</td>
                        <td className="py-3 text-sm text-elvora-text text-right font-medium">{c.sent}</td>
                        <td className="py-3 text-sm text-right">
                          <span className={`${c.openRate > 30 ? 'text-elvora-success' : c.openRate > 15 ? 'text-elvora-warning' : 'text-red-400'} font-medium`}>
                            {c.openRate}%
                          </span>
                        </td>
                        <td className="py-3 text-sm text-right">
                          <span className={`${c.replyRate > 5 ? 'text-elvora-success' : c.replyRate > 2 ? 'text-elvora-warning' : 'text-elvora-text-dim'} font-medium`}>
                            {c.replyRate}%
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(c.status as string)}`}>
                            {statusLabel(c.status as string)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== BLACKLIST TAB ==================== */}
      {tab === 'blacklist' && (
        <div className="space-y-5">
          <div className="card rounded-xl p-5">
            <h2 className="text-sm font-semibold text-elvora-text mb-2">Email-Blacklist</h2>
            <p className="text-xs text-elvora-text-dim mb-4">
              Geblockte Emails werden automatisch übersprungen. Bounces und Abmeldungen werden hier gespeichert.
            </p>
            <div className="flex gap-2 mb-4">
              <input
                value={newBlacklistEmail}
                onChange={e => setNewBlacklistEmail(e.target.value)}
                placeholder="email@beispiel.de (mehrere mit Komma trennen)"
                className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-elvora-text focus:border-elvora-purple/40 focus:outline-none"
                onKeyDown={e => e.key === 'Enter' && addToBlacklist()}
              />
              <button
                onClick={addToBlacklist}
                disabled={!newBlacklistEmail.trim()}
                className="px-4 py-2 rounded-lg bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 disabled:opacity-40"
              >
                Blocken
              </button>
            </div>

            {blacklist.length === 0 ? (
              <div className="text-center py-8 text-elvora-text-dim text-sm">
                Keine blockierten Emails
              </div>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {blacklist.map(entry => (
                  <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/5 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm text-elvora-text font-mono truncate">{entry.email}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        entry.reason === 'bounce' ? 'bg-red-500/15 text-red-400' :
                        entry.reason === 'unsubscribe' ? 'bg-elvora-warning/15 text-elvora-warning' :
                        entry.reason === 'complaint' ? 'bg-red-500/15 text-red-400' :
                        'bg-white/10 text-elvora-text-dim'
                      }`}>
                        {entry.reason}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-elvora-text-dim">
                        {new Date(entry.created_at).toLocaleDateString('de-DE')}
                      </span>
                      <button
                        onClick={() => removeFromBlacklist(entry.id)}
                        className="w-6 h-6 rounded flex items-center justify-center text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
