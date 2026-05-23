'use client';

import { useState, useMemo, useEffect } from 'react';

const AGENCY_NAME = 'Elvora';
const INVESTMENT = 3000;

const BRANCHEN = [
  'Handwerk',
  'Gastronomie',
  'Arzt/Praxis',
  'Immobilien',
  'Dienstleistung',
  'E-Commerce',
  'Sonstiges',
] as const;

function formatEUR(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

// Animated counter hook
function useAnimatedValue(target: number, duration = 600): number {
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    const start = current;
    const diff = target - start;
    if (diff === 0) return;

    const startTime = performance.now();
    let raf: number;

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + diff * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    }

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return current;
}

// Progress bar with animation
function ProgressBar({
  value,
  max,
  color = 'purple',
  label,
  displayValue,
}: {
  value: number;
  max: number;
  color?: 'purple' | 'green' | 'gray';
  label: string;
  displayValue: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  const colorMap = {
    purple: 'bg-elvora-gradient',
    green: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
    gray: 'bg-elvora-border-light',
  };

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-elvora-text-muted">{label}</span>
        <span className="font-semibold text-elvora-text">{displayValue}</span>
      </div>
      <div className="h-3 rounded-full bg-elvora-bg-alt overflow-hidden">
        <div
          className={`h-full rounded-full ${colorMap[color]} transition-all duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// Slider + number input combo
function SliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit,
  formatFn,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  formatFn?: (v: number) => string;
}) {
  const displayVal = formatFn ? formatFn(value) : `${value}`;
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-elvora-text">{label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
            }}
            min={min}
            max={max}
            step={step}
            className="w-24 px-2.5 py-1.5 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm text-right focus:outline-none focus:border-elvora-purple/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          {unit && <span className="text-xs text-elvora-text-dim min-w-[24px]">{unit}</span>}
        </div>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-elvora-bg-alt
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-elvora-purple
            [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(139,92,246,0.5)] [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-elvora-purple-light
            [&::-webkit-slider-thumb]:transition-shadow [&::-webkit-slider-thumb]:hover:shadow-[0_0_16px_rgba(139,92,246,0.7)]
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-elvora-purple [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-elvora-purple-light
            [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-[0_0_10px_rgba(139,92,246,0.5)]"
          style={{
            background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${pct}%, #1e2430 ${pct}%, #1e2430 100%)`,
          }}
        />
      </div>
    </div>
  );
}

export default function RoiRechnerPage() {
  const [branche, setBranche] = useState<string>('Handwerk');
  const [visitors, setVisitors] = useState(500);
  const [conversionRate, setConversionRate] = useState(1.5);
  const [avgOrderValue, setAvgOrderValue] = useState(1500);
  const [googlePosition, setGooglePosition] = useState(25);

  const results = useMemo(() => {
    const closeRate = 0.3;
    const currentInquiries = visitors * (conversionRate / 100);
    const currentRevenue = currentInquiries * closeRate * avgOrderValue;

    const visitorMultiplier = googlePosition > 10 ? 3 : 1.5;
    const newVisitors = Math.round(visitors * visitorMultiplier);
    const newConversionRate = Math.min(conversionRate * 2, 8);
    const newInquiries = newVisitors * (newConversionRate / 100);
    const newRevenue = newInquiries * closeRate * avgOrderValue;

    const additionalMonthly = newRevenue - currentRevenue;
    const additionalYearly = additionalMonthly * 12;
    const roiPercent = (additionalYearly / INVESTMENT) * 100;
    const amortizationMonths = additionalMonthly > 0 ? Math.ceil(INVESTMENT / additionalMonthly) : Infinity;

    return {
      currentInquiries,
      currentRevenue,
      newVisitors,
      newConversionRate,
      newInquiries,
      newRevenue,
      additionalMonthly,
      additionalYearly,
      roiPercent,
      amortizationMonths,
    };
  }, [visitors, conversionRate, avgOrderValue, googlePosition]);

  // Animated values
  const animCurrentRevenue = useAnimatedValue(Math.round(results.currentRevenue));
  const animNewRevenue = useAnimatedValue(Math.round(results.newRevenue));
  const animAdditionalYearly = useAnimatedValue(Math.round(results.additionalYearly));
  const animRoi = useAnimatedValue(Math.round(results.roiPercent));

  // Max for progress bars
  const maxRevenue = Math.max(results.newRevenue, results.currentRevenue, 1);

  return (
    <div className="min-h-screen pb-20">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-elvora-purple/8 via-transparent to-transparent" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-elvora-purple/5 rounded-full blur-[120px]" />
        <div className="relative max-w-5xl mx-auto px-4 pt-12 pb-8 sm:pt-16 sm:pb-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-elvora-purple/10 border border-elvora-purple/20 text-elvora-purple-light text-xs font-medium">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Kostenlose Analyse
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-elvora-text tracking-tight">
              Was kostet Sie Ihre
              <span className="bg-elvora-gradient bg-clip-text text-transparent"> aktuelle Website</span>?
            </h1>
            <p className="text-elvora-text-muted text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Berechnen Sie in 30 Sekunden, wie viel Umsatz Ihnen durch eine nicht-optimierte
              Website entgeht -- und was eine Optimierung bringen kann.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: Inputs */}
          <div className="lg:col-span-2 space-y-4">
            <div className="card rounded-xl p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-elvora-purple/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-elvora-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-elvora-text">Ihre Daten</h2>
              </div>

              {/* Branche dropdown */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-elvora-text">Branche</label>
                <select
                  value={branche}
                  onChange={(e) => setBranche(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-purple/50 transition-colors cursor-pointer appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                  }}
                >
                  {BRANCHEN.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <SliderInput
                label="Monatliche Website-Besucher"
                value={visitors}
                onChange={setVisitors}
                min={100}
                max={10000}
                step={50}
              />

              <SliderInput
                label="Aktuelle Conversion-Rate"
                value={conversionRate}
                onChange={setConversionRate}
                min={0.5}
                max={10}
                step={0.1}
                unit="%"
              />

              <SliderInput
                label="Durchschn. Auftragswert"
                value={avgOrderValue}
                onChange={setAvgOrderValue}
                min={100}
                max={10000}
                step={50}
                unit="EUR"
              />

              <SliderInput
                label="Google-Position Hauptkeyword"
                value={googlePosition}
                onChange={setGooglePosition}
                min={1}
                max={100}
                step={1}
              />
            </div>

            {/* Info card */}
            <div className="card rounded-xl p-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-elvora-text">Wie berechnen wir das?</p>
                  <p className="text-xs text-elvora-text-dim leading-relaxed">
                    Wir rechnen mit einer Abschlussquote von 30% und einer realistischen SEO-Optimierung
                    (3x mehr Besucher bei Position {'>'}10, 1.5x bei Position {'<'}10).
                    Die Conversion-Rate verdoppelt sich durch optimiertes Webdesign (max. 8%).
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Results */}
          <div className="lg:col-span-3 space-y-4">
            {/* Before / After comparison */}
            <div className="card rounded-xl p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-elvora-text">Vorher / Nachher Vergleich</h2>
              </div>

              {/* Current state */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-elvora-text-dim" />
                  <span className="text-xs font-medium text-elvora-text-muted uppercase tracking-wider">Aktuell</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-elvora-bg p-3 border border-elvora-border">
                    <p className="text-xs text-elvora-text-dim">Monatl. Anfragen</p>
                    <p className="text-xl font-bold text-elvora-text mt-0.5">
                      {formatNumber(results.currentInquiries)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-elvora-bg p-3 border border-elvora-border">
                    <p className="text-xs text-elvora-text-dim">Monatl. Umsatz</p>
                    <p className="text-xl font-bold text-elvora-text mt-0.5">
                      {formatEUR(animCurrentRevenue)}
                    </p>
                  </div>
                </div>
                <ProgressBar
                  value={results.currentRevenue}
                  max={maxRevenue}
                  color="gray"
                  label="Aktueller Umsatz"
                  displayValue={formatEUR(animCurrentRevenue)}
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-elvora-border" />
                </div>
                <div className="relative flex justify-center">
                  <div className="bg-elvora-card px-3 py-1 rounded-full border border-elvora-border">
                    <svg className="w-4 h-4 text-elvora-purple" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* After optimization */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Nach Optimierung</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/20">
                    <p className="text-xs text-elvora-text-dim">Neue Besucher</p>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {formatNumber(results.newVisitors)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/20">
                    <p className="text-xs text-elvora-text-dim">Neue Conv.-Rate</p>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {formatPercent(results.newConversionRate)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-emerald-500/5 p-3 border border-emerald-500/20">
                    <p className="text-xs text-elvora-text-dim">Neue Anfragen</p>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {formatNumber(results.newInquiries)}
                    </p>
                  </div>
                </div>
                <ProgressBar
                  value={results.newRevenue}
                  max={maxRevenue}
                  color="green"
                  label="Neuer Umsatz"
                  displayValue={formatEUR(animNewRevenue)}
                />
              </div>
            </div>

            {/* ROI Highlights */}
            <div className="grid grid-cols-2 gap-4">
              {/* Additional yearly revenue - big green number */}
              <div className="card rounded-xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-[60px]" />
                <div className="relative">
                  <p className="text-xs text-elvora-text-dim font-medium uppercase tracking-wider">
                    Zusatzumsatz / Jahr
                  </p>
                  <p className="text-2xl sm:text-3xl font-bold text-emerald-400 mt-2 tracking-tight">
                    +{formatEUR(animAdditionalYearly)}
                  </p>
                  <p className="text-xs text-elvora-text-dim mt-1.5">
                    +{formatEUR(Math.round(results.additionalMonthly))} / Monat
                  </p>
                </div>
              </div>

              {/* ROI circle */}
              <div className="card rounded-xl p-5 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-elvora-purple/5 to-transparent" />
                <div className="relative flex flex-col items-center">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-elvora-purple/30 flex items-center justify-center relative">
                    <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle
                        cx="50" cy="50" r="46"
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(results.roiPercent / 30, 1) * 289} 289`}
                        className="transition-all duration-700 ease-out"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.4))' }}
                      />
                    </svg>
                    <div className="text-center">
                      <span className="text-xl sm:text-2xl font-bold text-elvora-purple-light">
                        {formatNumber(animRoi)}%
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-elvora-text-dim font-medium uppercase tracking-wider mt-2.5">
                    ROI
                  </p>
                </div>
              </div>
            </div>

            {/* Amortization badge */}
            <div className="card rounded-xl p-5 relative overflow-hidden">
              <div className="absolute inset-0 bg-elvora-gradient opacity-[0.04]" />
              <div className="relative flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-elvora-text">Amortisation der Investition</p>
                  <p className="text-xs text-elvora-text-dim">
                    Bei einer Investition von {formatEUR(INVESTMENT)} in Website & SEO
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {results.amortizationMonths <= 12 ? (
                    <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-lg font-bold text-emerald-400">
                            {results.amortizationMonths} {results.amortizationMonths === 1 ? 'Monat' : 'Monate'}
                          </p>
                          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider">Amortisation</p>
                        </div>
                      </div>
                    </div>
                  ) : results.amortizationMonths <= 24 ? (
                    <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-lg font-bold text-amber-400">
                            {results.amortizationMonths} Monate
                          </p>
                          <p className="text-[10px] text-amber-400/70 uppercase tracking-wider">Amortisation</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-lg font-bold text-red-400">
                            {results.amortizationMonths === Infinity ? '--' : `${results.amortizationMonths}`} Monate
                          </p>
                          <p className="text-[10px] text-red-400/70 uppercase tracking-wider">Amortisation</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {results.amortizationMonths <= 12 && (
                <p className="relative text-xs text-emerald-400/80 mt-3 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Ihre Investition amortisiert sich in nur {results.amortizationMonths} {results.amortizationMonths === 1 ? 'Monat' : 'Monaten'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 relative">
          <div className="absolute inset-0 bg-elvora-gradient opacity-[0.03] rounded-2xl" />
          <div className="card rounded-2xl p-8 sm:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-elvora-purple/5 rounded-full blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/5 rounded-full blur-[80px]" />
            <div className="relative text-center space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl sm:text-3xl font-bold text-elvora-text">
                  Bereit,{' '}
                  <span className="bg-elvora-gradient bg-clip-text text-transparent">
                    mehr Umsatz
                  </span>{' '}
                  zu generieren?
                </h2>
                <p className="text-elvora-text-muted text-sm sm:text-base max-w-lg mx-auto">
                  Lassen Sie uns in einem kostenlosen Erstgespraech besprechen, wie wir diese
                  Ergebnisse fuer Ihr Unternehmen erreichen koennen.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="mailto:kontakt@elvora.de"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-elvora-gradient text-white font-medium text-sm hover:shadow-elvora-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Kostenloses Erstgespraech vereinbaren
                </a>
                <a
                  href="mailto:kontakt@elvora.de?subject=Individuelle%20Website-Analyse&body=Hallo%2C%0A%0Aich%20interessiere%20mich%20f%C3%BCr%20eine%20individuelle%20Analyse%20meiner%20Website.%0A%0ABranche%3A%20%0AWebsite%3A%20%0A%0AMit%20freundlichen%20Gr%C3%BC%C3%9Fen"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-elvora-bg-alt border border-elvora-border text-elvora-text font-medium text-sm hover:border-elvora-purple/30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Ihre individuelle Analyse anfordern
                </a>
              </div>
              <p className="text-xs text-elvora-text-dim">
                Powered by {AGENCY_NAME}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
