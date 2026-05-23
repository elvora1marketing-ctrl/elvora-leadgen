'use client';

import { useState, useEffect, use } from 'react';

interface Slot {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: number;
}

interface BookingSettings {
  booking_enabled?: string;
  booking_duration?: string;
  booking_buffer?: string;
  booking_advance_days?: string;
  booking_page_title?: string;
  booking_page_description?: string;
}

interface Booking {
  id: number;
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
}

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()}. ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function getDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getNext14Days(): Date[] {
  const days: Date[] = [];
  const now = new Date();
  for (let i = 1; days.length < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Bestätigt', color: 'bg-elvora-success/15 text-elvora-success' },
  cancelled: { label: 'Abgesagt', color: 'bg-red-500/15 text-red-400' },
  completed: { label: 'Abgeschlossen', color: 'bg-elvora-purple/15 text-elvora-purple-light' },
  no_show: { label: 'Nicht erschienen', color: 'bg-elvora-warning/15 text-elvora-warning' },
};

export default function BookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const isNewBooking = token === 'new';

  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [lookupLoading, setLookupLoading] = useState(!isNewBooking);
  const [lookupError, setLookupError] = useState(false);

  // Booking form state
  const [settings, setSettings] = useState<BookingSettings>({});
  const [availableDays] = useState<Date[]>(getNext14Days());
  const [activeDaysOfWeek, setActiveDaysOfWeek] = useState<Set<number>>(new Set());
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<Booking | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load existing booking by token
  useEffect(() => {
    if (isNewBooking) return;
    fetch('/api/bookings')
      .then(r => r.json())
      .then(data => {
        const found = (data.bookings || []).find((b: Booking) => b.token === token);
        if (found) {
          setExistingBooking(found);
        } else {
          setLookupError(true);
        }
      })
      .catch(() => setLookupError(true))
      .finally(() => setLookupLoading(false));
  }, [token, isNewBooking]);

  // Load active days of week from all slots (to know which calendar days to enable)
  useEffect(() => {
    if (!isNewBooking) return;
    fetch('/api/bookings/slots')
      .then(r => r.json())
      .then(data => {
        const slots = data.slots || [];
        const days = new Set<number>();
        for (const s of slots) {
          if (s.is_active) days.add(s.day_of_week);
        }
        setActiveDaysOfWeek(days);
        // Load settings from first date fetch
        setSettingsLoaded(true);
      })
      .catch(() => {});
  }, [isNewBooking]);

  // Load available slots when date is selected
  useEffect(() => {
    if (!selectedDate) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    fetch(`/api/bookings/slots?date=${selectedDate}`)
      .then(r => r.json())
      .then(data => {
        setAvailableSlots(data.slots || []);
        if (data.settings) setSettings(data.settings);
      })
      .catch(() => setAvailableSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedDate || !selectedSlot) {
      setError('Bitte wählen Sie ein Datum und einen Zeitslot.');
      return;
    }
    if (!name.trim()) {
      setError('Bitte geben Sie Ihren Namen ein.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          date: selectedDate,
          time_slot: selectedSlot,
          message: message.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Fehler beim Buchen');
        return;
      }

      setSuccess(data.booking);
    } catch {
      setError('Netzwerkfehler. Bitte versuchen Sie es erneut.');
    } finally {
      setSubmitting(false);
    }
  }

  function isDayAvailable(date: Date): boolean {
    const jsDay = date.getDay();
    const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
    return activeDaysOfWeek.has(dayOfWeek);
  }

  // --- Existing booking view ---
  if (!isNewBooking) {
    if (lookupLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-elvora-text-dim">Buchung wird geladen...</p>
          </div>
        </div>
      );
    }

    if (lookupError || !existingBooking) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card rounded-xl p-8 max-w-md w-full text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Buchung nicht gefunden</h2>
            <p className="text-sm text-elvora-text-dim">Dieser Buchungslink ist ungültig oder die Buchung wurde entfernt.</p>
          </div>
        </div>
      );
    }

    const st = statusLabels[existingBooking.status] || { label: existingBooking.status, color: 'bg-elvora-border text-elvora-text-dim' };

    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-white">Ihre Buchung</h1>
            <p className="text-sm text-elvora-text-dim mt-1">Details zu Ihrem gebuchten Termin</p>
          </div>

          <div className="card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-elvora-text-dim">Status</span>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${st.color}`}>{st.label}</span>
            </div>

            <div className="border-t border-elvora-border pt-4 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-elvora-purple mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-white">{formatDate(existingBooking.date)}</div>
                  <div className="text-xs text-elvora-text-dim">{existingBooking.time_slot} Uhr ({existingBooking.duration} Min.)</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-elvora-purple mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <div>
                  <div className="text-sm font-medium text-white">{existingBooking.name}</div>
                  {existingBooking.email && <div className="text-xs text-elvora-text-dim">{existingBooking.email}</div>}
                  {existingBooking.phone && <div className="text-xs text-elvora-text-dim">{existingBooking.phone}</div>}
                </div>
              </div>

              {existingBooking.message && (
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-elvora-purple mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                  <div className="text-sm text-elvora-text-muted">{existingBooking.message}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Success view ---
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="card rounded-xl p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-elvora-success/15 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Termin gebucht!</h2>
            <p className="text-sm text-elvora-text-dim mb-6">Ihr Termin wurde erfolgreich reserviert.</p>

            <div className="bg-elvora-bg rounded-xl p-4 space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-xs text-elvora-text-dim">Datum</span>
                <span className="text-sm font-medium text-white">{formatDate(success.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-elvora-text-dim">Uhrzeit</span>
                <span className="text-sm font-medium text-white">{success.time_slot} Uhr</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-elvora-text-dim">Dauer</span>
                <span className="text-sm font-medium text-white">{success.duration} Minuten</span>
              </div>
            </div>

            <p className="text-xs text-elvora-text-dim mt-4">
              Sie erhalten in Kürze eine Bestätigung. Bei Fragen können Sie uns jederzeit kontaktieren.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Booking form ---
  const title = settings.booking_page_title || 'Termin buchen';
  const description = settings.booking_page_description || 'Wählen Sie einen passenden Termin für ein unverbindliches Erstgespräch.';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-elvora-gradient flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-elvora-text-dim mt-2 max-w-sm mx-auto">{description}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Step 1: Select Date */}
          <div className="card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-elvora-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-elvora-primary-light">1</span>
              </div>
              <h2 className="text-sm font-semibold text-white">Datum wählen</h2>
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {availableDays.map((day) => {
                const dateStr = getDateString(day);
                const jsDay = day.getDay();
                const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;
                const available = isDayAvailable(day);
                const isSelected = selectedDate === dateStr;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={!available}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`flex flex-col items-center py-2 px-1 rounded-lg text-center transition-all ${
                      isSelected
                        ? 'bg-elvora-primary text-white ring-2 ring-elvora-primary/50'
                        : available
                          ? 'bg-elvora-bg hover:bg-elvora-surface text-elvora-text cursor-pointer'
                          : 'bg-elvora-bg/50 text-elvora-text-dim/40 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-medium">{DAY_NAMES[dayOfWeek]}</span>
                    <span className="text-sm font-semibold mt-0.5">{day.getDate()}</span>
                    <span className="text-[10px] opacity-60">{MONTH_NAMES[day.getMonth()].substring(0, 3)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Select Time */}
          {selectedDate && (
            <div className="card rounded-xl p-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-elvora-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-elvora-primary-light">2</span>
                </div>
                <h2 className="text-sm font-semibold text-white">Uhrzeit wählen</h2>
                <span className="text-xs text-elvora-text-dim ml-auto">{formatDate(selectedDate)}</span>
              </div>

              {slotsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-elvora-text-dim">Keine verfügbaren Zeitslots an diesem Tag.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setSelectedSlot(slot.start_time)}
                      className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                        selectedSlot === slot.start_time
                          ? 'bg-elvora-primary text-white ring-2 ring-elvora-primary/50'
                          : 'bg-elvora-bg hover:bg-elvora-surface text-elvora-text border border-elvora-border hover:border-elvora-primary/30'
                      }`}
                    >
                      {slot.start_time} Uhr
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Contact Info */}
          {selectedSlot && (
            <div className="card rounded-xl p-5 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 rounded-full bg-elvora-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-elvora-primary-light">3</span>
                </div>
                <h2 className="text-sm font-semibold text-white">Ihre Daten</h2>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ihr vollständiger Name"
                    required
                    className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1.5">E-Mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ihre@email.de"
                    className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1.5">Telefon</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+49 123 456 789"
                    className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1.5">Nachricht (optional)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Worum geht es bei unserem Gespräch?"
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
              {error}
            </div>
          )}

          {/* Submit */}
          {selectedSlot && (
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="w-full py-3 rounded-xl bg-elvora-gradient text-white text-sm font-semibold hover:bg-elvora-gradient-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed animate-fade-in"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Wird gebucht...
                </span>
              ) : (
                `Termin buchen - ${selectedSlot} Uhr, ${formatDate(selectedDate!)}`
              )}
            </button>
          )}
        </form>

        {/* Footer */}
        <p className="text-center text-[11px] text-elvora-text-dim/50 mt-8">
          Ihre Daten werden vertraulich behandelt und nur für die Terminvereinbarung verwendet.
        </p>
      </div>
    </div>
  );
}
