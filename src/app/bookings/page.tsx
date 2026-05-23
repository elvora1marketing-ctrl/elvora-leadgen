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
