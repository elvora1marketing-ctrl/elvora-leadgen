'use client';

import { useState, useRef, useEffect } from 'react';

interface Client {
  id: number;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  project_type: string | null;
  project_value: number | null;
  monthly_value: number;
  status: string;
  progress_phase: string;
  questionnaire_data: string | null;
  notes: string | null;
  created_at: string;
  dashboard_enabled?: number;
}

interface DashboardData {
  enabled: boolean;
  lead_value: number;
  summary: {
    total_leads: number;
    this_month: number;
    last_month: number;
    total_value: number;
    this_month_value: number;
    form_leads: number;
    chat_leads: number;
  };
  monthly: { month: string; form: number; chat: number; total: number; value: number }[];
  recent: { name: string; email: string; source: string; created_at: string }[];
}

interface Message {
  id: number;
  client_id: number;
  sender: string;
  content: string;
  created_at: string;
}

interface FileItem {
  id: number;
  client_id: number;
  filename: string;
  uploaded_by: string;
  created_at: string;
}

interface Props {
  client: Client;
  messages: Message[];
  files: FileItem[];
  agency: Record<string, string>;
  token: string;
}

const phases = [
  { key: 'kickoff', label: 'Kickoff', icon: '🚀' },
  { key: 'design', label: 'Design', icon: '🎨' },
  { key: 'development', label: 'Entwicklung', icon: '⚙️' },
  { key: 'review', label: 'Review', icon: '🔍' },
  { key: 'launch', label: 'Launch', icon: '🌐' },
  { key: 'done', label: 'Fertig', icon: '✅' },
];

export default function ClientPortalClient({ client, messages: initialMessages, files: initialFiles, agency, token }: Props) {
  const dashboardOn = !!client.dashboard_enabled;
  const [tab, setTab] = useState<'dashboard' | 'onboarding' | 'progress' | 'messages' | 'files'>(dashboardOn ? 'dashboard' : 'progress');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [messages, setMessages] = useState(initialMessages);
  const [files, setFiles] = useState(initialFiles);
  const [msgText, setMsgText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Questionnaire state
  const existingData = (() => { try { return JSON.parse(client.questionnaire_data || '{}'); } catch { return {}; } })();
  const [qColors, setQColors] = useState(existingData.colors || '');
  const [qStyle, setQStyle] = useState(existingData.style || '');
  const [qTarget, setQTarget] = useState(existingData.target_audience || '');
  const [qWishes, setQWishes] = useState(existingData.wishes || '');
  const [qAccess, setQAccess] = useState(existingData.access_info || '');
  const [qSaved, setQSaved] = useState(false);
  const [qSaving, setQSaving] = useState(false);

  const agencyName = agency.agency_name || 'Elvora';
  const currentPhaseIndex = phases.findIndex(p => p.key === client.progress_phase);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!dashboardOn) return;
    fetch(`/api/clients/${token}/dashboard`)
      .then(r => r.json())
      .then(d => { if (d && d.enabled) setDashboard(d); })
      .catch(() => { /* silent */ });
  }, [dashboardOn, token]);

  const fmtEur = (n: number) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
  const monthLabel = (key: string) => {
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('de-DE', { month: 'short' });
  };

  async function sendMessage() {
    if (!msgText.trim()) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/clients/${token}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msgText.trim(), sender: 'client' }),
      });
      if (res.ok) {
        setMessages([...messages, {
          id: Date.now(),
          client_id: client.id,
          sender: 'client',
          content: msgText.trim(),
          created_at: new Date().toISOString(),
        }]);
        setMsgText('');
      }
    } catch { /* silent */ }
    finally { setSendingMsg(false); }
  }

  async function saveQuestionnaire() {
    setQSaving(true);
    try {
      const res = await fetch(`/api/clients/${token}/questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colors: qColors,
          style: qStyle,
          target_audience: qTarget,
          wishes: qWishes,
          access_info: qAccess,
        }),
      });
      if (res.ok) {
        setQSaved(true);
        setTimeout(() => setQSaved(false), 3000);
      }
    } catch { /* silent */ }
    finally { setQSaving(false); }
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('uploaded_by', 'client');
      const res = await fetch(`/api/clients/${token}/files`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setFiles([{ id: data.file.id, client_id: client.id, filename: data.file.filename, uploaded_by: 'client', created_at: new Date().toISOString() }, ...files]);
      }
    } catch { /* silent */ }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  const tabs = [
    ...(dashboardOn ? [{ key: 'dashboard' as const, label: 'Übersicht' }] : []),
    { key: 'progress' as const, label: 'Fortschritt' },
    { key: 'onboarding' as const, label: 'Onboarding' },
    { key: 'messages' as const, label: `Nachrichten (${messages.length})` },
    { key: 'files' as const, label: `Dateien (${files.length})` },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <img src="/elvora-icon.svg" alt="" className="w-8 h-8" />
          <div>
            <div className="text-white font-semibold">{agencyName}</div>
            <div className="text-xs text-[#8a8f98]">Client Portal</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-white font-medium text-sm">{client.company_name}</div>
          {client.contact_name && <div className="text-xs text-[#8a8f98]">{client.contact_name}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? 'bg-[#7c5cfc]/15 text-[#7c5cfc]' : 'text-[#8a8f98] hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab — Live ROI */}
      {tab === 'dashboard' && (
        <div className="space-y-4">
          {!dashboard ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-10 text-center text-sm text-[#8a8f98]">
              Lädt Ihre Zahlen…
            </div>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="text-xs text-[#8a8f98]">Leads diesen Monat</div>
                  <div className="text-3xl font-bold text-white mt-1">{dashboard.summary.this_month}</div>
                  {dashboard.summary.last_month > 0 && (
                    <div className={`text-xs mt-1 ${dashboard.summary.this_month >= dashboard.summary.last_month ? 'text-emerald-400' : 'text-[#8a8f98]'}`}>
                      {dashboard.summary.this_month >= dashboard.summary.last_month ? '▲' : '▼'} {Math.abs(dashboard.summary.this_month - dashboard.summary.last_month)} ggü. Vormonat
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-[#7c5cfc]/30 bg-[#7c5cfc]/[0.08] p-4">
                  <div className="text-xs text-[#a99cf5]">Geschätzter Wert / Monat</div>
                  <div className="text-3xl font-bold text-white mt-1">{fmtEur(dashboard.summary.this_month_value)}</div>
                  <div className="text-xs text-[#8a8f98] mt-1">bei {fmtEur(dashboard.lead_value)} / Lead</div>
                </div>
              </div>

              {/* Monthly bar chart */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold mb-5">Leads pro Monat</h2>
                {(() => {
                  const max = Math.max(1, ...dashboard.monthly.map(m => m.total));
                  return (
                    <div className="flex items-end justify-between gap-2 h-40">
                      {dashboard.monthly.map((m) => (
                        <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full">
                          <div className="text-[11px] text-[#c8ccd4] mb-1 font-medium">{m.total > 0 ? m.total : ''}</div>
                          <div
                            className="w-full max-w-[40px] rounded-t-md bg-gradient-to-t from-[#7c5cfc] to-[#a99cf5] transition-all"
                            style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total > 0 ? '4px' : '0' }}
                          />
                          <div className="text-[10px] text-[#8a8f98] mt-2 capitalize">{monthLabel(m.month)}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Totals + sources */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="text-xs text-[#8a8f98]">Leads gesamt</div>
                  <div className="text-xl font-bold text-white mt-1">{dashboard.summary.total_leads}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="text-xs text-[#8a8f98]">über Formular</div>
                  <div className="text-xl font-bold text-white mt-1">{dashboard.summary.form_leads}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="text-xs text-[#8a8f98]">über Chat</div>
                  <div className="text-xl font-bold text-white mt-1">{dashboard.summary.chat_leads}</div>
                </div>
              </div>

              {/* Recent leads */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                <div className="p-4 border-b border-white/[0.06]">
                  <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold">Letzte Anfragen</h2>
                </div>
                {dashboard.recent.length === 0 ? (
                  <p className="text-xs text-[#555] text-center py-8">Noch keine Anfragen erfasst</p>
                ) : (
                  <div className="divide-y divide-white/[0.06]">
                    {dashboard.recent.map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-4 py-3">
                        <div className="min-w-0">
                          <div className="text-sm text-white truncate">{r.name || 'Anonym'}</div>
                          <div className="text-[11px] text-[#8a8f98] truncate">{r.email || '—'}</div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div className="text-[11px] text-[#a99cf5]">{r.source}</div>
                          <div className="text-[10px] text-[#555]">
                            {new Date(r.created_at + (r.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Progress Tab */}
      {tab === 'progress' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
            <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold mb-6">Projekt-Fortschritt</h2>
            <div className="relative">
              {/* Progress line */}
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-white/10" />
              <div className="absolute top-5 left-5 h-0.5 bg-[#7c5cfc] transition-all" style={{ width: `${Math.max(0, (currentPhaseIndex / (phases.length - 1)) * 100)}%`, maxWidth: 'calc(100% - 40px)' }} />

              <div className="relative flex justify-between">
                {phases.map((phase, i) => {
                  const isActive = i === currentPhaseIndex;
                  const isDone = i < currentPhaseIndex;
                  return (
                    <div key={phase.key} className="flex flex-col items-center" style={{ width: `${100 / phases.length}%` }}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                        isDone ? 'bg-[#7c5cfc] border-[#7c5cfc] text-white' :
                        isActive ? 'bg-[#7c5cfc]/20 border-[#7c5cfc] text-[#7c5cfc]' :
                        'bg-white/5 border-white/10 text-[#555]'
                      }`}>
                        {isDone ? '✓' : phase.icon}
                      </div>
                      <span className={`text-[10px] mt-2 text-center ${isActive ? 'text-white font-medium' : isDone ? 'text-[#8a8f98]' : 'text-[#555]'}`}>
                        {phase.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-xs text-[#8a8f98]">Status</div>
              <div className="text-white font-medium text-sm mt-1 capitalize">{client.status}</div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-xs text-[#8a8f98]">Phase</div>
              <div className="text-white font-medium text-sm mt-1">{phases[currentPhaseIndex]?.label || client.progress_phase}</div>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Tab */}
      {tab === 'onboarding' && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
          <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold mb-4">Onboarding-Fragebogen</h2>
          <p className="text-xs text-[#8a8f98] mb-5">Bitte füllen Sie die folgenden Felder aus, damit wir Ihr Projekt optimal vorbereiten können.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#8a8f98] mb-1.5">Farben & Branding</label>
              <textarea
                value={qColors}
                onChange={e => setQColors(e.target.value)}
                placeholder="Welche Farben hat Ihr Unternehmen? Haben Sie ein Logo / CI-Manual?"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#7c5cfc]/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8f98] mb-1.5">Gewünschter Stil</label>
              <textarea
                value={qStyle}
                onChange={e => setQStyle(e.target.value)}
                placeholder="Modern, minimalistisch, klassisch...? Beispiel-Websites, die Ihnen gefallen?"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#7c5cfc]/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8f98] mb-1.5">Zielgruppe</label>
              <textarea
                value={qTarget}
                onChange={e => setQTarget(e.target.value)}
                placeholder="Wer sind Ihre Kunden? Alter, Region, Branche?"
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#7c5cfc]/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8f98] mb-1.5">Wünsche & Anforderungen</label>
              <textarea
                value={qWishes}
                onChange={e => setQWishes(e.target.value)}
                placeholder="Welche Seiten brauchen Sie? Besondere Funktionen? Kontaktformular, Buchungssystem, etc.?"
                rows={3}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#7c5cfc]/50 resize-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8a8f98] mb-1.5">Zugangsdaten & Infos</label>
              <textarea
                value={qAccess}
                onChange={e => setQAccess(e.target.value)}
                placeholder="Domain-Provider, Hosting, Google-Konto, Social Media Zugänge etc."
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#7c5cfc]/50 resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveQuestionnaire}
                disabled={qSaving}
                className="px-5 py-2.5 rounded-lg bg-[#7c5cfc] hover:bg-[#7c5cfc]/80 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {qSaving ? 'Speichert...' : 'Fragebogen speichern'}
              </button>
              {qSaved && <span className="text-xs text-emerald-400">Gespeichert!</span>}
            </div>
          </div>
        </div>
      )}

      {/* Messages Tab */}
      {tab === 'messages' && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold">Nachrichten</h2>
          </div>
          <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-xs text-[#555] text-center py-8">Noch keine Nachrichten</p>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`flex ${m.sender === 'client' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    m.sender === 'client'
                      ? 'bg-[#7c5cfc]/15 text-[#c8ccd4]'
                      : 'bg-white/5 text-[#c8ccd4]'
                  }`}>
                    <div className="text-[10px] text-[#555] mb-0.5">{m.sender === 'client' ? 'Sie' : agencyName}</div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                    <div className="text-[10px] text-[#555] mt-1">
                      {new Date(m.created_at + (m.created_at.endsWith('Z') ? '' : 'Z')).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-4 border-t border-white/[0.06]">
            <div className="flex gap-2">
              <input
                type="text"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Nachricht schreiben..."
                className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-[#555] focus:outline-none focus:border-[#7c5cfc]/50"
              />
              <button
                onClick={sendMessage}
                disabled={sendingMsg || !msgText.trim()}
                className="px-4 py-2.5 rounded-lg bg-[#7c5cfc] hover:bg-[#7c5cfc]/80 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Senden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Files Tab */}
      {tab === 'files' && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-wider text-[#8a8f98] font-semibold">Dateien</h2>
            <label className={`px-4 py-2 rounded-lg bg-[#7c5cfc] hover:bg-[#7c5cfc]/80 text-white text-xs font-medium transition-colors cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? 'Hochladen...' : 'Datei hochladen'}
              <input ref={fileInputRef} type="file" onChange={uploadFile} className="hidden" accept=".pdf,.png,.jpg,.jpeg,.svg,.doc,.docx,.zip" />
            </label>
          </div>
          <p className="text-[10px] text-[#555] mb-4">Erlaubt: PDF, PNG, JPG, SVG, DOC, DOCX, ZIP (max. 10MB)</p>

          {files.length === 0 ? (
            <p className="text-xs text-[#555] text-center py-8">Noch keine Dateien hochgeladen</p>
          ) : (
            <div className="space-y-2">
              {files.map(f => (
                <div key={f.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-white truncate">{f.filename}</div>
                    <div className="text-[10px] text-[#555]">
                      {f.uploaded_by === 'client' ? 'Von Ihnen' : `Von ${agencyName}`} · {new Date(f.created_at + (f.created_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <a
                    href={`/api/clients/${token}/files/${f.id}`}
                    download
                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-[#8a8f98] hover:text-white transition-colors flex-shrink-0 ml-2"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-white/[0.06] pt-6 mt-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <img src="/elvora-icon.svg" alt="" className="w-4 h-4 opacity-50" />
          <span className="text-[11px] text-[#555]">{agencyName}</span>
        </div>
        {agency.agency_email && <p className="text-[10px] text-[#555]">{agency.agency_email}</p>}
      </div>
    </div>
  );
}
