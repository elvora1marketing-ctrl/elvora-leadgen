'use client';

const stats = [
  { label: 'Pending Review', value: 47, change: '+12 today', color: 'text-elvora-warning', bg: 'bg-elvora-warning/10', icon: '~' },
  { label: 'Qualified', value: 23, change: '+3 this week', color: 'text-elvora-success', bg: 'bg-elvora-success/10', icon: '+' },
  { label: 'Conversion Rate', value: '34%', change: '+2.1% vs last week', color: 'text-elvora-pink', bg: 'bg-elvora-pink/10', icon: '%' },
  { label: 'Pipeline Value', value: '18.4k', change: '6 active deals', color: 'text-elvora-accent', bg: 'bg-elvora-accent/10', icon: '$' },
];

const scoreDistribution = [
  { range: '90-100', count: 8, pct: 17 },
  { range: '80-89', count: 14, pct: 30 },
  { range: '70-79', count: 11, pct: 23 },
  { range: '60-69', count: 7, pct: 15 },
  { range: '50-59', count: 4, pct: 9 },
  { range: '0-49', count: 3, pct: 6 },
];

const topCities = [
  { city: 'Essen', count: 18, pct: 38 },
  { city: 'Dortmund', count: 12, pct: 26 },
  { city: 'Bochum', count: 9, pct: 19 },
  { city: 'Duisburg', count: 8, pct: 17 },
];

const recentScans = [
  { keyword: 'Sanitär', city: 'Essen', found: 14, newLeads: 8, date: '2026-02-15 03:00' },
  { keyword: 'Heizung', city: 'Dortmund', found: 11, newLeads: 5, date: '2026-02-15 03:02' },
  { keyword: 'Klempner', city: 'Bochum', found: 9, newLeads: 4, date: '2026-02-15 03:04' },
  { keyword: 'SHK', city: 'Duisburg', found: 13, newLeads: 6, date: '2026-02-15 03:06' },
];

const nextActions = [
  { label: 'Review 12 hot leads (score > 85)', priority: 'high' },
  { label: 'Follow up with Meier Haustechnik (proposal sent)', priority: 'medium' },
  { label: 'Call back Schuster & Sohn tomorrow at 10:00', priority: 'medium' },
  { label: 'Archive 5 rejected leads older than 30 days', priority: 'low' },
];

export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-elvora-text-muted text-sm mt-1">Lead generation overview for NRW region</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass rounded-2xl p-5 card-hover"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-elvora-text-dim uppercase tracking-wider">
                {stat.label}
              </span>
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <span className={`text-sm font-bold ${stat.color}`}>{stat.icon}</span>
              </div>
            </div>
            <div className={`text-3xl font-bold ${stat.color}`}>
              {typeof stat.value === 'number' && stat.label === 'Pipeline Value' ? `${stat.value}` : stat.value}
              {stat.label === 'Pipeline Value' && <span className="text-lg ml-0.5">EUR</span>}
            </div>
            <p className="text-xs text-elvora-text-dim mt-1">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Score Distribution */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Score Distribution</h2>
          <div className="space-y-3">
            {scoreDistribution.map((item) => (
              <div key={item.range} className="flex items-center gap-3">
                <span className="text-xs text-elvora-text-dim w-14 text-right font-mono">
                  {item.range}
                </span>
                <div className="flex-1 h-6 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-elvora-gradient transition-all duration-500"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <span className="text-xs text-elvora-text-muted w-8 font-mono">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Cities */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Top Cities</h2>
          <div className="space-y-4">
            {topCities.map((item) => (
              <div key={item.city}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-elvora-text-muted">{item.city}</span>
                  <span className="text-sm font-medium text-white">{item.count} leads</span>
                </div>
                <div className="h-3 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.pct}%`,
                      background: `linear-gradient(90deg, #8B5CF6, #EC4899)`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Scans */}
        <div className="glass rounded-2xl p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white mb-4">Recent Scans</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-elvora-text-dim font-medium pb-3 pr-4">Keyword</th>
                  <th className="text-left text-xs text-elvora-text-dim font-medium pb-3 pr-4">City</th>
                  <th className="text-left text-xs text-elvora-text-dim font-medium pb-3 pr-4">Found</th>
                  <th className="text-left text-xs text-elvora-text-dim font-medium pb-3 pr-4">New</th>
                  <th className="text-left text-xs text-elvora-text-dim font-medium pb-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recentScans.map((scan, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 pr-4">
                      <span className="tag">{scan.keyword}</span>
                    </td>
                    <td className="py-3 pr-4 text-sm text-elvora-text-muted">{scan.city}</td>
                    <td className="py-3 pr-4 text-sm text-white font-medium">{scan.found}</td>
                    <td className="py-3 pr-4">
                      <span className="text-sm text-elvora-success font-medium">+{scan.newLeads}</span>
                    </td>
                    <td className="py-3 text-xs text-elvora-text-dim font-mono">{scan.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Next Actions + OpenClaw Status */}
        <div className="space-y-6">
          {/* Next Actions */}
          <div className="glass rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-white mb-4">Next Actions</h2>
            <div className="space-y-3">
              {nextActions.map((action, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      action.priority === 'high'
                        ? 'bg-elvora-danger'
                        : action.priority === 'medium'
                        ? 'bg-elvora-warning'
                        : 'bg-elvora-text-dim'
                    }`}
                  />
                  <p className="text-sm text-elvora-text-muted leading-relaxed">{action.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* OpenClaw Status Card */}
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-elvora-success pulse-dot" />
              <h2 className="text-sm font-semibold text-white">OpenClaw Scanner</h2>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">Status</span>
                <span className="text-elvora-success font-medium">Active</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">Schedule</span>
                <span className="text-elvora-text-muted">Daily 03:00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">Cities</span>
                <span className="text-elvora-text-muted">4 active</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">Keywords</span>
                <span className="text-elvora-text-muted">4 active</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-elvora-text-dim">Total Scans</span>
                <span className="text-elvora-text-muted font-mono">142</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
