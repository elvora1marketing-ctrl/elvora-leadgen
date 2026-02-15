'use client';

import { useState, useEffect, KeyboardEvent } from 'react';

export default function SettingsPage() {
  const [cities, setCities] = useState<string[]>(['Essen', 'Dortmund', 'Bochum', 'Duisburg']);
  const [cityInput, setCityInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['Sanitär', 'Heizung', 'Klempner', 'SHK']);
  const [keywordInput, setKeywordInput] = useState('');
  const [scoreThreshold, setScoreThreshold] = useState(85);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Email settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('https://calendly.com/elvora-meeting/30min');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Load settings from DB
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.target_cities) setCities(JSON.parse(data.target_cities));
        if (data.keywords) setKeywords(JSON.parse(data.keywords));
        if (data.score_threshold) setScoreThreshold(parseInt(data.score_threshold));
        if (data.smtp_host) setSmtpHost(data.smtp_host);
        if (data.smtp_port) setSmtpPort(data.smtp_port);
        if (data.smtp_user) setSmtpUser(data.smtp_user);
        if (data.smtp_pass) setSmtpPass(data.smtp_pass);
        if (data.smtp_from_name) setSmtpFromName(data.smtp_from_name);
        if (data.smtp_from_email) setSmtpFromEmail(data.smtp_from_email);
        if (data.calendly_url) setCalendlyUrl(data.calendly_url);
      })
      .catch(() => {});
  }, []);

  function addCity(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && cityInput.trim()) {
      e.preventDefault();
      if (!cities.includes(cityInput.trim())) setCities([...cities, cityInput.trim()]);
      setCityInput('');
    }
  }

  function addKeyword(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      if (!keywords.includes(keywordInput.trim())) setKeywords([...keywords, keywordInput.trim()]);
      setKeywordInput('');
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_cities: JSON.stringify(cities),
          keywords: JSON.stringify(keywords),
          score_threshold: scoreThreshold.toString(),
          smtp_host: smtpHost,
          smtp_port: smtpPort,
          smtp_user: smtpUser,
          smtp_pass: smtpPass,
          smtp_from_name: smtpFromName,
          smtp_from_email: smtpFromEmail,
          calendly_url: calendlyUrl,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // silent fail
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!testEmailTo) return;
    setTestSending(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_name: 'Test Firma GmbH',
          lead_email: testEmailTo,
          ansprechpartner: 'Herr Test',
          website: 'www.test-firma.de',
          city: 'Essen',
          score: 87,
          problems: [
            { label: 'Kein SSL-Zertifikat', severity: 'critical' },
            { label: 'Nicht mobilfähig', severity: 'major' },
          ],
          seo_issues: [
            { label: 'Meta-Beschreibungen fehlen', impact: 'high' },
          ],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestResult({ ok: true, message: `Test-Mail an ${testEmailTo} gesendet!` });
      } else {
        setTestResult({ ok: false, message: data.error || 'Fehler' });
      }
    } catch {
      setTestResult({ ok: false, message: 'Netzwerkfehler' });
    } finally {
      setTestSending(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-white">Einstellungen</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            saved
              ? 'bg-elvora-success/20 text-elvora-success border border-elvora-success/30'
              : 'bg-elvora-gradient text-white hover:shadow-elvora-lg disabled:opacity-50'
          }`}
        >
          {saved ? 'Gespeichert!' : saving ? 'Speichere...' : 'Speichern'}
        </button>
      </div>

      <div className="space-y-4">
        {/* Cities */}
        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-3">Zielstädte</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {cities.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-elvora-purple/10 text-elvora-purple-light text-sm border border-elvora-purple/20">
                {c}
                <button onClick={() => setCities(cities.filter((x) => x !== c))} className="text-elvora-purple-light/50 hover:text-elvora-danger">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={addCity}
            placeholder="Stadt eingeben + Enter"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all"
          />
        </div>

        {/* Keywords */}
        <div className="glass rounded-xl p-5">
          <div className="text-sm font-semibold text-white mb-3">Suchbegriffe</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-elvora-pink/10 text-elvora-pink-light text-sm border border-elvora-pink/20">
                {k}
                <button onClick={() => setKeywords(keywords.filter((x) => x !== k))} className="text-elvora-pink-light/50 hover:text-elvora-danger">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={addKeyword}
            placeholder="Keyword eingeben + Enter"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all"
          />
        </div>

        {/* Score Threshold */}
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">Score-Schwelle</span>
            <span className="text-lg font-bold text-elvora-purple-light font-mono">{scoreThreshold}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={scoreThreshold}
            onChange={(e) => setScoreThreshold(parseInt(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-elvora-gradient
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-white/20
            "
          />
          <div className="flex justify-between text-xs text-elvora-text-dim mt-1">
            <span>Alle</span>
            <span>Nur perfekte</span>
          </div>
        </div>

        {/* E-Mail Konfiguration */}
        <div className="glass rounded-xl p-5 border border-elvora-pink/20">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-pink-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-white">E-Mail Konfiguration</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            SMTP-Zugangsdaten für den automatischen Pitch-Mailversand. Funktioniert mit Gmail, Outlook, oder jedem SMTP-Anbieter.
          </p>

          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">SMTP Port</label>
                <input
                  type="text"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">SMTP Benutzer</label>
                <input
                  type="text"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  placeholder="dein@email.com"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">SMTP Passwort</label>
                <input
                  type="password"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="App-Passwort"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Absendername</label>
                <input
                  type="text"
                  value={smtpFromName}
                  onChange={(e) => setSmtpFromName(e.target.value)}
                  placeholder="Max von Elvora"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Absender E-Mail</label>
                <input
                  type="email"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  placeholder="max@elvora.de"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Calendly URL (optional)</label>
              <input
                type="url"
                value={calendlyUrl}
                onChange={(e) => setCalendlyUrl(e.target.value)}
                placeholder="https://calendly.com/dein-name/15min"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
              />
              <p className="text-[11px] text-elvora-text-dim mt-1">Wird als "Termin vereinbaren" Button in der Pitch-Mail angezeigt</p>
            </div>

            {/* Test E-Mail */}
            <div className="pt-3 mt-3 border-t border-white/5">
              <label className="block text-xs text-elvora-text-dim mb-1">Test-Mail senden</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="test@deine-email.de"
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
                <button
                  onClick={sendTestEmail}
                  disabled={testSending || !testEmailTo || !smtpHost}
                  className="px-4 py-2 rounded-lg bg-elvora-pink/15 border border-elvora-pink/30 text-elvora-pink-light text-xs font-semibold hover:bg-elvora-pink/25 transition-all disabled:opacity-50 flex-shrink-0"
                >
                  {testSending ? 'Sende...' : 'Testen'}
                </button>
              </div>
              {testResult && (
                <div className={`mt-2 text-xs font-medium ${testResult.ok ? 'text-elvora-success' : 'text-elvora-danger'}`}>
                  {testResult.message}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass rounded-xl p-5 border-elvora-danger/20">
          <div className="text-sm font-semibold text-elvora-danger mb-3">Gefahrenzone</div>
          <div className="flex gap-3">
            <button className="px-3 py-2 rounded-lg bg-elvora-danger/10 border border-elvora-danger/20 text-elvora-danger text-xs font-medium hover:bg-elvora-danger/20 transition-all">
              Alle Leads löschen
            </button>
            <button className="px-3 py-2 rounded-lg bg-elvora-danger/10 border border-elvora-danger/20 text-elvora-danger text-xs font-medium hover:bg-elvora-danger/20 transition-all">
              Datenbank zurücksetzen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
