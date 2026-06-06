'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EventType {
  id: number;
  name: string;
  slug: string;
  description: string;
  duration: number;
  color: string;
  location: string;
  is_active: number;
}

export default function BookingLandingPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      fetch('/api/bookings/event-types?active=1').then(r => r.json()),
      fetch('/api/bookings/slots?date=' + new Date().toISOString().split('T')[0]).then(r => r.json()),
    ]).then(([etData, slotData]) => {
      setEventTypes(etData.eventTypes || []);
      if (slotData.settings) setSettings(slotData.settings);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const title = settings.booking_page_title || 'Termin buchen';

  const locationIcons: Record<string, string> = {
    'Video-Call': 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
    'Telefon': 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
    'Vor Ort': 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-elvora-gradient flex items-center justify-center mx-auto mb-5 shadow-elvora">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
          <p className="text-sm text-elvora-text-muted mt-2">
            Waehlen Sie die Art des Termins, der am besten zu Ihnen passt.
          </p>
        </div>

        {/* Event Types */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card rounded-xl p-5 animate-pulse">
                <div className="h-5 w-32 bg-elvora-surface rounded mb-2" />
                <div className="h-4 w-full bg-elvora-surface rounded" />
              </div>
            ))}
          </div>
        ) : eventTypes.length === 0 ? (
          <div className="card rounded-xl p-8 text-center">
            <p className="text-sm text-elvora-text-muted">Keine Termintypen verfuegbar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventTypes.map((et) => (
              <Link
                key={et.id}
                href={`/booking/${et.slug}`}
                className="block card rounded-xl p-5 transition-all hover:border-elvora-border-light group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-1 h-12 rounded-full flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: et.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white group-hover:text-elvora-purple-light transition-colors">
                      {et.name}
                    </h3>
                    <p className="text-sm text-elvora-text-muted mt-0.5 line-clamp-2">{et.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-elvora-text-dim">
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {et.duration} Min.
                      </span>
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={locationIcons[et.location] || locationIcons['Video-Call']} />
                        </svg>
                        {et.location}
                      </span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-elvora-text-dim group-hover:text-elvora-purple-light transition-colors mt-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}

        <p className="text-center text-[11px] text-elvora-text-dim/50 mt-8">
          Powered by Elvora
        </p>
      </div>
    </div>
  );
}
