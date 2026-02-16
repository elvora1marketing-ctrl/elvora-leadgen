'use client';

import { useState } from 'react';
import Link from 'next/link';

const stats = [
  { label: 'Zu prüfen', value: 47, sub: '+12 heute', color: 'text-elvora-warning' },
  { label: 'Qualifiziert', value: 23, sub: '+3 diese Woche', color: 'text-elvora-success' },
  { label: 'Mails geöffnet', value: '68%', sub: '15 von 22 geöffnet', color: 'text-elvora-pink' },
  { label: 'Pipeline', value: '18.4k', sub: '6 aktive Deals', color: 'text-elvora-accent' },
];

const recentScans = [
  { keyword: 'Sanitär', city: 'Essen', found: 14, newLeads: 8, time: '03:00' },
  { keyword: 'Heizung', city: 'Dortmund', found: 11, newLeads: 5, time: '03:02' },
  { keyword: 'Klempner', city: 'Bochum', found: 9, newLeads: 4, time: '03:04' },
  { keyword: 'SHK', city: 'Duisburg', found: 13, newLeads: 6, time: '03:06' },
];

export default function DashboardPage() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [processingFollowUps, setProcessingFollowUps] = useState(false);
  const [followUpResult, setFollowUpResult] = useState<string | null>(null);

  const triggerScan = async () => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/cron/scan', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setScanResult(`${data.totalScans} Scans durchgeführt`);
      } else {
        setScanResult('Scan fehlgeschlagen');
      }
    } catch {
      setScanResult('Netzwerkfehler');
    } finally {
      setScanning(false);
      setTimeout(() => setScanResult(null), 4000);
    }
  };

  const processFollowUps = async () => {
    setProcessingFollowUps(true);
    setFollowUpResult(null);
    try {
      const res = await fetch('/api/followups/process', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setFollowUpResult(`${data.sent} Follow-Ups gesendet`);
      } else {
        setFollowUpResult('Fehler');
      }
    } catch {
      setFollowUpResult('Netzwerkfehler');
    } finally {
      setProcessingFollowUps(false);
      setTimeout(() => setFollowUpResult(null), 4000);
    }
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-5 lg:mb-6">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-3 lg:p-4">
            <div className="text-[11px] lg:text-xs text-elvora-text-dim mb-1">{s.label}</div>
            <div className={`text-xl lg:text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] lg:text-xs text-elvora-text-dim mt-1">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Quick action */}
      <Link
        href="/review"
        className="block mb-5 lg:mb-6 glass rounded-xl p-4 hover:bg-white/[0.04] transition-all group"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elvora-gradient flex items-center justify-center flex-shrink-0">
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
          <svg className="w-5 h-5 text-elvora-text-dim group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>

      {/* Auto Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 lg:mb-6">
        <button
          onClick={triggerScan}
          disabled={scanning}
          className="glass rounded-xl p-4 hover:bg-white/[0.04] transition-all text-left group disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elvora-purple/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {scanning ? 'Scanne...' : scanResult || 'Jetzt scannen'}
              </div>
              <div className="text-xs text-elvora-text-dim">Neue Leads in allen Städten finden</div>
            </div>
          </div>
        </button>

        <button
          onClick={processFollowUps}
          disabled={processingFollowUps}
          className="glass rounded-xl p-4 hover:bg-white/[0.04] transition-all text-left group disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-elvora-pink/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-elvora-pink-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {processingFollowUps ? 'Verarbeite...' : followUpResult || 'Follow-Ups senden'}
              </div>
              <div className="text-xs text-elvora-text-dim">Fällige Nachfass-Mails verschicken</div>
            </div>
          </div>
        </button>
      </div>

      {/* Recent Scans */}
      <div className="glass rounded-xl p-4 lg:p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Letzte Scans</h2>
        <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs text-elvora-text-dim pb-2">Keyword</th>
                <th className="text-left text-xs text-elvora-text-dim pb-2">Stadt</th>
                <th className="text-left text-xs text-elvora-text-dim pb-2">Gefunden</th>
                <th className="text-left text-xs text-elvora-text-dim pb-2">Neu</th>
                <th className="text-left text-xs text-elvora-text-dim pb-2">Zeit</th>
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
    </div>
  );
}
