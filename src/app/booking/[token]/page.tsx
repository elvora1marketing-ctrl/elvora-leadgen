'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';

interface Slot { id: number; start_time: string; end_time: string; }
interface EventType { id: number; name: string; slug: string; description: string; duration: number; color: string; location: string; }
interface Booking { id: number; name: string; email: string | null; phone: string | null; date: string; time_slot: string; duration: number; message: string | null; status: string; token: string; }

const MONTH_NAMES = ['Januar', 'Februar', 'Maerz', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }
function toDateStr(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function getDayOfWeek(d: Date): number { const js = d.getDay(); return js === 0 ? 6 : js - 1; }

function MonthCalendar({
  currentMonth, selectedDate, activeDays, blockedDates, advanceDays, onSelectDate, onChangeMonth,
}: {
  currentMonth: Date; selectedDate: string | null; activeDays: Set<number>; blockedDates: Set<string>;
  advanceDays: number; onSelectDate: (d: string) => void; onChangeMonth: (dir: -1 | 1) => void;
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = getDayOfWeek(firstDay);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + advanceDays);
  const prevMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoPrev = currentMonth > prevMonth;

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onChangeMonth(-1)}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-elvora-text-muted hover:text-white hover:bg-white/5 disabled:opacity-20 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-semibold text-white">{MONTH_NAMES[month]} {year}</span>
        <button
          onClick={() => onChangeMonth(1)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-elvora-text-muted hover:text-white hover:bg-white/5 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-elvora-text-dim py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} className="h-10" />;
          const dateStr = toDateStr(date);
          const isPast = date <= today;
          const isFuture = date > maxDate;
          const dayIdx = getDayOfWeek(date);
          const isActive = activeDays.has(dayIdx) && !isPast && !isFuture && !blockedDates.has(dateStr);
          const isSelected = selectedDate === dateStr;
          const isToday = toDateStr(date) === toDateStr(today);

          return (
            <button
              key={dateStr}
              type="button"
              disabled={!isActive}
              onClick={() => onSelectDate(dateStr)}
              className={`h-10 rounded-lg text-sm font-medium transition-all relative ${
                isSelected
                  ? 'bg-elvora-purple text-white shadow-elvora'
                  : isActive
                    ? 'text-white hover:bg-elvora-purple/15 hover:text-elvora-purple-light'
                    : 'text-elvora-text-dim/30 cursor-not-allowed'
              }`}
            >
              {date.getDate()}
              {isToday && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-elvora-purple" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);

  // Determine mode: event-type booking, "new" (legacy), or existing booking view
  const [mode, setMode] = useState<'loading' | 'booking' | 'confirmation' | 'error'>('loading');
  const [eventType, setEventType] = useState<EventType | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);

  // Booking form state
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set());
  const [blockedDates, setBlockedDates] = useState<Set<string>>(new Set());
  const [advanceDays, setAdvanceDays] = useState(14);
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [step, setStep] = useState<'calendar' | 'form'>('calendar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<Booking | null>(null);

  // Resolve token: event type slug, "new", or booking token
  useEffect(() => {
    if (token === 'new') {
      setMode('booking');
      loadSlotConfig();
      return;
    }
    // Try event type slug first
    fetch(`/api/bookings/event-types?slug=${token}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        if (data.eventType) {
          setEventType(data.eventType);
          setMode('booking');
          loadSlotConfig();
        }
      })
      .catch(() => {
        // Try as booking token
        fetch('/api/bookings')
          .then(r => r.json())
          .then(data => {
            const found = (data.bookings || []).find((b: Booking) => b.token === token);
            if (found) {
              setExistingBooking(found);
              setMode('confirmation');
            } else {
              setMode('error');
            }
          })
          .catch(() => setMode('error'));
      });
  }, [token]);

  function loadSlotConfig() {
    fetch('/api/bookings/slots')
      .then(r => r.json())
      .then(data => {
        const slots = data.slots || [];
        const days = new Set<number>();
        for (const s of slots as { is_active: number; day_of_week: number }[]) {
          if (s.is_active) days.add(s.day_of_week);
        }
        setActiveDays(days);
      });
  }

  // Load slots when date selected
  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    fetch(`/api/bookings/slots?date=${selectedDate}`)
      .then(r => r.json())
      .then(data => {
        setAvailableSlots(data.slots || []);
        if (data.blockedDates) setBlockedDates(new Set(data.blockedDates));
        if (data.settings?.booking_advance_days) setAdvanceDays(parseInt(data.settings.booking_advance_days));
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate]);

  const changeMonth = useCallback((dir: -1 | 1) => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
  }, []);

  const handleSelectSlot = (slot: string) => {
    setSelectedSlot(slot);
    setStep('form');
  };

  const goBackToCalendar = () => {
    setStep('calendar');
    setSelectedSlot(null);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedDate || !selectedSlot || !name.trim()) { setError('Bitte alle Pflichtfelder ausfuellen.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), email: email.trim() || null, phone: phone.trim() || null,
          date: selectedDate, time_slot: selectedSlot, message: message.trim() || null,
          event_type_id: eventType?.id || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Fehler beim Buchen'); return; }
      setSuccess(data.booking);
    } catch { setError('Netzwerkfehler.'); } finally { setSubmitting(false); }
  }

  const duration = eventType?.duration || 30;
  const locationLabel = eventType?.location || 'Video-Call';
  const etName = eventType?.name || 'Termin';
  const etColor = eventType?.color || '#8B5CF6';

  // --- Loading ---
  if (mode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // --- Error ---
  if (mode === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card rounded-xl p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Seite nicht gefunden</h2>
          <p className="text-sm text-elvora-text-dim mb-4">Dieser Buchungslink ist ungueltig.</p>
          <Link href="/booking" className="text-sm text-elvora-purple-light hover:underline">Zur Terminuebersicht</Link>
        </div>
      </div>
    );
  }

  // --- Existing Booking Confirmation ---
  if (mode === 'confirmation' && existingBooking) {
    const stMap: Record<string, { label: string; color: string }> = {
      confirmed: { label: 'Bestaetigt', color: 'bg-elvora-success/15 text-elvora-success' },
      cancelled: { label: 'Abgesagt', color: 'bg-red-500/15 text-red-400' },
      completed: { label: 'Abgeschlossen', color: 'bg-elvora-purple/15 text-elvora-purple-light' },
      no_show: { label: 'Nicht erschienen', color: 'bg-elvora-warning/15 text-elvora-warning' },
    };
    const st = stMap[existingBooking.status] || { label: existingBooking.status, color: 'bg-elvora-border text-elvora-text-dim' };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card rounded-xl overflow-hidden">
            <div className="h-2 bg-elvora-gradient" />
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-elvora-success/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h1 className="text-xl font-bold text-white">Ihre Buchung</h1>
              <span className={`inline-block mt-2 px-3 py-1 rounded-lg text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>
            <div className="px-6 pb-6 space-y-3">
              <div className="bg-elvora-bg rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-elvora-purple flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <div>
                    <div className="text-sm font-medium text-white">{formatDate(existingBooking.date)}</div>
                    <div className="text-xs text-elvora-text-dim">{existingBooking.time_slot} Uhr · {existingBooking.duration} Min.</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-elvora-purple flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <div>
                    <div className="text-sm font-medium text-white">{existingBooking.name}</div>
                    {existingBooking.email && <div className="text-xs text-elvora-text-dim">{existingBooking.email}</div>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Success ---
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card rounded-xl overflow-hidden">
            <div className="h-2" style={{ background: `linear-gradient(90deg, ${etColor}, ${etColor}88)` }} />
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-elvora-success/15 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Termin gebucht!</h2>
              <p className="text-sm text-elvora-text-muted">Ihr {etName} wurde erfolgreich reserviert.</p>
            </div>
            <div className="px-8 pb-8">
              <div className="bg-elvora-bg rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-elvora-text-dim">Typ</span>
                  <span className="text-sm font-medium text-white">{etName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-elvora-text-dim">Datum</span>
                  <span className="text-sm font-medium text-white">{formatDate(success.date)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-elvora-text-dim">Uhrzeit</span>
                  <span className="text-sm font-medium text-white">{success.time_slot} Uhr</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-elvora-text-dim">Dauer</span>
                  <span className="text-sm font-medium text-white">{success.duration} Minuten</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-elvora-text-dim">Ort</span>
                  <span className="text-sm font-medium text-white">{locationLabel}</span>
                </div>
              </div>
              <p className="text-xs text-elvora-text-dim/60 mt-4 text-center">
                Sie erhalten in Kuerze eine Bestaetigung per E-Mail.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Booking Form (Calendly-Style) ---
  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-2xl">
        <div className="card rounded-2xl overflow-hidden shadow-elvora-lg">
          {/* Color bar */}
          <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${etColor}, ${etColor}88)` }} />

          <div className="md:flex">
            {/* Left: Event Info */}
            <div className="md:w-[220px] p-5 md:border-r border-b md:border-b-0 border-elvora-border flex-shrink-0">
              <Link href="/booking" className="text-xs text-elvora-text-dim hover:text-elvora-purple-light transition-colors flex items-center gap-1 mb-4">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Zurueck
              </Link>

              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: etColor + '20' }}>
                <svg className="w-5 h-5" style={{ color: etColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>

              <h1 className="text-lg font-bold text-white">{etName}</h1>
              {eventType?.description && (
                <p className="text-xs text-elvora-text-muted mt-1.5 leading-relaxed">{eventType.description}</p>
              )}

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 text-xs text-elvora-text-dim">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {duration} Minuten
                </div>
                <div className="flex items-center gap-2 text-xs text-elvora-text-dim">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  {locationLabel}
                </div>
                {selectedDate && selectedSlot && (
                  <div className="flex items-center gap-2 text-xs text-white font-medium pt-1 border-t border-elvora-border mt-2">
                    <svg className="w-3.5 h-3.5 text-elvora-success flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {formatDate(selectedDate)}, {selectedSlot} Uhr
                  </div>
                )}
              </div>
            </div>

            {/* Right: Calendar/Form */}
            <div className="flex-1 p-5">
              {step === 'calendar' ? (
                <div>
                  <h2 className="text-sm font-semibold text-white mb-4">Datum & Uhrzeit waehlen</h2>

                  <MonthCalendar
                    currentMonth={currentMonth}
                    selectedDate={selectedDate}
                    activeDays={activeDays}
                    blockedDates={blockedDates}
                    advanceDays={advanceDays}
                    onSelectDate={setSelectedDate}
                    onChangeMonth={changeMonth}
                  />

                  {/* Time Slots */}
                  {selectedDate && (
                    <div className="mt-5 pt-5 border-t border-elvora-border">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-elvora-text-muted uppercase tracking-wider">
                          Verfuegbare Zeiten
                        </h3>
                        <span className="text-[11px] text-elvora-text-dim">{formatDate(selectedDate)}</span>
                      </div>

                      {slotsLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : availableSlots.length === 0 ? (
                        <p className="text-sm text-elvora-text-dim text-center py-4">Keine verfuegbaren Zeiten an diesem Tag.</p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                          {availableSlots.map((slot) => (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => handleSelectSlot(slot.start_time)}
                              className="py-2.5 px-2 rounded-lg text-sm font-medium transition-all border border-elvora-border hover:border-elvora-purple/40 hover:bg-elvora-purple/10 text-white"
                              style={selectedSlot === slot.start_time ? { backgroundColor: etColor + '20', borderColor: etColor + '60' } : {}}
                            >
                              {slot.start_time}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Contact Form */
                <div>
                  <button onClick={goBackToCalendar} className="flex items-center gap-1 text-xs text-elvora-text-dim hover:text-elvora-purple-light transition-colors mb-4">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Zurueck zum Kalender
                  </button>

                  <h2 className="text-sm font-semibold text-white mb-1">Ihre Daten</h2>
                  <p className="text-xs text-elvora-text-dim mb-4">
                    {formatDate(selectedDate!)} um {selectedSlot} Uhr · {duration} Min.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                      <label className="block text-xs text-elvora-text-dim mb-1">Name *</label>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="Ihr vollstaendiger Name"
                        className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs text-elvora-text-dim mb-1">E-Mail *</label>
                      <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="ihre@email.de"
                        className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs text-elvora-text-dim mb-1">Telefon</label>
                      <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+49 123 456 789"
                        className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs text-elvora-text-dim mb-1">Nachricht (optional)</label>
                      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3} placeholder="Worum geht es?"
                        className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors resize-none" />
                    </div>

                    {error && (
                      <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || !name.trim() || !email.trim()}
                      className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                      style={{ background: `linear-gradient(135deg, ${etColor}, ${etColor}cc)` }}
                    >
                      {submitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Wird gebucht...
                        </span>
                      ) : 'Termin buchen'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-elvora-text-dim/40 mt-6">
          Powered by Elvora
        </p>
      </div>
    </div>
  );
}
