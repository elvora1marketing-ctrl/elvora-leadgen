'use client';

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ReviewWidget {
  id: number;
  name: string;
  slug: string;
  business_name: string;
  google_place_id: string | null;
  display_mode: 'carousel' | 'grid' | 'badge' | 'wall';
  theme: 'light' | 'dark';
  color: string;
  max_display: number;
  min_rating: number;
  show_rating_summary: number;
  is_active: number;
  created_at: string;
  review_count?: number;
  avg_rating?: number;
}

interface ReviewEntry {
  id: number;
  widget_id: number;
  author_name: string;
  author_avatar: string | null;
  rating: number;
  text: string | null;
  source: 'manual' | 'google';
  review_date: string | null;
  is_visible: number;
  created_at: string;
}

type Tab = 'widgets' | 'embed';

const displayModeLabels: Record<string, string> = {
  carousel: 'Karussell',
  grid: 'Raster',
  badge: 'Badge',
  wall: 'Wand',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function ReviewsPage() {
  const [tab, setTab] = useState<Tab>('widgets');
  const [widgets, setWidgets] = useState<ReviewWidget[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWidget, setSelectedWidget] = useState<ReviewWidget | null>(null);
  const [reviews, setReviews] = useState<ReviewEntry[]>([]);
  const [editingWidget, setEditingWidget] = useState(false);
  const [widgetForm, setWidgetForm] = useState<Partial<ReviewWidget>>({});
  const [showAddReview, setShowAddReview] = useState(false);
  const [reviewForm, setReviewForm] = useState({ author_name: '', rating: 5, text: '', review_date: '' });
  const [showCreateWidget, setShowCreateWidget] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', business_name: '' });

  // Embed tab state
  const [embedWidgetId, setEmbedWidgetId] = useState<number | null>(null);
  const [embedModeOverride, setEmbedModeOverride] = useState('');
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const loadWidgets = useCallback(async () => {
    try {
      const res = await fetch('/api/reviews?action=widgets');
      const data = await res.json();
      setWidgets(data.widgets || []);
      if (!embedWidgetId && data.widgets?.length) {
        setEmbedWidgetId(data.widgets[0].id);
      }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [embedWidgetId]);

  const loadReviews = useCallback(async (widgetId: number) => {
    try {
      const res = await fetch(`/api/reviews?action=reviews&widget_id=${widgetId}`);
      const data = await res.json();
      setReviews(data.reviews || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadWidgets(); }, [loadWidgets]);

  useEffect(() => {
    if (selectedWidget) loadReviews(selectedWidget.id);
  }, [selectedWidget, loadReviews]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  async function createWidget() {
    if (!createForm.name || !createForm.slug) return;
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create_widget', ...createForm }),
    });
    setShowCreateWidget(false);
    setCreateForm({ name: '', slug: '', business_name: '' });
    loadWidgets();
  }

  async function saveWidget() {
    if (!selectedWidget) return;
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_widget', id: selectedWidget.id, ...widgetForm }),
    });
    setEditingWidget(false);
    loadWidgets();
    // Refresh selected widget
    const res = await fetch('/api/reviews?action=widgets');
    const data = await res.json();
    const updated = (data.widgets || []).find((w: ReviewWidget) => w.id === selectedWidget.id);
    if (updated) setSelectedWidget(updated);
  }

  async function deleteWidget(id: number) {
    if (!confirm('Widget wirklich loeschen? Alle zugehoerigen Bewertungen werden ebenfalls geloescht.')) return;
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_widget', id }),
    });
    setSelectedWidget(null);
    loadWidgets();
  }

  async function addReview() {
    if (!selectedWidget || !reviewForm.author_name) return;
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_review', widget_id: selectedWidget.id, ...reviewForm }),
    });
    setShowAddReview(false);
    setReviewForm({ author_name: '', rating: 5, text: '', review_date: '' });
    loadReviews(selectedWidget.id);
    loadWidgets();
  }

  async function toggleVisibility(review: ReviewEntry) {
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_review', id: review.id, is_visible: review.is_visible ? 0 : 1 }),
    });
    loadReviews(selectedWidget!.id);
  }

  async function deleteReview(id: number) {
    if (!confirm('Bewertung wirklich loeschen?')) return;
    await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_review', id }),
    });
    loadReviews(selectedWidget!.id);
    loadWidgets();
  }

  // ---------------------------------------------------------------------------
  // Embed helpers
  // ---------------------------------------------------------------------------
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const selectedEmbedWidget = widgets.find(w => w.id === embedWidgetId);

  function getEmbedCode() {
    const slug = selectedEmbedWidget?.slug || 'default';
    const modeAttr = embedModeOverride ? ` data-mode="${embedModeOverride}"` : '';
    return `<div id="elvora-reviews"></div>\n<script src="${baseUrl}/elvora-reviews.js" data-url="${baseUrl}" data-slug="${slug}"${modeAttr}></script>`;
  }

  function copyEmbed() {
    navigator.clipboard.writeText(getEmbedCode());
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  }

  // ---------------------------------------------------------------------------
  // Star selector component
  // ---------------------------------------------------------------------------
  function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} type="button" onClick={() => onChange(s)} className="p-0.5 transition-transform hover:scale-110">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill={s <= value ? '#FBBF24' : '#4B5563'}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        ))}
      </div>
    );
  }

  function StarsDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill={s <= rating ? '#FBBF24' : '#4B5563'}>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    );
  }

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
          <h1 className="text-xl font-bold text-white">Bewertungen</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Bewertungs-Widgets verwalten und auf Websites einbetten</p>
        </div>
        <div className="flex items-center gap-2">
          {([
            { key: 'widgets' as Tab, label: 'Widgets' },
            { key: 'embed' as Tab, label: 'Einbetten' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSelectedWidget(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.key
                  ? 'bg-elvora-primary/20 text-elvora-primary-light border border-elvora-primary/30'
                  : 'bg-elvora-bg-alt text-elvora-text-dim border border-elvora-border hover:border-elvora-border-light'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Widgets</div>
          <div className="text-2xl font-bold text-elvora-purple-light mt-1">{widgets.length}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Bewertungen gesamt</div>
          <div className="text-2xl font-bold text-elvora-success mt-1">
            {widgets.reduce((sum, w) => sum + (w.review_count || 0), 0)}
          </div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Durchschnitt</div>
          <div className="text-2xl font-bold text-yellow-400 mt-1 flex items-center gap-2">
            {(() => {
              const total = widgets.reduce((s, w) => s + (w.avg_rating || 0) * (w.review_count || 0), 0);
              const count = widgets.reduce((s, w) => s + (w.review_count || 0), 0);
              return count > 0 ? (total / count).toFixed(1) : '–';
            })()}
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#FBBF24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* WIDGETS TAB                                                        */}
      {/* ================================================================== */}
      {tab === 'widgets' && !selectedWidget && (
        <div className="space-y-3">
          {/* Create button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateWidget(true)}
              className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple/80 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Neues Widget
            </button>
          </div>

          {/* Widget list */}
          {widgets.map(w => (
            <button
              key={w.id}
              onClick={() => setSelectedWidget(w)}
              className="card rounded-xl p-5 w-full text-left hover:border-elvora-border-light transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: w.color + '20' }}>
                    <svg className="w-5 h-5" style={{ color: w.color }} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{w.name}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${w.is_active ? 'bg-elvora-success/15 text-elvora-success' : 'bg-red-500/15 text-red-400'}`}>
                        {w.is_active ? 'Aktiv' : 'Inaktiv'}
                      </span>
                    </div>
                    <p className="text-xs text-elvora-text-dim mt-0.5">{w.business_name || w.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-elvora-text-dim">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <StarsDisplay rating={Math.round(w.avg_rating || 0)} size={12} />
                      <span className="text-white font-medium">{w.avg_rating || '–'}</span>
                    </div>
                    <div className="mt-0.5">{w.review_count || 0} Bewertungen</div>
                  </div>
                  <span className="px-2 py-1 rounded-md bg-elvora-bg text-elvora-text-dim">
                    {displayModeLabels[w.display_mode] || w.display_mode}
                  </span>
                </div>
              </div>
            </button>
          ))}

          {widgets.length === 0 && (
            <div className="card rounded-xl p-12 text-center">
              <svg className="w-12 h-12 text-elvora-text-dim/20 mx-auto mb-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              <p className="text-sm text-elvora-text-dim">Noch keine Bewertungs-Widgets angelegt</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================== */}
      {/* WIDGET DETAIL VIEW                                                 */}
      {/* ================================================================== */}
      {tab === 'widgets' && selectedWidget && (
        <div className="space-y-4">
          {/* Back button */}
          <button
            onClick={() => { setSelectedWidget(null); setEditingWidget(false); }}
            className="flex items-center gap-1.5 text-xs text-elvora-text-dim hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurueck zur Liste
          </button>

          {/* Widget info card */}
          <div className="card rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: selectedWidget.color + '20' }}>
                  <svg className="w-6 h-6" style={{ color: selectedWidget.color }} viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{selectedWidget.name}</h2>
                  <p className="text-xs text-elvora-text-dim">{selectedWidget.business_name} &middot; /{selectedWidget.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditingWidget(!editingWidget); setWidgetForm({ ...selectedWidget }); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-elvora-text-dim hover:text-white hover:bg-white/5 border border-elvora-border transition-colors"
                >
                  {editingWidget ? 'Abbrechen' : 'Bearbeiten'}
                </button>
                <button
                  onClick={() => deleteWidget(selectedWidget.id)}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors"
                >
                  Loeschen
                </button>
              </div>
            </div>

            {/* Edit form */}
            {editingWidget && (
              <div className="bg-elvora-bg rounded-xl p-5 space-y-3 mb-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Name</label>
                    <input type="text" value={widgetForm.name || ''} onChange={e => setWidgetForm({ ...widgetForm, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
                  </div>
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Firmenname</label>
                    <input type="text" value={widgetForm.business_name || ''} onChange={e => setWidgetForm({ ...widgetForm, business_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Anzeige-Modus</label>
                    <select value={widgetForm.display_mode || 'carousel'} onChange={e => setWidgetForm({ ...widgetForm, display_mode: e.target.value as ReviewWidget['display_mode'] })}
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50">
                      <option value="carousel">Karussell</option>
                      <option value="grid">Raster</option>
                      <option value="badge">Badge</option>
                      <option value="wall">Wand</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Theme</label>
                    <select value={widgetForm.theme || 'light'} onChange={e => setWidgetForm({ ...widgetForm, theme: e.target.value as 'light' | 'dark' })}
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50">
                      <option value="light">Hell</option>
                      <option value="dark">Dunkel</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Farbe</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={widgetForm.color || '#8B5CF6'} onChange={e => setWidgetForm({ ...widgetForm, color: e.target.value })}
                        className="w-9 h-9 rounded-lg border border-elvora-border cursor-pointer bg-transparent" />
                      <input type="text" value={widgetForm.color || ''} onChange={e => setWidgetForm({ ...widgetForm, color: e.target.value })}
                        className="flex-1 px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm font-mono focus:outline-none focus:border-elvora-purple/50" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Max. Anzeige</label>
                    <input type="number" value={widgetForm.max_display ?? 6} onChange={e => setWidgetForm({ ...widgetForm, max_display: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" min={1} max={50} />
                  </div>
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Min. Bewertung</label>
                    <select value={widgetForm.min_rating ?? 4} onChange={e => setWidgetForm({ ...widgetForm, min_rating: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50">
                      <option value={1}>1 Stern+</option>
                      <option value={2}>2 Sterne+</option>
                      <option value={3}>3 Sterne+</option>
                      <option value={4}>4 Sterne+</option>
                      <option value={5}>5 Sterne</option>
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => setWidgetForm({ ...widgetForm, show_rating_summary: widgetForm.show_rating_summary ? 0 : 1 })}
                        className={`w-10 h-5 rounded-full transition-colors relative ${widgetForm.show_rating_summary ? 'bg-elvora-success' : 'bg-elvora-border'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${widgetForm.show_rating_summary ? 'left-5' : 'left-0.5'}`} />
                      </button>
                      <span className="text-xs text-elvora-text-dim">Zusammenfassung</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setEditingWidget(false)} className="px-4 py-2 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors">
                    Abbrechen
                  </button>
                  <button onClick={saveWidget} className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors">
                    Speichern
                  </button>
                </div>
              </div>
            )}

            {/* Widget stats */}
            {!editingWidget && (
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-elvora-bg rounded-lg p-3">
                  <div className="text-[11px] text-elvora-text-dim">Modus</div>
                  <div className="text-white text-sm mt-1">{displayModeLabels[selectedWidget.display_mode]}</div>
                </div>
                <div className="bg-elvora-bg rounded-lg p-3">
                  <div className="text-[11px] text-elvora-text-dim">Theme</div>
                  <div className="text-white text-sm mt-1">{selectedWidget.theme === 'dark' ? 'Dunkel' : 'Hell'}</div>
                </div>
                <div className="bg-elvora-bg rounded-lg p-3">
                  <div className="text-[11px] text-elvora-text-dim">Bewertungen</div>
                  <div className="text-white text-sm mt-1">{selectedWidget.review_count || 0}</div>
                </div>
                <div className="bg-elvora-bg rounded-lg p-3">
                  <div className="text-[11px] text-elvora-text-dim">Durchschnitt</div>
                  <div className="text-white text-sm mt-1 flex items-center gap-1">
                    {selectedWidget.avg_rating || '–'}
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="#FBBF24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reviews list */}
          <div className="card rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Bewertungen ({reviews.length})</h3>
              <button
                onClick={() => setShowAddReview(!showAddReview)}
                className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple/80 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Bewertung hinzufuegen
              </button>
            </div>

            {/* Add review inline form */}
            {showAddReview && (
              <div className="bg-elvora-bg rounded-xl p-4 mb-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Name des Bewerters</label>
                    <input type="text" value={reviewForm.author_name} onChange={e => setReviewForm({ ...reviewForm, author_name: e.target.value })}
                      placeholder="z.B. Thomas Mueller"
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
                  </div>
                  <div>
                    <label className="block text-xs text-elvora-text-dim mb-1">Datum (optional)</label>
                    <input type="date" value={reviewForm.review_date} onChange={e => setReviewForm({ ...reviewForm, review_date: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">Bewertung</label>
                  <StarSelector value={reviewForm.rating} onChange={r => setReviewForm({ ...reviewForm, rating: r })} />
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">Text</label>
                  <textarea value={reviewForm.text} onChange={e => setReviewForm({ ...reviewForm, text: e.target.value })}
                    rows={3} placeholder="Bewertungstext eingeben..."
                    className="w-full px-3 py-2 rounded-lg bg-elvora-surface border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50 resize-none" />
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddReview(false)} className="px-3 py-1.5 rounded-lg text-xs text-elvora-text-dim hover:text-white transition-colors">
                    Abbrechen
                  </button>
                  <button onClick={addReview} disabled={!reviewForm.author_name} className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-40">
                    Hinzufuegen
                  </button>
                </div>
              </div>
            )}

            {/* Reviews */}
            <div className="space-y-2">
              {reviews.map(r => (
                <div key={r.id} className={`bg-elvora-bg rounded-xl p-4 border border-elvora-border/50 transition-opacity ${r.is_visible ? '' : 'opacity-50'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-elvora-purple/15 flex items-center justify-center text-sm font-bold text-elvora-purple-light flex-shrink-0">
                        {r.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{r.author_name}</span>
                          {r.source === 'google' && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-blue-500/15 text-blue-400">Google</span>
                          )}
                          {!r.is_visible && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/15 text-red-400">Versteckt</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StarsDisplay rating={r.rating} size={12} />
                          {r.review_date && (
                            <span className="text-[11px] text-elvora-text-dim">{new Date(r.review_date).toLocaleDateString('de-DE')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => toggleVisibility(r)}
                        title={r.is_visible ? 'Verstecken' : 'Anzeigen'}
                        className="p-1.5 rounded-lg text-elvora-text-dim hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {r.is_visible ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                      <button
                        onClick={() => deleteReview(r.id)}
                        className="p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {r.text && (
                    <p className="text-sm text-elvora-text-muted mt-3 ml-12 leading-relaxed">{r.text}</p>
                  )}
                </div>
              ))}

              {reviews.length === 0 && (
                <div className="text-center py-8 text-sm text-elvora-text-dim">
                  Noch keine Bewertungen vorhanden
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* EMBED TAB                                                          */}
      {/* ================================================================== */}
      {tab === 'embed' && (
        <div className="card rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">Bewertungs-Widget einbetten</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Widget</label>
              <select
                value={embedWidgetId || ''}
                onChange={e => setEmbedWidgetId(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
              >
                {widgets.map(w => (
                  <option key={w.id} value={w.id}>{w.name} ({w.slug})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Anzeige-Modus (optional ueberschreiben)</label>
              <div className="flex gap-2">
                {[
                  { key: '', label: 'Standard' },
                  { key: 'carousel', label: 'Karussell' },
                  { key: 'grid', label: 'Raster' },
                  { key: 'badge', label: 'Badge' },
                  { key: 'wall', label: 'Wand' },
                ].map(m => (
                  <button
                    key={m.key}
                    onClick={() => setEmbedModeOverride(m.key)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      embedModeOverride === m.key
                        ? 'bg-elvora-purple/15 text-elvora-purple-light border border-elvora-purple/30'
                        : 'bg-elvora-bg text-elvora-text-dim border border-elvora-border'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Vorschau</label>
              <div className="rounded-xl bg-white/5 border border-elvora-border p-6 min-h-[160px]">
                {selectedEmbedWidget && (
                  <div className="space-y-4">
                    {/* Summary preview */}
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white">{selectedEmbedWidget.avg_rating || '4.8'}</div>
                        <div className="mt-1">
                          <StarsDisplay rating={Math.round(selectedEmbedWidget.avg_rating || 4.8)} size={16} />
                        </div>
                        <div className="text-[11px] text-elvora-text-dim mt-1">{selectedEmbedWidget.review_count || 0} Bewertungen</div>
                      </div>
                      <div className="flex-1 space-y-1">
                        {[5, 4, 3, 2, 1].map(s => (
                          <div key={s} className="flex items-center gap-2 text-[11px]">
                            <span className="w-4 text-right text-elvora-text-dim">{s}</span>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#FBBF24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                            <div className="flex-1 h-1.5 rounded-full bg-elvora-border overflow-hidden">
                              <div className="h-full rounded-full" style={{
                                width: s === 5 ? '70%' : s === 4 ? '20%' : s === 3 ? '7%' : '3%',
                                backgroundColor: selectedEmbedWidget.color || '#8B5CF6',
                              }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Card preview */}
                    <div className="flex gap-3 overflow-hidden">
                      {[1, 2].map(n => (
                        <div key={n} className="min-w-[220px] bg-elvora-surface rounded-xl p-3 border border-elvora-border">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-7 h-7 rounded-full bg-elvora-purple/15 flex items-center justify-center text-[10px] font-bold text-elvora-purple-light">
                              {n === 1 ? 'TM' : 'SW'}
                            </div>
                            <div>
                              <div className="text-xs font-medium text-white">{n === 1 ? 'Thomas M.' : 'Sandra W.'}</div>
                              <StarsDisplay rating={5} size={10} />
                            </div>
                          </div>
                          <p className="text-[10px] text-elvora-text-dim leading-relaxed line-clamp-2">
                            {n === 1 ? 'Hervorragende Arbeit! Die neue Website sieht fantastisch aus...' : 'Wir sind begeistert von der neuen Website...'}
                          </p>
                        </div>
                      ))}
                    </div>
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
              Fuegen Sie diesen Code an der gewuenschten Stelle Ihrer Website ein. Das Bewertungs-Widget wird automatisch geladen.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* CREATE WIDGET MODAL                                                */}
      {/* ================================================================== */}
      {showCreateWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateWidget(false)} />
          <div className="relative card rounded-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold text-white">Neues Widget</h2>
                <button onClick={() => setShowCreateWidget(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-elvora-text-dim hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">Name</label>
                  <input type="text" value={createForm.name} onChange={e => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="z.B. Google Bewertungen"
                    className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">Slug (URL-freundlich)</label>
                  <input type="text" value={createForm.slug} onChange={e => setCreateForm({ ...createForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="z.B. google-reviews"
                    className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm font-mono focus:outline-none focus:border-elvora-purple/50" />
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">Firmenname</label>
                  <input type="text" value={createForm.business_name} onChange={e => setCreateForm({ ...createForm, business_name: e.target.value })}
                    placeholder="z.B. Elvora Digital"
                    className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50" />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-5">
                <button onClick={() => setShowCreateWidget(false)} className="px-4 py-2 rounded-lg text-sm text-elvora-text-dim hover:text-white transition-colors">
                  Abbrechen
                </button>
                <button onClick={createWidget} disabled={!createForm.name || !createForm.slug}
                  className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-40">
                  Erstellen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
