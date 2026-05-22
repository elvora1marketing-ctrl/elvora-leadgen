'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface FeedItem {
  id: number;
  type: string;
  title: string;
  description: string;
  lead_id: number | null;
  lead_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const TYPE_CONFIG: Record<string, { icon: string; category: string }> = {
  email_sent: { icon: 'email', category: 'emails' },
  email_opened: { icon: 'email', category: 'emails' },
  email_replied: { icon: 'email', category: 'emails' },
  email_bounced: { icon: 'email', category: 'emails' },
  call_made: { icon: 'call', category: 'anrufe' },
  call_scheduled: { icon: 'call', category: 'anrufe' },
  status_changed: { icon: 'status', category: 'status' },
  lead_created: { icon: 'status', category: 'status' },
  lead_qualified: { icon: 'status', category: 'status' },
  deal_won: { icon: 'status', category: 'status' },
  deal_lost: { icon: 'status', category: 'status' },
  audit_viewed: { icon: 'monitoring', category: 'monitoring' },
  audit_cta_click: { icon: 'monitoring', category: 'monitoring' },
  website_scanned: { icon: 'monitoring', category: 'monitoring' },
  task_completed: { icon: 'status', category: 'status' },
  sequence_enrolled: { icon: 'email', category: 'emails' },
  invoice_paid: { icon: 'status', category: 'status' },
};

const POSITIVE_TYPES = new Set([
  'email_opened', 'email_replied', 'deal_won', 'lead_qualified',
  'audit_cta_click', 'invoice_paid', 'task_completed',
]);

const NEGATIVE_TYPES = new Set([
  'email_bounced', 'deal_lost',
]);

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Gerade eben';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `vor ${diffHrs} Std`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays} Tagen`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `vor ${diffWeeks} Wo`;
  return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function EventIcon({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type];
  const iconType = cfg?.icon || 'status';

  if (iconType === 'email') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (iconType === 'call') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    );
  }
  if (iconType === 'monitoring') {
    return (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
    );
  }
  // status / default
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [filter, setFilter] = useState('alle');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      const res = await fetch(`/api/feed?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || data.feed || data || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [limit]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadFeed();
      }, 30000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, loadFeed]);

  const filteredItems = items.filter(item => {
    if (filter === 'alle') return true;
    const cfg = TYPE_CONFIG[item.type];
    if (!cfg) return filter === 'status';
    return cfg.category === filter;
  });

  const filterButtons = [
    { key: 'alle', label: 'Alle' },
    { key: 'emails', label: 'Emails' },
    { key: 'anrufe', label: 'Anrufe' },
    { key: 'status', label: 'Status' },
    { key: 'monitoring', label: 'Monitoring' },
  ];

  const loadMore = () => {
    setLimit(prev => prev + 50);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl lg:text-2xl font-semibold text-elvora-text">Live Feed</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-elvora-text-muted">Auto-Refresh</span>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                autoRefresh ? 'bg-elvora-success' : 'bg-white/10'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                autoRefresh ? 'left-5' : 'left-0.5'
              }`} />
            </button>
            {autoRefresh && (
              <span className="flex items-center gap-1 text-[10px] text-elvora-success">
                <span className="w-1.5 h-1.5 rounded-full bg-elvora-success pulse-dot" />
                30s
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === btn.key
                ? 'bg-elvora-purple/20 text-elvora-purple-light border border-elvora-purple/30'
                : 'bg-white/5 text-elvora-text-muted hover:bg-white/10 border border-transparent'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Feed List */}
      {loading ? (
        <div className="text-center py-12 text-elvora-text-dim text-sm">Laden...</div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div className="text-elvora-text-dim text-sm">Noch keine Aktivitäten</div>
          <div className="text-elvora-text-dim text-xs mt-1">Neue Events erscheinen hier automatisch</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredItems.map(item => {
            const isPositive = POSITIVE_TYPES.has(item.type);
            const isNegative = NEGATIVE_TYPES.has(item.type);

            return (
              <div
                key={item.id}
                className={`card rounded-xl p-4 transition-all ${
                  isPositive
                    ? 'border-elvora-success/20 bg-emerald-500/[0.03]'
                    : isNegative
                      ? 'border-red-500/20 bg-red-500/[0.03]'
                      : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isPositive
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : isNegative
                        ? 'bg-red-500/15 text-red-400'
                        : 'bg-elvora-primary/10 text-elvora-purple-light'
                  }`}>
                    <EventIcon type={item.type} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-elvora-text">{item.title}</span>
                        {item.description && (
                          <p className="text-xs text-elvora-text-muted mt-0.5">{item.description}</p>
                        )}
                        {item.lead_name && item.lead_id && (
                          <Link
                            href={`/crm/${item.lead_id}`}
                            className="inline-flex items-center gap-1 text-[11px] text-elvora-purple-light hover:text-elvora-purple-light hover:underline mt-1"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {item.lead_name}
                          </Link>
                        )}
                      </div>
                      <span className="text-[11px] text-elvora-text-dim flex-shrink-0 whitespace-nowrap">
                        {relativeTime(item.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load More */}
          <div className="text-center pt-4">
            <button
              onClick={loadMore}
              className="px-5 py-2 rounded-lg bg-white/5 text-sm text-elvora-text-muted hover:bg-white/10 hover:text-white transition-all"
            >
              Mehr laden
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
