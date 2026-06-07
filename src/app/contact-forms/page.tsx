'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea';
  required: boolean;
  placeholder: string;
  options?: string[];
}

interface ContactForm {
  id: number;
  name: string;
  slug: string;
  fields: FormField[];
  submit_label: string;
  success_message: string;
  color: string;
  created_at: string;
  submission_count?: number;
  unread_count?: number;
}

interface Submission {
  id: number;
  form_id: number;
  data: Record<string, string>;
  is_read: number;
  created_at: string;
}

type Tab = 'forms' | 'submissions' | 'embed';

const fieldTypeLabels: Record<string, string> = {
  text: 'Text',
  email: 'E-Mail',
  tel: 'Telefon',
  select: 'Auswahl',
  textarea: 'Textbereich',
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

// ---------------------------------------------------------------------------
// Default field for new forms
// ---------------------------------------------------------------------------
function defaultField(): FormField {
  return { name: '', label: '', type: 'text', required: false, placeholder: '', options: [] };
}

function defaultFormData(): {
  name: string;
  slug: string;
  fields: FormField[];
  submit_label: string;
  success_message: string;
  color: string;
} {
  return {
    name: '',
    slug: '',
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Ihr Name' },
      { name: 'email', label: 'E-Mail', type: 'email', required: true, placeholder: 'Ihre E-Mail-Adresse' },
      { name: 'message', label: 'Nachricht', type: 'textarea', required: false, placeholder: 'Ihre Nachricht...' },
    ],
    submit_label: 'Absenden',
    success_message: 'Vielen Dank! Ihre Nachricht wurde gesendet.',
    color: '#8B5CF6',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ContactFormsPage() {
  const [tab, setTab] = useState<Tab>('forms');
  const [forms, setForms] = useState<ContactForm[]>([]);
  const [loading, setLoading] = useState(true);

  // Form editing
  const [editForm, setEditForm] = useState<ContactForm | null>(null);
  const [formData, setFormData] = useState(defaultFormData());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Submissions
  const [selectedFormId, setSelectedFormId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<number | null>(null);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Embed
  const [embedFormId, setEmbedFormId] = useState<number | null>(null);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const loadForms = useCallback(async () => {
    try {
      const res = await fetch('/api/contact-form?action=forms');
      const data = await res.json();
      const list: ContactForm[] = (data.forms || []).map((f: Record<string, unknown>) => ({
        ...f,
        fields: typeof f.fields === 'string' ? JSON.parse(f.fields as string) : f.fields || [],
      }));
      setForms(list);
      if (!embedFormId && list.length) setEmbedFormId(list[0].id);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [embedFormId]);

  const loadSubmissions = useCallback(async (formId: number) => {
    setLoadingSubs(true);
    try {
      const res = await fetch(`/api/contact-form?action=submissions&form_id=${formId}`);
      const data = await res.json();
      const subs: Submission[] = (data.submissions || []).map((s: Record<string, unknown>) => ({
        ...s,
        data: typeof s.data === 'string' ? JSON.parse(s.data as string) : s.data || {},
      }));
      setSubmissions(subs);
    } catch { /* ignore */ } finally { setLoadingSubs(false); }
  }, []);

  useEffect(() => { loadForms(); }, [loadForms]);

  useEffect(() => {
    if (selectedFormId) loadSubmissions(selectedFormId);
  }, [selectedFormId, loadSubmissions]);

  // Auto-select first form for submissions tab when switching
  useEffect(() => {
    if (tab === 'submissions' && !selectedFormId && forms.length) {
      setSelectedFormId(forms[0].id);
    }
  }, [tab, selectedFormId, forms]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function createForm() {
    if (!formData.name || !formData.slug) return;
    setSaving(true);
    try {
      await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create_form', ...formData, fields: JSON.stringify(formData.fields) }),
      });
      setShowCreateModal(false);
      setFormData(defaultFormData());
      loadForms();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function updateForm() {
    if (!editForm) return;
    setSaving(true);
    try {
      await fetch('/api/contact-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_form',
          id: editForm.id,
          ...formData,
          fields: JSON.stringify(formData.fields),
        }),
      });
      setEditForm(null);
      loadForms();
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function deleteForm(id: number) {
    if (!confirm('Formular wirklich loeschen? Alle zugehoerigen Einsendungen werden ebenfalls geloescht.')) return;
    await fetch('/api/contact-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_form', id }),
    });
    setEditForm(null);
    loadForms();
  }

  async function markRead(submissionId: number) {
    await fetch('/api/contact-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', id: submissionId }),
    });
    if (selectedFormId) loadSubmissions(selectedFormId);
    loadForms();
  }

  // ---------------------------------------------------------------------------
  // Field builder helpers
  // ---------------------------------------------------------------------------
  function updateField(index: number, partial: Partial<FormField>) {
    const updated = [...formData.fields];
    updated[index] = { ...updated[index], ...partial };
    setFormData({ ...formData, fields: updated });
  }

  function removeField(index: number) {
    setFormData({ ...formData, fields: formData.fields.filter((_, i) => i !== index) });
  }

  function addField() {
    setFormData({ ...formData, fields: [...formData.fields, defaultField()] });
  }

  function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= formData.fields.length) return;
    const updated = [...formData.fields];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setFormData({ ...formData, fields: updated });
  }

  // ---------------------------------------------------------------------------
  // Embed
  // ---------------------------------------------------------------------------
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const selectedEmbedForm = forms.find(f => f.id === embedFormId);

  function getEmbedCode() {
    const slug = selectedEmbedForm?.slug || 'default';
    return `<div id="elvora-form"></div>\n<script src="${baseUrl}/elvora-form.js" data-url="${baseUrl}" data-slug="${slug}"></script>`;
  }

  function copyEmbed() {
    navigator.clipboard.writeText(getEmbedCode());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  }

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------
  const totalSubmissions = forms.reduce((sum, f) => sum + (f.submission_count || 0), 0);
  const totalUnread = forms.reduce((sum, f) => sum + (f.unread_count || 0), 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
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
          <h1 className="text-xl font-bold text-white">Kontaktformulare</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Formulare erstellen und Einsendungen verwalten</p>
        </div>
        <div className="flex items-center gap-2">
          {([
            { key: 'forms' as Tab, label: 'Formulare' },
            { key: 'submissions' as Tab, label: 'Einsendungen', count: totalUnread },
            { key: 'embed' as Tab, label: 'Einbetten' },
          ]).map(t => (
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
          <div className="text-xs text-elvora-text-dim">Formulare</div>
          <div className="text-2xl font-bold text-elvora-purple-light mt-1">{forms.length}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Einsendungen</div>
          <div className="text-2xl font-bold text-elvora-success mt-1">{totalSubmissions}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Ungelesen</div>
          <div className="text-2xl font-bold text-elvora-accent mt-1">{totalUnread}</div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* FORMULARE TAB                                                      */}
      {/* ================================================================== */}
      {tab === 'forms' && (
        <div className="space-y-3">
          {/* Create button */}
          <div className="flex justify-end">
            <button
              onClick={() => { setFormData(defaultFormData()); setShowCreateModal(true); }}
              className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple/80 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neues Formular
            </button>
          </div>

          {/* Form list */}
          {forms.map(f => (
            <button
              key={f.id}
              onClick={() => {
                setEditForm(f);
                setFormData({
                  name: f.name,
                  slug: f.slug,
                  fields: f.fields || [],
                  submit_label: f.submit_label || 'Absenden',
                  success_message: f.success_message || '',
                  color: f.color || '#8B5CF6',
                });
              }}
              className="card rounded-xl p-5 w-full text-left hover:border-elvora-border-light transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (f.color || '#8B5CF6') + '20' }}>
                    <svg className="w-5 h-5" style={{ color: f.color || '#8B5CF6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{f.name}</span>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color || '#8B5CF6' }} />
                    </div>
                    <p className="text-xs text-elvora-text-dim mt-0.5 font-mono">/{f.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-elvora-text-dim">
                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h7" />
                      </svg>
                      <span>{(f.fields || []).length} Felder</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span>{f.submission_count || 0} Einsendungen</span>
                      {(f.unread_count || 0) > 0 && (
                        <span className="w-5 h-5 rounded-full bg-elvora-purple text-white text-[10px] flex items-center justify-center">{f.unread_count}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}

          {forms.length === 0 && (
            <div className="card rounded-xl p-12 text-center">
              <svg className="w-12 h-12 text-elvora-text-dim/20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-elvora-text-dim">Noch keine Formulare angelegt</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* EINSENDUNGEN TAB                                                   */}
      {/* ================================================================== */}
      {tab === 'submissions' && (
        <div className="space-y-4">
          {/* Form selector */}
          <div className="card rounded-xl p-4">
            <label className="block text-xs text-elvora-text-dim mb-1.5">Formular auswaehlen</label>
            <select
              value={selectedFormId || ''}
              onChange={e => { setSelectedFormId(parseInt(e.target.value)); setExpandedSubmissionId(null); }}
              className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
            >
              {forms.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.submission_count || 0} Einsendungen{(f.unread_count || 0) > 0 ? `, ${f.unread_count} ungelesen` : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Submissions list */}
          <div className="card rounded-xl overflow-hidden">
            {loadingSubs ? (
              <div className="p-12 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
              </div>
            ) : submissions.length === 0 ? (
              <div className="p-12 text-center">
                <svg className="w-10 h-10 text-elvora-text-dim/20 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <p className="text-sm text-elvora-text-dim">Keine Einsendungen vorhanden</p>
              </div>
            ) : (
              <div>
                {/* Table header */}
                <div className="grid grid-cols-[auto_1fr_1fr_140px_80px] gap-4 px-5 py-3 border-b border-elvora-border text-[11px] text-elvora-text-dim font-medium uppercase tracking-wide">
                  <div className="w-3" />
                  <div>Name</div>
                  <div>E-Mail</div>
                  <div>Datum</div>
                  <div className="text-right">Status</div>
                </div>

                {/* Rows */}
                {submissions.map(sub => {
                  const isExpanded = expandedSubmissionId === sub.id;
                  const subName = sub.data.name || sub.data.Name || sub.data.vorname || '–';
                  const subEmail = sub.data.email || sub.data.Email || sub.data['e-mail'] || '–';

                  return (
                    <div key={sub.id} className={`border-b border-elvora-border/50 transition-colors ${!sub.is_read ? 'bg-elvora-purple/5' : ''}`}>
                      <button
                        onClick={() => setExpandedSubmissionId(isExpanded ? null : sub.id)}
                        className="w-full grid grid-cols-[auto_1fr_1fr_140px_80px] gap-4 px-5 py-3.5 text-left hover:bg-white/3 transition-colors items-center"
                      >
                        <div className="w-3 flex items-center justify-center">
                          {!sub.is_read && (
                            <div className="w-2.5 h-2.5 rounded-full bg-elvora-purple" />
                          )}
                        </div>
                        <div className="text-sm text-white truncate font-medium">{subName}</div>
                        <div className="text-sm text-elvora-text-muted truncate">{subEmail}</div>
                        <div className="text-xs text-elvora-text-dim">{timeAgo(sub.created_at)}</div>
                        <div className="text-right">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                            sub.is_read
                              ? 'bg-elvora-border text-elvora-text-dim'
                              : 'bg-elvora-purple/15 text-elvora-purple-light'
                          }`}>
                            {sub.is_read ? 'Gelesen' : 'Neu'}
                          </span>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-5 pb-4">
                          <div className="bg-elvora-bg rounded-xl p-4 space-y-3">
                            {/* Key-value pairs */}
                            <div className="space-y-2">
                              {Object.entries(sub.data).map(([key, value]) => (
                                <div key={key} className="flex items-start gap-3">
                                  <span className="text-xs text-elvora-text-dim font-medium min-w-[100px] pt-0.5">{key}</span>
                                  <span className="text-sm text-white flex-1 break-words">{value}</span>
                                </div>
                              ))}
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-elvora-border">
                              <span className="text-[11px] text-elvora-text-dim">
                                Eingegangen: {new Date(sub.created_at).toLocaleString('de-DE')}
                              </span>
                              {!sub.is_read && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); markRead(sub.id); }}
                                  className="px-3 py-1.5 rounded-lg bg-elvora-success/10 text-elvora-success text-xs font-medium hover:bg-elvora-success/20 transition-colors flex items-center gap-1.5"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Als gelesen markieren
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* EINBETTEN TAB                                                      */}
      {/* ================================================================== */}
      {tab === 'embed' && (
        <div className="card rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Kontaktformular einbetten</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Formular</label>
              <select
                value={embedFormId || ''}
                onChange={e => setEmbedFormId(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
              >
                {forms.map(f => (
                  <option key={f.id} value={f.id}>{f.name} ({f.slug})</option>
                ))}
              </select>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Vorschau</label>
              <div className="rounded-xl bg-white/5 border border-elvora-border p-6 min-h-[200px]">
                {selectedEmbedForm && (
                  <div className="max-w-md mx-auto space-y-3">
                    {selectedEmbedForm.fields.map((field, i) => (
                      <div key={i}>
                        <label className="block text-xs text-elvora-text-dim mb-1">
                          {field.label}
                          {field.required && <span className="text-red-400 ml-0.5">*</span>}
                        </label>
                        {field.type === 'textarea' ? (
                          <div className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-elvora-text-dim text-sm h-20 flex items-start">
                            {field.placeholder}
                          </div>
                        ) : field.type === 'select' ? (
                          <div className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-elvora-text-dim text-sm">
                            {field.placeholder || 'Bitte waehlen...'}
                          </div>
                        ) : (
                          <div className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-elvora-text-dim text-sm">
                            {field.placeholder}
                          </div>
                        )}
                      </div>
                    ))}
                    <button
                      className="w-full py-2.5 rounded-lg text-white text-sm font-medium transition-colors"
                      style={{ backgroundColor: selectedEmbedForm.color || '#8B5CF6' }}
                    >
                      {selectedEmbedForm.submit_label || 'Absenden'}
                    </button>
                  </div>
                )}
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
              Fuegen Sie diesen Code an der gewuenschten Stelle Ihrer Website ein. Das Kontaktformular wird automatisch geladen.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* CREATE FORM MODAL                                                  */}
      {/* ================================================================== */}
      {showCreateModal && (
        <FormEditModal
          title="Neues Formular"
          formData={formData}
          setFormData={setFormData}
          onSave={createForm}
          onClose={() => setShowCreateModal(false)}
          onDelete={null}
          saving={saving}
          updateField={updateField}
          removeField={removeField}
          addField={addField}
          moveField={moveField}
        />
      )}

      {/* ================================================================== */}
      {/* EDIT FORM MODAL                                                    */}
      {/* ================================================================== */}
      {editForm && (
        <FormEditModal
          title="Formular bearbeiten"
          formData={formData}
          setFormData={setFormData}
          onSave={updateForm}
          onClose={() => setEditForm(null)}
          onDelete={() => deleteForm(editForm.id)}
          saving={saving}
          updateField={updateField}
          removeField={removeField}
          addField={addField}
          moveField={moveField}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form Edit Modal (shared between create & edit)
// ---------------------------------------------------------------------------
function FormEditModal({
  title,
  formData,
  setFormData,
  onSave,
  onClose,
  onDelete,
  saving,
  updateField,
  removeField,
  addField,
  moveField,
}: {
  title: string;
  formData: {
    name: string;
    slug: string;
    fields: FormField[];
    submit_label: string;
    success_message: string;
    color: string;
  };
  setFormData: (data: typeof formData) => void;
  onSave: () => void;
  onClose: () => void;
  onDelete: (() => void) | null;
  saving: boolean;
  updateField: (index: number, partial: Partial<FormField>) => void;
  removeField: (index: number) => void;
  addField: () => void;
  moveField: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold text-white">{title}</h2>
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={onDelete}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                >
                  Loeschen
                </button>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-elvora-text-dim hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Basic settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="z.B. Kontaktformular"
                  className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
                />
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Slug</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                  placeholder="z.B. kontakt"
                  className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm font-mono focus:outline-none focus:border-elvora-purple/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Button-Text</label>
                <input
                  type="text"
                  value={formData.submit_label}
                  onChange={e => setFormData({ ...formData, submit_label: e.target.value })}
                  placeholder="Absenden"
                  className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
                />
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Farbe</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="w-9 h-9 rounded-lg border border-elvora-border cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={formData.color}
                    onChange={e => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm font-mono focus:outline-none focus:border-elvora-purple/50"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Erfolgsmeldung</label>
              <textarea
                value={formData.success_message}
                onChange={e => setFormData({ ...formData, success_message: e.target.value })}
                rows={2}
                placeholder="Vielen Dank! Ihre Nachricht wurde gesendet."
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50 resize-none"
              />
            </div>

            {/* Felder (Field builder) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-elvora-text-dim font-medium">Formular-Felder</label>
                <button
                  onClick={addField}
                  className="text-xs text-elvora-purple-light hover:text-white transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Feld hinzufuegen
                </button>
              </div>

              <div className="space-y-2">
                {formData.fields.map((field, i) => (
                  <div key={i} className="bg-elvora-bg rounded-xl p-4 space-y-3 border border-elvora-border/50">
                    {/* Row 1: name, label, type */}
                    <div className="grid grid-cols-[1fr_1fr_120px_auto] gap-2 items-end">
                      <div>
                        <label className="block text-[10px] text-elvora-text-dim mb-0.5">Feldname</label>
                        <input
                          type="text"
                          value={field.name}
                          onChange={e => updateField(i, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_') })}
                          placeholder="z.B. email"
                          className="w-full px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs font-mono focus:outline-none focus:border-elvora-purple/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-elvora-text-dim mb-0.5">Label</label>
                        <input
                          type="text"
                          value={field.label}
                          onChange={e => updateField(i, { label: e.target.value })}
                          placeholder="z.B. E-Mail-Adresse"
                          className="w-full px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-elvora-text-dim mb-0.5">Typ</label>
                        <select
                          value={field.type}
                          onChange={e => updateField(i, { type: e.target.value as FormField['type'] })}
                          className="w-full px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50"
                        >
                          {Object.entries(fieldTypeLabels).map(([val, lbl]) => (
                            <option key={val} value={val}>{lbl}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveField(i, -1)}
                          disabled={i === 0}
                          className="p-1 rounded text-elvora-text-dim hover:text-white disabled:opacity-20 transition-colors"
                          title="Nach oben"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => moveField(i, 1)}
                          disabled={i === formData.fields.length - 1}
                          className="p-1 rounded text-elvora-text-dim hover:text-white disabled:opacity-20 transition-colors"
                          title="Nach unten"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeField(i)}
                          className="p-1 rounded text-red-400/60 hover:text-red-400 transition-colors"
                          title="Feld entfernen"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Row 2: placeholder, required toggle */}
                    <div className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-[10px] text-elvora-text-dim mb-0.5">Platzhalter</label>
                        <input
                          type="text"
                          value={field.placeholder}
                          onChange={e => updateField(i, { placeholder: e.target.value })}
                          placeholder="Platzhalter-Text..."
                          className="w-full px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer pb-0.5">
                        <button
                          type="button"
                          onClick={() => updateField(i, { required: !field.required })}
                          className={`w-8 h-4 rounded-full transition-colors relative ${field.required ? 'bg-elvora-success' : 'bg-elvora-border'}`}
                        >
                          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${field.required ? 'left-4' : 'left-0.5'}`} />
                        </button>
                        <span className="text-[10px] text-elvora-text-dim whitespace-nowrap">Pflichtfeld</span>
                      </label>
                    </div>

                    {/* Row 3: options (only for select type) */}
                    {field.type === 'select' && (
                      <div>
                        <label className="block text-[10px] text-elvora-text-dim mb-0.5">Optionen (eine pro Zeile)</label>
                        <textarea
                          value={(field.options || []).join('\n')}
                          onChange={e => updateField(i, { options: e.target.value.split('\n') })}
                          rows={3}
                          placeholder={"Option 1\nOption 2\nOption 3"}
                          className="w-full px-2.5 py-1.5 rounded-md bg-elvora-surface border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50 resize-none font-mono"
                        />
                      </div>
                    )}
                  </div>
                ))}

                {formData.fields.length === 0 && (
                  <div className="text-center py-6 text-xs text-elvora-text-dim">
                    Keine Felder vorhanden. Klicken Sie auf &quot;Feld hinzufuegen&quot;.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors">
              Abbrechen
            </button>
            <button
              onClick={onSave}
              disabled={saving || !formData.name || !formData.slug}
              className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Speichern...
                </div>
              ) : (
                'Speichern'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
