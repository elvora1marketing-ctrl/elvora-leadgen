'use client';

import { useState, useEffect, useCallback } from 'react';

interface Booking {
  id: number;
  lead_id: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  date: string;
  time_slot: string;
  duration: number;
  message: string | null;
  status: string;
  token: string;
  created_at: string;
  lead_name: string | null;
  lead_city: string | null;
}

interface EventType {
  id: number;
  name: string;
  slug: string;
  color: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Bestätigt', color: 'bg-elvora-success/15 text-elvora-success' },
  completed: { label: 'Abgeschlossen', color: 'bg-elvora-purple/15 text-elvora-purple-light' },
  cancelled: { label: 'Abgesagt', color: 'bg-red-500/15 text-red-400' },
  no_show: { label: 'Nicht erschienen', color: 'bg-elvora-warning/15 text-elvora-warning' },
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function getTodayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);

  const today = getTodayString();

  const loadBookings = useCallback(async () => {
    try {
      const res = await fetch('/api/bookings');
      const data = await res.json();
      setBookings(data.bookings || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBookings();
    fetch('/api/bookings/event-types?active=1')
      .then(r => r.json())
      .then(data => setEventTypes(data.eventTypes || []))
      .catch(() => {});
  }, [loadBookings]);

  async function updateStatus(id: number, status: string) {
    setActionLoading(id);
    try {
      await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await loadBookings();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  async function deleteBooking(id: number) {
    if (!confirm('Buchung wirklich löschen?')) return;
    setActionLoading(id);
    try {
      await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      await loadBookings();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  function copyBookingLink() {
    const url = `${window.location.origin}/booking/new`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);
  const todaysBookings = filtered.filter(b => b.date === today);
  const otherBookings = filtered.filter(b => b.date !== today);
  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
  const todayCount = bookings.filter(b => b.date === today && b.status === 'confirmed').length;
  const completedCount = bookings.filter(b => b.status === 'completed').length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Termine</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Alle gebuchten Termine verwalten</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowEmbed(true)}
            className="px-4 py-2 rounded-lg bg-elvora-surface text-elvora-text-muted text-sm font-medium hover:text-white border border-elvora-border hover:border-elvora-border-light transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Einbetten
          </button>
          <button
            onClick={copyBookingLink}
            className="px-4 py-2 rounded-lg bg-elvora-primary text-white text-sm font-medium hover:bg-elvora-primary-dark transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            {copiedLink ? 'Kopiert!' : 'Buchungslink kopieren'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Heute</div>
          <div className="text-2xl font-bold text-elvora-accent mt-1">{todayCount}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Bestätigt</div>
          <div className="text-2xl font-bold text-elvora-success mt-1">{confirmedCount}</div>
        </div>
        <div className="card rounded-xl p-4">
          <div className="text-xs text-elvora-text-dim">Abgeschlossen</div>
          <div className="text-2xl font-bold text-elvora-purple-light mt-1">{completedCount}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'Alle' },
          { key: 'confirmed', label: 'Bestätigt' },
          { key: 'completed', label: 'Abgeschlossen' },
          { key: 'cancelled', label: 'Abgesagt' },
          { key: 'no_show', label: 'No-Show' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-elvora-primary/20 text-elvora-primary-light border border-elvora-primary/30'
                : 'bg-elvora-bg-alt text-elvora-text-dim border border-elvora-border hover:border-elvora-border-light'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Today's Bookings */}
      {todaysBookings.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-elvora-accent mb-3 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Heute ({todaysBookings.length})
          </h2>
          <div className="space-y-2">
            {todaysBookings.map(booking => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isToday
                actionLoading={actionLoading}
                onUpdateStatus={updateStatus}
                onDelete={deleteBooking}
              />
            ))}
          </div>
        </div>
      )}

      {/* Other Bookings */}
      {otherBookings.length > 0 && (
        <div>
          {todaysBookings.length > 0 && (
            <h2 className="text-sm font-semibold text-elvora-text-dim mb-3">
              Weitere Termine ({otherBookings.length})
            </h2>
          )}
          <div className="space-y-2">
            {otherBookings.map(booking => (
              <BookingCard
                key={booking.id}
                booking={booking}
                isToday={false}
                actionLoading={actionLoading}
                onUpdateStatus={updateStatus}
                onDelete={deleteBooking}
              />
            ))}
          </div>
        </div>
      )}

      {/* Embed Modal */}
      {showEmbed && (
        <EmbedModal
          eventTypes={eventTypes}
          onClose={() => setShowEmbed(false)}
        />
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="card rounded-xl p-12 text-center">
          <svg className="w-10 h-10 text-elvora-text-dim/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-elvora-text-dim">Keine Termine gefunden</p>
          <button
            onClick={copyBookingLink}
            className="mt-3 px-4 py-2 rounded-lg bg-elvora-primary/10 text-elvora-primary-light text-xs font-medium hover:bg-elvora-primary/20 transition-colors"
          >
            Buchungslink teilen
          </button>
        </div>
      )}
    </div>
  );
}

function EmbedModal({ eventTypes, onClose }: { eventTypes: EventType[]; onClose: () => void }) {
  const [embedType, setEmbedType] = useState<'inline' | 'popup' | 'badge'>('inline');
  const [selectedSlug, setSelectedSlug] = useState('');
  const [btnText, setBtnText] = useState('Termin buchen');
  const [btnColor, setBtnColor] = useState('#8B5CF6');
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const bookingUrl = selectedSlug ? `${baseUrl}/booking/${selectedSlug}` : `${baseUrl}/booking`;

  function getCode(): string {
    const slugAttr = selectedSlug ? ` data-slug="${selectedSlug}"` : '';
    if (embedType === 'inline') {
      return `<div id="elvora-booking"></div>\n<script src="${baseUrl}/elvora-booking.js" data-url="${baseUrl}/booking"${slugAttr} data-type="inline"></script>`;
    }
    if (embedType === 'popup') {
      return `<script src="${baseUrl}/elvora-booking.js" data-url="${baseUrl}/booking"${slugAttr} data-type="popup" data-text="${btnText}" data-color="${btnColor}"></script>`;
    }
    return `<script src="${baseUrl}/elvora-booking.js" data-url="${baseUrl}/booking"${slugAttr} data-type="badge" data-text="${btnText}" data-color="${btnColor}"></script>`;
  }

  function copyCode() {
    navigator.clipboard.writeText(getCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const types = [
    { key: 'inline' as const, label: 'Inline', desc: 'Direkt auf der Seite eingebettet', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z' },
    { key: 'popup' as const, label: 'Popup-Button', desc: 'Button oeffnet Buchung als Modal', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122' },
    { key: 'badge' as const, label: 'Floating Badge', desc: 'Schwebendes Badge unten rechts', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative card rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-white">Auf Website einbetten</h2>
              <p className="text-xs text-elvora-text-dim mt-0.5">Buchungssystem auf externen Seiten einbinden</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-elvora-text-dim hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Embed Type Selection */}
          <div className="space-y-2 mb-5">
            {types.map(t => (
              <button
                key={t.key}
                onClick={() => setEmbedType(t.key)}
                className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                  embedType === t.key
                    ? 'bg-elvora-purple/10 border border-elvora-purple/30'
                    : 'bg-elvora-bg border border-elvora-border hover:border-elvora-border-light'
                }`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  embedType === t.key ? 'bg-elvora-purple/20' : 'bg-elvora-surface'
                }`}>
                  <svg className={`w-4.5 h-4.5 ${embedType === t.key ? 'text-elvora-purple-light' : 'text-elvora-text-dim'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={t.icon} />
                  </svg>
                </div>
                <div>
                  <div className={`text-sm font-medium ${embedType === t.key ? 'text-white' : 'text-elvora-text-muted'}`}>{t.label}</div>
                  <div className="text-[11px] text-elvora-text-dim">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Options */}
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1.5">Termintyp</label>
              <select
                value={selectedSlug}
                onChange={e => {
                  setSelectedSlug(e.target.value);
                  const et = eventTypes.find(t => t.slug === e.target.value);
                  if (et) setBtnColor(et.color);
                }}
                className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
              >
                <option value="">Alle Termintypen (Auswahl-Seite)</option>
                {eventTypes.map(et => (
                  <option key={et.id} value={et.slug}>{et.name}</option>
                ))}
              </select>
            </div>

            {embedType !== 'inline' && (
              <>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1.5">Button-Text</label>
                  <input
                    type="text"
                    value={btnText}
                    onChange={e => setBtnText(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1.5">Button-Farbe</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={btnColor}
                      onChange={e => setBtnColor(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-elvora-border cursor-pointer bg-transparent"
                    />
                    <input
                      type="text"
                      value={btnColor}
                      onChange={e => setBtnColor(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm font-mono focus:outline-none focus:border-elvora-purple/50"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Preview */}
          <div className="mb-5">
            <label className="block text-xs text-elvora-text-dim mb-1.5">Vorschau</label>
            <div className="rounded-xl bg-white/5 border border-elvora-border p-6 flex items-center justify-center min-h-[80px]">
              {embedType === 'inline' ? (
                <div className="w-full rounded-lg border border-dashed border-elvora-border p-4 text-center">
                  <div className="text-xs text-elvora-text-dim">Inline-Buchungsformular</div>
                  <div className="text-[10px] text-elvora-text-dim/50 mt-1">{bookingUrl}</div>
                </div>
              ) : embedType === 'popup' ? (
                <button
                  className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold flex items-center gap-2"
                  style={{ background: btnColor }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {btnText}
                </button>
              ) : (
                <div className="relative w-full h-20">
                  <button
                    className="absolute bottom-0 right-0 px-5 h-12 rounded-full text-white text-sm font-semibold flex items-center gap-2 shadow-lg"
                    style={{ background: btnColor }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {btnText}
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
                onClick={copyCode}
                className="text-xs text-elvora-purple-light hover:text-white transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copied ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'} />
                </svg>
                {copied ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>
            <pre className="bg-elvora-bg rounded-xl p-4 text-xs text-elvora-text-muted font-mono overflow-x-auto border border-elvora-border whitespace-pre-wrap break-all leading-relaxed">
              {getCode()}
            </pre>
          </div>

          <p className="text-[11px] text-elvora-text-dim/50 mt-4">
            Fuegen Sie diesen Code in den HTML-Body Ihrer Website ein. Das Buchungssystem wird automatisch geladen.
          </p>
        </div>
      </div>
    </div>
  );
}

function BookingCard({
  booking,
  isToday,
  actionLoading,
  onUpdateStatus,
  onDelete,
}: {
  booking: Booking;
  isToday: boolean;
  actionLoading: number | null;
  onUpdateStatus: (id: number, status: string) => void;
  onDelete: (id: number) => void;
}) {
  const st = statusConfig[booking.status] || { label: booking.status, color: 'bg-elvora-border text-elvora-text-dim' };
  const isLoading = actionLoading === booking.id;

  return (
    <div className={`card rounded-xl p-4 ${isToday ? 'ring-1 ring-elvora-accent/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-white truncate">{booking.name}</span>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${st.color}`}>{st.label}</span>
          </div>

          <div className="flex items-center gap-3 text-xs text-elvora-text-dim">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(booking.date)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {booking.time_slot} Uhr ({booking.duration} Min.)
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5 text-xs text-elvora-text-muted">
            {booking.email && (
              <a href={`mailto:${booking.email}`} className="hover:text-elvora-primary-light transition-colors truncate">
                {booking.email}
              </a>
            )}
            {booking.phone && (
              <a href={`tel:${booking.phone}`} className="hover:text-elvora-success transition-colors">
                {booking.phone}
              </a>
            )}
            {booking.lead_id && booking.lead_name && (
              <a href={`/leads?search=${encodeURIComponent(booking.lead_name)}`} className="flex items-center gap-1 text-elvora-purple-light hover:text-elvora-primary-light transition-colors">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {booking.lead_name}
              </a>
            )}
          </div>

          {booking.message && (
            <p className="text-xs text-elvora-text-dim mt-2 line-clamp-1 italic">
              &quot;{booking.message}&quot;
            </p>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {booking.status === 'confirmed' && (
                <>
                  <button
                    onClick={() => onUpdateStatus(booking.id, 'completed')}
                    title="Abgeschlossen"
                    className="p-1.5 rounded-lg hover:bg-elvora-success/10 text-elvora-text-dim hover:text-elvora-success transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onUpdateStatus(booking.id, 'no_show')}
                    title="Nicht erschienen"
                    className="p-1.5 rounded-lg hover:bg-elvora-warning/10 text-elvora-text-dim hover:text-elvora-warning transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onUpdateStatus(booking.id, 'cancelled')}
                    title="Absagen"
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-elvora-text-dim hover:text-red-400 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
              <button
                onClick={() => onDelete(booking.id)}
                title="Löschen"
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-elvora-text-dim hover:text-red-400 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
