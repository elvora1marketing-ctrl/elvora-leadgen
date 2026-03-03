'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CheckStat {
  branche: string;
  stadt: string;
  branche_slug: string;
  stadt_slug: string;
  views: number;
  submissions: number;
}

interface InboundLead {
  id: number;
  name: string;
  website: string;
  city: string;
  score: number;
  created_at: string;
  phone: string | null;
  email: string | null;
}

export default function CheckOverviewPage() {
  const [stats, setStats] = useState<CheckStat[]>([]);
  const [inboundLeads, setInboundLeads] = useState<InboundLead[]>([]);
  const [totals, setTotals] = useState({ views: 0, submissions: 0, inboundLeads: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/check/overview').then(r => r.json()),
    ]).then(([data]) => {
      setStats(data.stats || []);
      setInboundLeads(data.inboundLeads || []);
      setTotals(data.totals || { views: 0, submissions: 0, inboundLeads: 0 });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const conversionRate = totals.views > 0
    ? ((totals.submissions / totals.views) * 100).toFixed(1)
    : '0';

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Check-Seiten</h1>
          <p className="text-sm text-elvora-text-dim mt-1">
            SEO Lead-Magnet Seiten — Inbound Leads auf Autopilot
          </p>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5">
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Seiten aktiv</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-purple-light">{stats.length}</div>
        </div>
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Aufrufe gesamt</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-accent">{totals.views.toLocaleString('de-DE')}</div>
        </div>
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Checks durchgeführt</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-warning">{totals.submissions.toLocaleString('de-DE')}</div>
        </div>
        <div className="glass rounded-xl p-3 lg:p-4">
          <div className="text-[11px] text-elvora-text-dim mb-1">Conversion Rate</div>
          <div className="text-xl lg:text-2xl font-bold text-elvora-success">{conversionRate}%</div>
        </div>
      </div>

      {/* Pages Performance Table */}
      <div className="glass rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">Seiten-Performance</h2>
          <span className="text-[10px] text-elvora-text-dim">{stats.length} Seiten</span>
        </div>
        {loading ? (
          <div className="text-center py-8 text-elvora-text-dim text-sm">Lade...</div>
        ) : stats.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-elvora-text-dim text-sm mb-3">Noch keine Check-Seiten aufgerufen.</p>
            <p className="text-elvora-text-dim text-xs">
              Teile Links wie <code className="text-elvora-primary">/check/sanitaer/essen</code> um Inbound-Leads zu generieren.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-elvora-text-dim pb-2">Branche</th>
                  <th className="text-left text-xs text-elvora-text-dim pb-2">Stadt</th>
                  <th className="text-right text-xs text-elvora-text-dim pb-2">Aufrufe</th>
                  <th className="text-right text-xs text-elvora-text-dim pb-2">Checks</th>
                  <th className="text-right text-xs text-elvora-text-dim pb-2">Conversion</th>
                  <th className="text-right text-xs text-elvora-text-dim pb-2">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.sort((a, b) => b.submissions - a.submissions).map((s) => {
                  const conv = s.views > 0 ? ((s.submissions / s.views) * 100).toFixed(1) : '0';
                  return (
                    <tr key={`${s.branche_slug}-${s.stadt_slug}`} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 text-sm">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-elvora-purple/15 text-elvora-purple-light">
                          {s.branche}
                        </span>
                      </td>
                      <td className="py-2.5 text-sm text-elvora-text-muted">{s.stadt}</td>
                      <td className="py-2.5 text-sm text-white text-right font-medium">{s.views}</td>
                      <td className="py-2.5 text-sm text-elvora-success text-right font-medium">{s.submissions}</td>
                      <td className="py-2.5 text-sm text-right">
                        <span className={`font-medium ${Number(conv) > 5 ? 'text-elvora-success' : 'text-elvora-text-muted'}`}>
                          {conv}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <a
                          href={`/check/${s.branche_slug}/${s.stadt_slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-elvora-primary text-[11px] hover:underline"
                        >
                          Öffnen
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inbound Leads */}
      <div className="glass rounded-xl p-4 mb-5 border border-elvora-success/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 17l-4 4m0 0l-4-4m4 4V3" />
            </svg>
            <span className="text-sm font-semibold text-white">Inbound Leads</span>
            {totals.inboundLeads > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-elvora-success/20 text-elvora-success text-[10px] font-bold">
                {totals.inboundLeads}
              </span>
            )}
          </div>
          <Link href="/lead-pool?source=inbound" className="text-xs text-elvora-success hover:text-elvora-success/80 transition-colors">
            Alle anzeigen &rarr;
          </Link>
        </div>

        {inboundLeads.length === 0 ? (
          <p className="text-elvora-text-dim text-sm text-center py-4">
            Noch keine Inbound-Leads. Teile deine Check-Seiten um Leads zu generieren!
          </p>
        ) : (
          <div className="space-y-2">
            {inboundLeads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-3 rounded-lg bg-elvora-success/5 border border-elvora-success/10">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{lead.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-elvora-success/15 text-elvora-success">
                      INBOUND
                    </span>
                  </div>
                  <div className="text-xs text-elvora-text-dim flex items-center gap-2 mt-0.5">
                    <span>{lead.city}</span>
                    <span>Score: {lead.score}</span>
                    <span>{new Date(lead.created_at).toLocaleDateString('de-DE')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {lead.phone && (
                    <a href={`tel:${lead.phone}`} className="px-2.5 py-1 rounded-lg bg-elvora-success/15 border border-elvora-success/20 text-elvora-success text-[10px] font-semibold hover:bg-elvora-success/25 transition-all">
                      Anrufen
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="px-2.5 py-1 rounded-lg bg-elvora-primary/15 border border-elvora-primary/20 text-elvora-primary text-[10px] font-semibold hover:bg-elvora-primary/25 transition-all">
                      Mail
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white mb-3">Schnell-Links</h2>
        <p className="text-xs text-elvora-text-dim mb-3">
          Kopiere diese URLs und teile sie auf Social Media, Google Ads oder per E-Mail:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { branche: 'sanitaer', stadt: 'essen', label: 'Sanitär / Essen' },
            { branche: 'heizung', stadt: 'dortmund', label: 'Heizung / Dortmund' },
            { branche: 'klempner', stadt: 'bochum', label: 'Klempner / Bochum' },
            { branche: 'elektriker', stadt: 'duisburg', label: 'Elektriker / Duisburg' },
          ].map((link) => (
            <div key={`${link.branche}-${link.stadt}`} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
              <span className="text-xs text-elvora-text-muted">{link.label}</span>
              <a
                href={`/check/${link.branche}/${link.stadt}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-elvora-primary hover:underline"
              >
                /check/{link.branche}/{link.stadt}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
