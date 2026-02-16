'use client';

import { useState } from 'react';

interface GmbIssue {
  label: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  description: string;
  recommendation: string;
}

interface GmbData {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviewCount: number;
  category: string;
  hours: string[];
  photoCount: number;
  url: string;
  issues: GmbIssue[];
  score: number;
}

const severityConfig = {
  critical: { label: 'Kritisch', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500' },
  major: { label: 'Wichtig', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500' },
  minor: { label: 'Verbesserung', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-500' },
  info: { label: 'Tipp', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' },
};

export default function GmbAuditPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<GmbData | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  async function handleAudit() {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch('/api/audit/gmb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Fehler beim Audit');
        return;
      }

      setData(result);
    } catch {
      setError('Netzwerkfehler – bitte erneut versuchen');
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!data) return;
    setGeneratingPdf(true);

    try {
      const pdfContent = generatePdfHtml(data);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        // Fallback: download as HTML
        const blob = new Blob([pdfContent], { type: 'text/html' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `GMB-Audit-${data.name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '-')}.html`;
        a.click();
        URL.revokeObjectURL(a.href);
        return;
      }

      printWindow.document.write(pdfContent);
      printWindow.document.close();

      // Wait for content to render, then trigger print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    } finally {
      setGeneratingPdf(false);
    }
  }

  function getScoreColor(score: number) {
    if (score >= 80) return 'text-elvora-success';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  }

  function getScoreGradient(score: number) {
    if (score >= 80) return 'from-green-500 to-emerald-500';
    if (score >= 60) return 'from-yellow-500 to-orange-400';
    if (score >= 40) return 'from-orange-500 to-red-400';
    return 'from-red-500 to-red-600';
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white mb-1">Google Business Audit</h1>
        <p className="text-sm text-elvora-text-dim">Google Maps Link einfügen und kostenlosen Audit-Report als PDF generieren.</p>
      </div>

      {/* Input Section */}
      <div className="glass rounded-xl p-5 mb-4">
        <label className="block text-xs text-elvora-text-dim mb-2">Google Maps / Business Profil Link</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAudit()}
            placeholder="https://share.google/... oder https://maps.google.com/..."
            className="flex-1 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all font-mono"
            disabled={loading}
          />
          <button
            onClick={handleAudit}
            disabled={loading || !url.trim()}
            className="px-5 py-2.5 rounded-xl bg-elvora-gradient text-white text-sm font-medium hover:shadow-elvora-lg transition-all disabled:opacity-50 flex-shrink-0"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Analysiere...
              </span>
            ) : 'Audit starten'}
          </button>
        </div>
        <p className="text-[11px] text-elvora-text-dim mt-2">
          Unterstützt: share.google Links, Google Maps URLs, maps.app.goo.gl Links
        </p>
        {error && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-4 animate-fade-in">
          {/* Score + Business Info Header */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-base font-bold text-white mb-1">{data.name || 'Unbekannter Betrieb'}</h2>
                {data.category && <p className="text-xs text-elvora-text-dim mb-1">{data.category}</p>}
                {data.address && <p className="text-xs text-elvora-text-muted">{data.address}</p>}
              </div>
              <div className="text-right ml-4">
                <div className={`text-3xl font-bold font-mono ${getScoreColor(data.score)}`}>{data.score}</div>
                <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider">von 100</div>
              </div>
            </div>

            {/* Score Bar */}
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${getScoreGradient(data.score)} transition-all duration-1000`}
                style={{ width: `${data.score}%` }}
              />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <div className="text-lg font-bold text-white">{data.rating || '–'}</div>
                <div className="text-[10px] text-elvora-text-dim">Sterne</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <div className="text-lg font-bold text-white">{data.reviewCount || '0'}</div>
                <div className="text-[10px] text-elvora-text-dim">Bewertungen</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <div className="text-lg font-bold text-white">{data.photoCount || '0'}</div>
                <div className="text-[10px] text-elvora-text-dim">Fotos</div>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <div className="text-lg font-bold text-white">{data.website ? '✓' : '✗'}</div>
                <div className="text-[10px] text-elvora-text-dim">Website</div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          {(data.phone || data.website) && (
            <div className="glass rounded-xl p-5">
              <div className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider mb-3">Kontaktdaten</div>
              <div className="space-y-2 text-sm">
                {data.phone && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span className="text-white font-mono">{data.phone}</span>
                  </div>
                )}
                {data.website && (
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    <span className="text-elvora-purple-light">{data.website}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Issues */}
          <div className="glass rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-semibold text-elvora-text-dim uppercase tracking-wider">Audit-Ergebnisse</div>
              <div className="flex gap-1.5">
                {(['critical', 'major', 'minor', 'info'] as const).map((sev) => {
                  const count = data.issues.filter((i) => i.severity === sev).length;
                  if (count === 0) return null;
                  return (
                    <span key={sev} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${severityConfig[sev].bg} ${severityConfig[sev].color}`}>
                      {count} {severityConfig[sev].label}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              {data.issues.map((issue, i) => {
                const config = severityConfig[issue.severity];
                return (
                  <div key={i} className={`rounded-lg border p-4 ${config.bg}`}>
                    <div className="flex items-start gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${config.dot}`} />
                      <div>
                        <div className={`text-sm font-semibold ${config.color}`}>{issue.label}</div>
                        <p className="text-xs text-elvora-text-muted mt-1">{issue.description}</p>
                      </div>
                    </div>
                    <div className="ml-4 mt-2 pl-3 border-l-2 border-white/10">
                      <div className="text-[10px] text-elvora-text-dim uppercase tracking-wider mb-0.5">Empfehlung</div>
                      <p className="text-xs text-white/80">{issue.recommendation}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDF Download Button */}
          <div className="flex gap-3">
            <button
              onClick={downloadPdf}
              disabled={generatingPdf}
              className="flex-1 px-5 py-3 rounded-xl bg-elvora-gradient text-white text-sm font-medium hover:shadow-elvora-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {generatingPdf ? 'Generiere...' : 'Als PDF herunterladen'}
            </button>
            <button
              onClick={() => { setData(null); setUrl(''); }}
              className="px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-elvora-text-muted text-sm font-medium hover:bg-white/10 transition-all"
            >
              Neuer Audit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function generatePdfHtml(data: GmbData): string {
  const criticalCount = data.issues.filter((i) => i.severity === 'critical').length;
  const majorCount = data.issues.filter((i) => i.severity === 'major').length;
  const minorCount = data.issues.filter((i) => i.severity === 'minor').length;
  const infoCount = data.issues.filter((i) => i.severity === 'info').length;

  const scoreColor = data.score >= 80 ? '#22c55e' : data.score >= 60 ? '#eab308' : data.score >= 40 ? '#f97316' : '#ef4444';

  const severityColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    critical: { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', dot: '#ef4444' },
    major: { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', dot: '#f97316' },
    minor: { bg: '#fefce8', border: '#fef08a', text: '#ca8a04', dot: '#eab308' },
    info: { bg: '#eff6ff', border: '#bfdbfe', text: '#2563eb', dot: '#3b82f6' },
  };

  const severityLabels: Record<string, string> = {
    critical: 'KRITISCH',
    major: 'WICHTIG',
    minor: 'VERBESSERUNG',
    info: 'TIPP',
  };

  const issuesHtml = data.issues.map((issue) => {
    const c = severityColors[issue.severity];
    return `
      <div style="border: 1px solid ${c.border}; background: ${c.bg}; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${c.dot};"></span>
          <span style="font-weight: 600; color: ${c.text}; font-size: 13px;">${issue.label}</span>
          <span style="font-size: 9px; padding: 2px 6px; border-radius: 4px; background: ${c.dot}22; color: ${c.text}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${severityLabels[issue.severity]}</span>
        </div>
        <p style="font-size: 12px; color: #374151; margin: 0 0 10px 16px; line-height: 1.5;">${issue.description}</p>
        <div style="margin-left: 16px; padding-left: 12px; border-left: 2px solid ${c.border};">
          <div style="font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;">Empfehlung</div>
          <p style="font-size: 12px; color: #111827; margin: 0; line-height: 1.5;">${issue.recommendation}</p>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>GMB Audit – ${data.name}</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-break { break-inside: avoid; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; color: #111827; background: white; }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #8B5CF6, #EC4899, #F97316); padding: 32px 40px; color: white;">
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
      <div style="width: 40px; height: 40px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 20px; font-weight: 700; background: linear-gradient(135deg, #8B5CF6, #EC4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">E</span>
      </div>
      <span style="font-size: 18px; font-weight: 700; letter-spacing: -0.5px;">ELVORA</span>
    </div>
    <h1 style="margin: 0; font-size: 24px; font-weight: 700;">Google Business Profil Audit</h1>
    <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px;">Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>

  <div style="padding: 32px 40px;">
    <!-- Business Info + Score -->
    <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px;">
      <div>
        <h2 style="margin: 0 0 4px; font-size: 20px; font-weight: 700;">${data.name || 'Unbekannt'}</h2>
        ${data.category ? `<p style="margin: 0 0 2px; font-size: 12px; color: #6b7280;">${data.category}</p>` : ''}
        ${data.address ? `<p style="margin: 0; font-size: 12px; color: #9ca3af;">${data.address}</p>` : ''}
      </div>
      <div style="text-align: center; flex-shrink: 0; margin-left: 24px;">
        <div style="font-size: 42px; font-weight: 800; color: ${scoreColor}; line-height: 1;">${data.score}</div>
        <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px;">von 100</div>
      </div>
    </div>

    <!-- Score Bar -->
    <div style="width: 100%; height: 8px; background: #f3f4f6; border-radius: 8px; overflow: hidden; margin-bottom: 24px;">
      <div style="width: ${data.score}%; height: 100%; background: ${scoreColor}; border-radius: 8px;"></div>
    </div>

    <!-- Quick Stats -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px;">
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #f3f4f6;">
        <div style="font-size: 22px; font-weight: 700;">${data.rating || '–'}</div>
        <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase;">Sterne</div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #f3f4f6;">
        <div style="font-size: 22px; font-weight: 700;">${data.reviewCount || '0'}</div>
        <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase;">Bewertungen</div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #f3f4f6;">
        <div style="font-size: 22px; font-weight: 700;">${data.photoCount || '0'}</div>
        <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase;">Fotos</div>
      </div>
      <div style="background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; border: 1px solid #f3f4f6;">
        <div style="font-size: 22px; font-weight: 700;">${data.website ? '✓' : '✗'}</div>
        <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase;">Website</div>
      </div>
    </div>

    <!-- Contact Info -->
    ${(data.phone || data.website) ? `
    <div style="margin-bottom: 32px; padding: 16px; background: #f9fafb; border-radius: 8px; border: 1px solid #f3f4f6;">
      <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 600;">Kontaktdaten</div>
      ${data.phone ? `<div style="font-size: 13px; margin-bottom: 4px;">Telefon: <strong>${data.phone}</strong></div>` : ''}
      ${data.website ? `<div style="font-size: 13px;">Website: <strong style="color: #8B5CF6;">${data.website}</strong></div>` : ''}
    </div>
    ` : ''}

    <!-- Summary -->
    <div style="margin-bottom: 24px; padding: 16px; background: #fafafa; border-radius: 8px; border: 1px solid #e5e7eb;">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Zusammenfassung</div>
      <div style="display: flex; gap: 12px; font-size: 12px;">
        ${criticalCount > 0 ? `<span style="color: #dc2626; font-weight: 600;">${criticalCount} Kritisch</span>` : ''}
        ${majorCount > 0 ? `<span style="color: #ea580c; font-weight: 600;">${majorCount} Wichtig</span>` : ''}
        ${minorCount > 0 ? `<span style="color: #ca8a04; font-weight: 600;">${minorCount} Verbesserungen</span>` : ''}
        ${infoCount > 0 ? `<span style="color: #2563eb; font-weight: 600;">${infoCount} Tipps</span>` : ''}
      </div>
    </div>

    <!-- Issues -->
    <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 16px;">Detaillierte Analyse</h3>
    ${issuesHtml}

    <!-- Footer -->
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="font-size: 11px; color: #9ca3af; margin: 0;">
        Erstellt von <strong style="color: #8B5CF6;">Elvora</strong> – Ihr Partner für digitale Sichtbarkeit im Handwerk
      </p>
      <p style="font-size: 11px; color: #d1d5db; margin: 4px 0 0;">
        Dieser Report basiert auf öffentlich zugänglichen Google Business Profil-Daten.
      </p>
    </div>
  </div>
</body>
</html>`;
}
