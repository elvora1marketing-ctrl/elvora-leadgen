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

  // Email settings (Resend)
  const [resendApiKey, setResendApiKey] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('https://calendly.com/elvora-meeting/30min');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Google Maps API
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');

  // API / OpenClaw settings
  const [apiKey, setApiKey] = useState('');
  const [openclawUrl, setOpenclawUrl] = useState('');

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwChanging, setPwChanging] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Template settings
  const [tplSubject, setTplSubject] = useState('Website-Analyse für {firmenname} – {score}/100 Punkte');
  const [tplIntro, setTplIntro] = useState('mein Name ist {absender} von Elvora. Wir helfen Betrieben in der Region dabei, online sichtbar zu werden und automatisch Kundenanfragen zu generieren.');
  const [tplPitch, setTplPitch] = useState('Ich habe mir Ihre Website {website} angeschaut und dabei ein paar Punkte gefunden, die Sie vermutlich Kunden kosten:');
  const [tplLeistungen, setTplLeistungen] = useState('Moderne, mobiloptimierte Website\nGoogle-Optimierung für {stadt}\nSSL-Zertifikat & Sicherheits-Setup\nGoogle Business Profil optimieren\nAutomatische Kundenanfragen generieren');
  const [tplCta, setTplCta] = useState('Lassen Sie uns kurz sprechen – 15 Minuten, die sich lohnen.');

  // Load settings from DB
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.target_cities) setCities(JSON.parse(data.target_cities));
        if (data.keywords) setKeywords(JSON.parse(data.keywords));
        if (data.score_threshold) setScoreThreshold(parseInt(data.score_threshold));
        if (data.resend_api_key) setResendApiKey(data.resend_api_key);
        if (data.email_from_name) setEmailFromName(data.email_from_name);
        if (data.email_from_email) setEmailFromEmail(data.email_from_email);
        if (data.calendly_url) setCalendlyUrl(data.calendly_url);
        if (data.tpl_subject) setTplSubject(data.tpl_subject);
        if (data.tpl_intro) setTplIntro(data.tpl_intro);
        if (data.tpl_pitch) setTplPitch(data.tpl_pitch);
        if (data.tpl_leistungen) setTplLeistungen(data.tpl_leistungen);
        if (data.tpl_cta) setTplCta(data.tpl_cta);
        if (data.google_maps_api_key) setGoogleMapsApiKey(data.google_maps_api_key);
        if (data.api_key) setApiKey(data.api_key);
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
          resend_api_key: resendApiKey,
          email_from_name: emailFromName,
          email_from_email: emailFromEmail,
          calendly_url: calendlyUrl,
          tpl_subject: tplSubject,
          tpl_intro: tplIntro,
          tpl_pitch: tplPitch,
          tpl_leistungen: tplLeistungen,
          tpl_cta: tplCta,
          google_maps_api_key: googleMapsApiKey,
          api_key: apiKey,
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

        {/* Google Maps API */}
        <div className="glass rounded-xl p-5 border border-blue-500/20">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold text-white">Google Maps Scraper</span>
            <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 text-[10px] font-bold border border-blue-500/20">PLACES API</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            Der Scraper nutzt die Google Places API. Du brauchst einen API-Key mit aktivierter &quot;Places API (New)&quot;.
          </p>

          <div>
            <label className="block text-xs text-elvora-text-dim mb-1">Google Maps API-Key</label>
            <input
              type="password"
              value={googleMapsApiKey}
              onChange={(e) => setGoogleMapsApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-blue-500/50 transition-all font-mono"
            />
            <p className="text-[11px] text-elvora-text-dim mt-2">
              1. Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials<br />
              2. &quot;Places API (New)&quot; aktivieren<br />
              3. API-Key erstellen und hier einfügen
            </p>
          </div>
        </div>

        {/* E-Mail Konfiguration (Resend) */}
        <div className="glass rounded-xl p-5 border border-elvora-pink/20">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-pink-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-white">E-Mail Konfiguration</span>
            <span className="px-2 py-0.5 rounded-full bg-elvora-success/15 text-elvora-success text-[10px] font-bold border border-elvora-success/20">RESEND</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            E-Mail-Versand über Resend.com – 100 Mails/Tag kostenlos. Hol dir deinen API-Key auf resend.com.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Resend API-Key</label>
              <input
                type="password"
                value={resendApiKey}
                onChange={(e) => setResendApiKey(e.target.value)}
                placeholder="re_xxxxxxxxx..."
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Absendername</label>
                <input
                  type="text"
                  value={emailFromName}
                  onChange={(e) => setEmailFromName(e.target.value)}
                  placeholder="Luan von Elvora"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Absender E-Mail</label>
                <input
                  type="email"
                  value={emailFromEmail}
                  onChange={(e) => setEmailFromEmail(e.target.value)}
                  placeholder="luan@elvora.me"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-pink/50 transition-all"
                />
                <p className="text-[11px] text-elvora-text-dim mt-1">Verifizierte Domain: elvora.me</p>
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
              <p className="text-[11px] text-elvora-text-dim mt-1">Wird als &quot;Termin vereinbaren&quot; Button in der Pitch-Mail angezeigt</p>
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
                  disabled={testSending || !testEmailTo || !resendApiKey}
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

        {/* E-Mail Template Editor */}
        <div className="glass rounded-xl p-5 border border-elvora-purple/20">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-sm font-semibold text-white">E-Mail Template</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            Passe den E-Mail-Text an. Platzhalter: <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{firmenname}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{ansprechpartner}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{website}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{stadt}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{score}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{absender}'}</code>
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Betreff</label>
              <input
                type="text"
                value={tplSubject}
                onChange={(e) => setTplSubject(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Intro-Text <span className="text-elvora-text-dim/50">(nach &quot;Guten Tag {'{ansprechpartner}'},...&quot;)</span></label>
              <textarea
                value={tplIntro}
                onChange={(e) => setTplIntro(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Pitch-Text <span className="text-elvora-text-dim/50">(Überleitung zu den Problemen)</span></label>
              <textarea
                value={tplPitch}
                onChange={(e) => setTplPitch(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Leistungen <span className="text-elvora-text-dim/50">(eine pro Zeile)</span></label>
              <textarea
                value={tplLeistungen}
                onChange={(e) => setTplLeistungen(e.target.value)}
                rows={5}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">CTA-Text <span className="text-elvora-text-dim/50">(Call to Action)</span></label>
              <input
                type="text"
                value={tplCta}
                onChange={(e) => setTplCta(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-all"
              />
            </div>
          </div>
        </div>

        {/* OpenClaw Integration */}
        <div className="glass rounded-xl p-5 border border-elvora-success/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🦞</span>
            <span className="text-sm font-semibold text-white">OpenClaw Integration</span>
            <span className="px-2 py-0.5 rounded-full bg-elvora-success/15 text-elvora-success text-[10px] font-bold border border-elvora-success/20">API</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            Verbinde Elvora mit OpenClaw für WhatsApp-Nachfass, automatische Lead-Qualifizierung und AI-gestütztes Gespräch mit Leads.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">API-Key (für externe Zugriffe)</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Einen sicheren Key eingeben..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-success/50 transition-all font-mono"
                />
                <button
                  onClick={() => setApiKey(crypto.randomUUID())}
                  className="px-3 py-2 rounded-lg bg-elvora-success/15 border border-elvora-success/30 text-elvora-success text-xs font-semibold hover:bg-elvora-success/25 transition-all flex-shrink-0"
                >
                  Generieren
                </button>
              </div>
              <p className="text-[11px] text-elvora-text-dim mt-1">Wird für alle API-Zugriffe von OpenClaw benötigt</p>
            </div>

            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">OpenClaw Gateway URL (optional)</label>
              <input
                type="url"
                value={openclawUrl}
                onChange={(e) => setOpenclawUrl(e.target.value)}
                placeholder="http://localhost:3100"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-success/50 transition-all"
              />
            </div>

            {/* API Endpoints Reference */}
            <div className="pt-3 mt-3 border-t border-white/5">
              <div className="text-[10px] font-semibold text-elvora-text-dim uppercase tracking-wider mb-2">API-Endpoints für OpenClaw</div>
              <div className="space-y-1 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-elvora-success/20 text-elvora-success text-[10px]">GET</span>
                  <span className="text-elvora-text-muted">/api/leads</span>
                  <span className="text-elvora-text-dim ml-auto">Lead-Liste</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-elvora-warning/20 text-elvora-warning text-[10px]">PATCH</span>
                  <span className="text-elvora-text-muted">/api/leads/:id/status</span>
                  <span className="text-elvora-text-dim ml-auto">Status ändern</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-elvora-pink/20 text-elvora-pink-light text-[10px]">POST</span>
                  <span className="text-elvora-text-muted">/api/webhooks/openclaw</span>
                  <span className="text-elvora-text-dim ml-auto">Webhook</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-elvora-pink/20 text-elvora-pink-light text-[10px]">POST</span>
                  <span className="text-elvora-text-muted">/api/email/send</span>
                  <span className="text-elvora-text-dim ml-auto">Mail senden</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-elvora-pink/20 text-elvora-pink-light text-[10px]">POST</span>
                  <span className="text-elvora-text-muted">/api/email/bulk</span>
                  <span className="text-elvora-text-dim ml-auto">Bulk-Versand</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-elvora-purple/20 text-elvora-purple-light text-[10px]">POST</span>
                  <span className="text-elvora-text-muted">/api/cron/scan</span>
                  <span className="text-elvora-text-dim ml-auto">Scan + Follow-Ups</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Passwort ändern */}
        <div className="glass rounded-xl p-5 border border-white/10">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-semibold text-white">Panel-Passwort ändern</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Neues Passwort</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 Zeichen"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Bestätigen</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Nochmal eingeben"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-white/30 transition-all"
              />
            </div>
            {pwResult && (
              <div className={`text-xs font-medium ${pwResult.ok ? 'text-elvora-success' : 'text-elvora-danger'}`}>
                {pwResult.message}
              </div>
            )}
            <button
              onClick={async () => {
                if (newPassword.length < 8) { setPwResult({ ok: false, message: 'Min. 8 Zeichen' }); return; }
                if (newPassword !== confirmNewPassword) { setPwResult({ ok: false, message: 'Passwörter stimmen nicht überein' }); return; }
                setPwChanging(true);
                try {
                  const res = await fetch('/api/auth/password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ newPassword }),
                  });
                  if (res.ok) {
                    setPwResult({ ok: true, message: 'Passwort geändert!' });
                    setNewPassword(''); setConfirmNewPassword('');
                  } else {
                    const data = await res.json();
                    setPwResult({ ok: false, message: data.error || 'Fehler' });
                  }
                } catch { setPwResult({ ok: false, message: 'Netzwerkfehler' }); }
                finally { setPwChanging(false); setTimeout(() => setPwResult(null), 4000); }
              }}
              disabled={pwChanging || !newPassword || !confirmNewPassword}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs font-medium hover:bg-white/10 transition-all disabled:opacity-50"
            >
              {pwChanging ? 'Ändere...' : 'Passwort ändern'}
            </button>
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
