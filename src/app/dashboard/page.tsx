'use client';

import Link from 'next/link';

const stats = [
  { label: 'Zu prüfen', value: 47, sub: '+12 heute', color: 'text-elvora-warning' },
  { label: 'Qualifiziert', value: 23, sub: '+3 diese Woche', color: 'text-elvora-success' },
  { label: 'Konvertierung', value: '34%', sub: '+2.1% vs. Vorwoche', color: 'text-elvora-pink' },
  { label: 'Pipeline', value: '18.4k', sub: '6 aktive Deals', color: 'text-elvora-accent' },
];

const recentScans = [
  { keyword: 'Sanitär', city: 'Essen', found: 14, newLeads: 8, time: '03:00' },
  { keyword: 'Heizung', city: 'Dortmund', found: 11, newLeads: 5, time: '03:02' },
  { keyword: 'Klempner', city: 'Bochum', found: 9, newLeads: 4, time: '03:04' },
  { keyword: 'SHK', city: 'Duisburg', found: 13, newLeads: 6, time: '03:06' },
];

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <div className="text-xs text-elvora-text-dim mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-elvora-text-dim mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick action */}
      <Link
        href="/review"
        className="block mb-6 glass rounded-xl p-4 hover:bg-white/[0.04] transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elvora-gradient flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white group-hover:text-elvora-purple-light transition-colors">
                12 neue Leads prüfen
              </div>
              <div className="text-xs text-elvora-text-dim">8 davon mit Score &gt; 85</div>
            </div>
          </div>
          <svg className="w-5 h-5 text-elvora-text-dim group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* Recent Scans */}
      <div className="glass rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Letzte Scans</h2>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-xs text-elvora-text-dim pb-2">Keyword</th>
              <th className="text-left text-xs text-elvora-text-dim pb-2">Stadt</th>
              <th className="text-left text-xs text-elvora-text-dim pb-2">Gefunden</th>
              <th className="text-left text-xs text-elvora-text-dim pb-2">Neu</th>
              <th className="text-left text-xs text-elvora-text-dim pb-2">Uhrzeit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {recentScans.map((scan, i) => (
              <tr key={i}>
                <td className="py-2.5 text-sm"><span className="tag">{scan.keyword}</span></td>
                <td className="py-2.5 text-sm text-elvora-text-muted">{scan.city}</td>
                <td className="py-2.5 text-sm text-white font-medium">{scan.found}</td>
                <td className="py-2.5 text-sm text-elvora-success font-medium">+{scan.newLeads}</td>
                <td className="py-2.5 text-xs text-elvora-text-dim font-mono">{scan.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
