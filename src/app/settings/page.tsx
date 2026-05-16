'use client';

import { useState, useEffect, KeyboardEvent } from 'react';

const inputClass = 'w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors';
const inputMonoClass = `${inputClass} font-mono`;

export default function SettingsPage() {
  const [cities, setCities] = useState<string[]>(['Essen', 'Dortmund', 'Bochum', 'Duisburg']);
  const [cityInput, setCityInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['Sanitär', 'Heizung', 'Klempner', 'SHK']);
  const [keywordInput, setKeywordInput] = useState('');
  const [scoreThreshold, setScoreThreshold] = useState(85);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [resendApiKey, setResendApiKey] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('https://calendly.com/elvora-meeting/30min');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [openclawUrl, setOpenclawUrl] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwChanging, setPwChanging] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; message: string } | null>(null);

  interface FollowUpStep {
    step: number;
    days: number;
    subject: string;
    body: string;
  }
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [followUpSequence, setFollowUpSequence] = useState<FollowUpStep[]>([
    { step: 1, days: 3, subject: 'Kurze Nachfrage: Website-Analyse für {firmenname}', body: 'ich hatte Ihnen vor ein paar Tagen eine Analyse Ihrer Website {website} geschickt. Haben Sie die Mail gesehen?\n\nKurz zusammengefasst: Ihr Website-Score liegt bei {score}/100 – da gibt es ein paar Sachen, die Sie vermutlich Kunden kosten.\n\nFalls Sie Interesse haben, können wir gerne kurz telefonieren. 15 Minuten reichen völlig.' },
    { step: 2, days: 7, subject: 'Noch aktuell? Ihre Website-Probleme, {ansprechpartner}', body: 'ich melde mich nochmal kurz wegen Ihrer Website. Die Probleme, die wir gefunden haben, sind leider nicht von alleine weggegangen.\n\nAndere Betriebe in {stadt} investieren gerade in ihre Online-Präsenz – das heißt, je länger Sie warten, desto weiter fallen Sie zurück.\n\nSollen wir mal 15 Minuten telefonieren? Ich zeige Ihnen, was wir konkret für {firmenname} tun können.' },
    { step: 3, days: 14, subject: 'Letzter Hinweis: {score} Punkte für {firmenname}', body: 'letzte Nachricht von mir zu diesem Thema – ich möchte nicht nerven.\n\nIhre Website hat nach wie vor einen Score von {score}/100. Falls Sie in den nächsten Wochen etwas daran ändern möchten, melden Sie sich gerne.\n\nIch wünsche Ihnen alles Gute!' },
  ]);
  const [followUpStats, setFollowUpStats] = useState<{ pending: number; sent: number } | null>(null);

  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiClassifyEnabled, setAiClassifyEnabled] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string; data?: { subject: string; intro: string; pitch: string } } | null>(null);

  const [dataforseoLogin, setDataforseoLogin] = useState('');
  const [dataforseoPassword, setDataforseoPassword] = useState('');

  const [rapidapiKey, setRapidapiKey] = useState('');
  const [rapidapiLinkedinHost, setRapidapiLinkedinHost] = useState('fresh-linkedin-profile-data.p.rapidapi.com');
  const [braveSearchApiKey, setBraveSearchApiKey] = useState('');
  const [searxngUrl, setSearxngUrl] = useState('http://localhost:8888');

  const [agencyName, setAgencyName] = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [agencyEmail, setAgencyEmail] = useState('');
  const [agencyTaxId, setAgencyTaxId] = useState('');
  const [agencyBankIban, setAgencyBankIban] = useState('');
  const [agencyBankBic, setAgencyBankBic] = useState('');
  const [agencyBankName, setAgencyBankName] = useState('');

  interface Template { id: number; name: string; price: number; price_type: string; description: string | null; services: string; is_default: number; }
  const [propTemplates, setPropTemplates] = useState<Template[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplPrice, setTplPrice] = useState('');
  const [tplPriceType, setTplPriceType] = useState('once');
  const [tplDescription, setTplDescription] = useState('');
  const [tplServices, setTplServices] = useState('');
  const [tplSaving, setTplSaving] = useState(false);

  const [tplSubject, setTplSubject] = useState('Website-Analyse für {firmenname} – {score}/100 Punkte');
  const [tplIntro, setTplIntro] = useState('mein Name ist {absender} von Elvora. Wir helfen Betrieben in der Region dabei, online sichtbar zu werden und automatisch Kundenanfragen zu generieren.');
  const [tplPitch, setTplPitch] = useState('Ich habe mir Ihre Website {website} angeschaut und dabei ein paar Punkte gefunden, die Sie vermutlich Kunden kosten:');
  const [tplLeistungen, setTplLeistungen] = useState('Moderne, mobiloptimierte Website\nGoogle-Optimierung für {stadt}\nSSL-Zertifikat & Sicherheits-Setup\nGoogle Business Profil optimieren\nAutomatische Kundenanfragen generieren');
  const [tplCta, setTplCta] = useState('Lassen Sie uns kurz sprechen – 15 Minuten, die sich lohnen.');

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
        if (data.followup_enabled) setFollowUpEnabled(data.followup_enabled !== 'false');
        if (data.followup_sequence) {
          try { setFollowUpSequence(JSON.parse(data.followup_sequence)); } catch { /* keep defaults */ }
        }
        if (data.dataforseo_login) setDataforseoLogin(data.dataforseo_login);
        if (data.dataforseo_password) setDataforseoPassword(data.dataforseo_password);
        if (data.rapidapi_key) setRapidapiKey(data.rapidapi_key);
        if (data.rapidapi_linkedin_host) setRapidapiLinkedinHost(data.rapidapi_linkedin_host);
        if (data.brave_search_api_key) setBraveSearchApiKey(data.brave_search_api_key);
        if (data.searxng_url) setSearxngUrl(data.searxng_url);
        if (data.ai_personalization_enabled) setAiEnabled(data.ai_personalization_enabled === 'true');
        if (data.ai_classify_enabled) setAiClassifyEnabled(data.ai_classify_enabled === 'true');
        if (data.openai_api_key) setOpenaiApiKey(data.openai_api_key);
        if (data.ai_model) setAiModel(data.ai_model);
        if (data.agency_name) setAgencyName(data.agency_name);
        if (data.agency_address) setAgencyAddress(data.agency_address);
        if (data.agency_phone) setAgencyPhone(data.agency_phone);
        if (data.agency_email) setAgencyEmail(data.agency_email);
        if (data.agency_tax_id) setAgencyTaxId(data.agency_tax_id);
        if (data.agency_bank_iban) setAgencyBankIban(data.agency_bank_iban);
        if (data.agency_bank_bic) setAgencyBankBic(data.agency_bank_bic);
        if (data.agency_bank_name) setAgencyBankName(data.agency_bank_name);
      })
      .catch(() => {});

    fetch('/api/followups/process')
      .then(res => res.json())
      .then(data => {
        if (data.stats) setFollowUpStats({ pending: data.stats.pending, sent: data.stats.sent });
      })
      .catch(() => {});

    loadTemplates();
  }, []);

  function loadTemplates() {
    fetch('/api/proposal-templates')
      .then(res => res.json())
      .then(data => setPropTemplates(data.templates || []))
      .catch(() => {});
  }

  async function saveTemplate() {
    if (!tplName.trim() || !tplPrice) return;
    setTplSaving(true);
    try {
      const servicesArr = tplServices.split('\n').map(s => s.trim()).filter(Boolean);
      if (editingTemplate) {
        await fetch(`/api/proposal-templates/${editingTemplate.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tplName, price: parseFloat(tplPrice), price_type: tplPriceType, description: tplDescription || null, services: servicesArr }),
        });
      } else {
        await fetch('/api/proposal-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: tplName, price: parseFloat(tplPrice), price_type: tplPriceType, description: tplDescription || null, services: servicesArr }),
        });
      }
      setTplName(''); setTplPrice(''); setTplPriceType('once'); setTplDescription(''); setTplServices(''); setEditingTemplate(null);
      loadTemplates();
    } catch { /* silent */ }
    finally { setTplSaving(false); }
  }

  async function deleteTemplate(id: number) {
    await fetch(`/api/proposal-templates/${id}`, { method: 'DELETE' });
    loadTemplates();
  }

  function startEditTemplate(t: Template) {
    setEditingTemplate(t);
    setTplName(t.name);
    setTplPrice(t.price.toString());
    setTplPriceType(t.price_type);
    setTplDescription(t.description || '');
    const services: string[] = (() => { try { return JSON.parse(t.services || '[]'); } catch { return []; } })();
    setTplServices(services.join('\n'));
  }

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

  async function saveSettings() {
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
        followup_enabled: followUpEnabled ? 'true' : 'false',
        followup_sequence: JSON.stringify(followUpSequence),
        dataforseo_login: dataforseoLogin,
        dataforseo_password: dataforseoPassword,
        rapidapi_key: rapidapiKey,
        rapidapi_linkedin_host: rapidapiLinkedinHost,
        brave_search_api_key: braveSearchApiKey,
        searxng_url: searxngUrl,
        ai_personalization_enabled: aiEnabled ? 'true' : 'false',
        ai_classify_enabled: aiClassifyEnabled ? 'true' : 'false',
        openai_api_key: openaiApiKey,
        ai_model: aiModel,
        agency_name: agencyName,
        agency_address: agencyAddress,
        agency_phone: agencyPhone,
        agency_email: agencyEmail,
        agency_tax_id: agencyTaxId,
        agency_bank_iban: agencyBankIban,
        agency_bank_bic: agencyBankBic,
        agency_bank_name: agencyBankName,
      }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
      setTimeout(() => setSaveError(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!testEmailTo) return;
    setTestSending(true);
    setTestResult(null);

    try {
      await saveSettings();

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
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Netzwerkfehler' });
    } finally {
      setTestSending(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  }

  const toggleClass = (enabled: boolean) =>
    `relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-elvora-success' : 'bg-elvora-border'}`;

  const toggleDotClass = (enabled: boolean) =>
    `absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-elvora-text">Einstellungen</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            saved
              ? 'bg-elvora-success/15 text-elvora-success border border-elvora-success/20'
              : saveError
              ? 'bg-red-500/15 text-red-400 border border-red-500/20'
              : 'bg-elvora-primary text-white hover:bg-elvora-primary-dark disabled:opacity-50'
          }`}
        >
          {saved ? 'Gespeichert!' : saving ? 'Speichere...' : saveError ? 'Fehler!' : 'Speichern'}
        </button>
      </div>

      {saveError && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-400">
          {saveError}
        </div>
      )}

      <div className="space-y-4">
        {/* Cities */}
        <div className="card rounded-xl p-5">
          <div className="text-sm font-semibold text-elvora-text mb-3">Zielstädte</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {cities.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elvora-purple/10 text-elvora-purple-light text-sm border border-elvora-purple/15">
                {c}
                <button onClick={() => setCities(cities.filter((x) => x !== c))} className="text-elvora-purple-light/50 hover:text-elvora-danger transition-colors">
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
            className={inputClass}
          />
        </div>

        {/* Keywords */}
        <div className="card rounded-xl p-5">
          <div className="text-sm font-semibold text-elvora-text mb-3">Suchbegriffe</div>
          <div className="flex flex-wrap gap-2 mb-3">
            {keywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elvora-pink/10 text-elvora-pink-light text-sm border border-elvora-pink/15">
                {k}
                <button onClick={() => setKeywords(keywords.filter((x) => x !== k))} className="text-elvora-pink-light/50 hover:text-elvora-danger transition-colors">
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
            className={inputClass}
          />
        </div>

        {/* Score Threshold */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-elvora-text">Score-Schwelle</span>
            <span className="text-lg font-semibold text-elvora-purple-light font-mono">{scoreThreshold}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={scoreThreshold}
            onChange={(e) => setScoreThreshold(parseInt(e.target.value))}
            className="w-full h-1.5 bg-elvora-border rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-4
              [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-elvora-primary
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-elvora-card
            "
          />
          <div className="flex justify-between text-xs text-elvora-text-dim mt-1">
            <span>Alle</span>
            <span>Nur perfekte</span>
          </div>
        </div>

        {/* Google Maps API */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">Google Maps Scraper</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-semibold">PLACES API</span>
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
              className={inputMonoClass}
            />
            <p className="text-[11px] text-elvora-text-dim mt-2">
              1. Google Cloud Console &rarr; APIs &amp; Services &rarr; Credentials<br />
              2. &quot;Places API (New)&quot; aktivieren<br />
              3. API-Key erstellen und hier einfügen
            </p>
          </div>
        </div>

        {/* DataForSEO API */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">DataForSEO API</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-[10px] font-semibold">KEYWORD &amp; SERP</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            Keyword-Recherche und SERP-Analyse für lokale SEO. Pay-per-use Abrechnung über dataforseo.com.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Login (E-Mail)</label>
              <input
                type="text"
                value={dataforseoLogin}
                onChange={(e) => setDataforseoLogin(e.target.value)}
                placeholder="deine@email.de"
                className={inputMonoClass}
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Passwort</label>
              <input
                type="password"
                value={dataforseoPassword}
                onChange={(e) => setDataforseoPassword(e.target.value)}
                placeholder="API-Passwort"
                className={inputMonoClass}
              />
            </div>
            <p className="text-[11px] text-elvora-text-dim">
              Registriere dich auf dataforseo.com &rarr; Dashboard &rarr; API Access
            </p>
          </div>
        </div>

        {/* Web-Suche: SearXNG + Brave */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">Web-Suche</span>
            <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-400 text-[10px] font-semibold">SEARXNG</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            Die Web-Suche nutzt eine lokale SearXNG-Instanz (Metasuchmaschine, unlimitiert, kostenlos). Durchsucht Google, Bing &amp; 70+ Quellen gleichzeitig.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">SearXNG URL</label>
              <input
                type="text"
                value={searxngUrl}
                onChange={(e) => setSearxngUrl(e.target.value)}
                placeholder="http://localhost:8888"
                className={inputMonoClass}
              />
            </div>
            <p className="text-[11px] text-elvora-text-dim">
              SearXNG starten:<br />
              <code className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">docker run -d --name searxng --restart unless-stopped -p 8888:8080 searxng/searxng</code>
            </p>
            <div className="border-t border-white/5 pt-3 mt-3">
              <label className="block text-xs text-elvora-text-dim mb-1">Brave Search API-Key <span className="text-elvora-text-dim/50">(optional, Fallback)</span></label>
              <input
                type="password"
                value={braveSearchApiKey}
                onChange={(e) => setBraveSearchApiKey(e.target.value)}
                placeholder="BSA..."
                className={inputMonoClass}
              />
              <p className="text-[11px] text-elvora-text-dim mt-1">
                Fallback wenn SearXNG nicht läuft. Kostenlos auf brave.com/search/api (2.000/Monat).
              </p>
            </div>
          </div>
        </div>

        {/* LinkedIn Scraper / RapidAPI */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">LinkedIn Scraper</span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-semibold">RAPIDAPI</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            Der LinkedIn Scraper nutzt die RapidAPI-Plattform um LinkedIn-Profile zu durchsuchen und E-Mail-Adressen zu extrahieren.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">RapidAPI Key</label>
              <input
                type="password"
                value={rapidapiKey}
                onChange={(e) => setRapidapiKey(e.target.value)}
                placeholder="Dein RapidAPI Key..."
                className={inputMonoClass}
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">API Host</label>
              <input
                type="text"
                value={rapidapiLinkedinHost}
                onChange={(e) => setRapidapiLinkedinHost(e.target.value)}
                placeholder="fresh-linkedin-profile-data.p.rapidapi.com"
                className={inputMonoClass}
              />
            </div>
            <p className="text-[11px] text-elvora-text-dim">
              1. Registriere dich auf rapidapi.com<br />
              2. Suche nach &quot;Fresh LinkedIn Profile Data&quot; und abonniere die API<br />
              3. Kopiere deinen API-Key und füge ihn hier ein
            </p>
          </div>
        </div>

        {/* E-Mail Konfiguration (Resend) */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">E-Mail Konfiguration</span>
            <span className="px-2 py-0.5 rounded-md bg-elvora-success/10 text-elvora-success text-[10px] font-semibold">RESEND</span>
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
                className={inputMonoClass}
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
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-xs text-elvora-text-dim mb-1">Absender E-Mail</label>
                <input
                  type="email"
                  value={emailFromEmail}
                  onChange={(e) => setEmailFromEmail(e.target.value)}
                  placeholder="luan@elvora.me"
                  className={inputClass}
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
                className={inputClass}
              />
              <p className="text-[11px] text-elvora-text-dim mt-1">Wird als &quot;Termin vereinbaren&quot; Button in der Pitch-Mail angezeigt</p>
            </div>

            {/* Test E-Mail */}
            <div className="pt-3 mt-3 border-t border-elvora-border">
              <label className="block text-xs text-elvora-text-dim mb-1">Test-Mail senden</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  placeholder="test@deine-email.de"
                  className={`flex-1 ${inputClass}`}
                />
                <button
                  onClick={sendTestEmail}
                  disabled={testSending || !testEmailTo || !resendApiKey}
                  className="px-4 py-2 rounded-lg bg-elvora-pink/10 text-elvora-pink text-xs font-medium hover:bg-elvora-pink/20 transition-colors disabled:opacity-50 flex-shrink-0"
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
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-purple-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">E-Mail Template</span>
          </div>
          <p className="text-xs text-elvora-text-dim mb-4">
            Passe den E-Mail-Text an. Platzhalter: <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{firmenname}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{ansprechpartner}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{website}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{stadt}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{score}'}</code> <code className="text-elvora-purple-light bg-elvora-purple/10 px-1 rounded">{'{absender}'}</code>
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Betreff</label>
              <input type="text" value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Intro-Text <span className="text-elvora-text-dim/50">(nach &quot;Guten Tag {'{ansprechpartner}'},...&quot;)</span></label>
              <textarea value={tplIntro} onChange={(e) => setTplIntro(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Pitch-Text <span className="text-elvora-text-dim/50">(Überleitung zu den Problemen)</span></label>
              <textarea value={tplPitch} onChange={(e) => setTplPitch(e.target.value)} rows={2} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Leistungen <span className="text-elvora-text-dim/50">(eine pro Zeile)</span></label>
              <textarea value={tplLeistungen} onChange={(e) => setTplLeistungen(e.target.value)} rows={5} className={`${inputClass} resize-none`} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">CTA-Text <span className="text-elvora-text-dim/50">(Call to Action)</span></label>
              <input type="text" value={tplCta} onChange={(e) => setTplCta(e.target.value)} className={inputClass} />
            </div>
          </div>
        </div>

        {/* Follow-Up Sequenz */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-elvora-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-semibold text-elvora-text">Auto Follow-Up Sequenz</span>
              {followUpStats && (
                <span className="px-2 py-0.5 rounded-md bg-elvora-accent/10 text-elvora-accent text-[10px] font-semibold">
                  {followUpStats.pending} ausstehend &middot; {followUpStats.sent} gesendet
                </span>
              )}
            </div>
            <button onClick={() => setFollowUpEnabled(!followUpEnabled)} className={toggleClass(followUpEnabled)}>
              <div className={toggleDotClass(followUpEnabled)} />
            </button>
          </div>

          {followUpEnabled ? (
            <>
              <p className="text-xs text-elvora-text-dim mb-4">
                Nach dem Erst-Email werden automatisch Follow-Ups gesendet. Stoppt automatisch wenn der Lead antwortet oder in der Pipeline weiterbewegt wird.
                <br />
                Platzhalter: <code className="text-elvora-accent bg-elvora-accent/10 px-1 rounded">{'{firmenname}'}</code> <code className="text-elvora-accent bg-elvora-accent/10 px-1 rounded">{'{ansprechpartner}'}</code> <code className="text-elvora-accent bg-elvora-accent/10 px-1 rounded">{'{website}'}</code> <code className="text-elvora-accent bg-elvora-accent/10 px-1 rounded">{'{stadt}'}</code> <code className="text-elvora-accent bg-elvora-accent/10 px-1 rounded">{'{score}'}</code> <code className="text-elvora-accent bg-elvora-accent/10 px-1 rounded">{'{absender}'}</code>
              </p>

              <div className="space-y-4">
                {followUpSequence.map((step, idx) => (
                  <div key={step.step} className="relative rounded-lg bg-elvora-bg-alt border border-elvora-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-elvora-accent/15 text-elvora-accent text-xs font-semibold flex items-center justify-center">{step.step}</span>
                        <span className="text-sm font-medium text-elvora-text">Follow-Up {step.step}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-elvora-text-dim">nach</span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={step.days}
                          onChange={(e) => {
                            const updated = [...followUpSequence];
                            updated[idx] = { ...updated[idx], days: parseInt(e.target.value) || 1 };
                            setFollowUpSequence(updated);
                          }}
                          className="w-14 px-2 py-1 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm text-center focus:outline-none focus:border-elvora-accent/50"
                        />
                        <span className="text-xs text-elvora-text-dim">Tagen</span>
                        {followUpSequence.length > 1 && (
                          <button
                            onClick={() => setFollowUpSequence(followUpSequence.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 })))}
                            className="ml-2 text-elvora-text-dim hover:text-elvora-danger transition-colors"
                            title="Stufe entfernen"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs text-elvora-text-dim mb-1">Betreff</label>
                        <input
                          type="text"
                          value={step.subject}
                          onChange={(e) => {
                            const updated = [...followUpSequence];
                            updated[idx] = { ...updated[idx], subject: e.target.value };
                            setFollowUpSequence(updated);
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-accent/50 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-elvora-text-dim mb-1">Text <span className="text-elvora-text-dim/50">(nach &quot;Guten Tag {'{ansprechpartner}'},...&quot;)</span></label>
                        <textarea
                          value={step.body}
                          onChange={(e) => {
                            const updated = [...followUpSequence];
                            updated[idx] = { ...updated[idx], body: e.target.value };
                            setFollowUpSequence(updated);
                          }}
                          rows={4}
                          className="w-full px-3 py-2 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-elvora-accent/50 transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {followUpSequence.length < 5 && (
                  <button
                    onClick={() => {
                      const lastStep = followUpSequence[followUpSequence.length - 1];
                      setFollowUpSequence([...followUpSequence, {
                        step: followUpSequence.length + 1,
                        days: (lastStep?.days || 7) + 7,
                        subject: 'Erinnerung: {firmenname} Website',
                        body: '',
                      }]);
                    }}
                    className="w-full py-2 rounded-lg border border-dashed border-elvora-border text-elvora-text-dim text-xs hover:border-elvora-accent/30 hover:text-elvora-accent transition-colors"
                  >
                    + Stufe hinzufügen
                  </button>
                )}
              </div>
            </>
          ) : (
            <p className="text-xs text-elvora-text-dim">
              Auto Follow-Ups sind deaktiviert. Keine automatischen Nachfass-Emails werden gesendet.
            </p>
          )}
        </div>

        {/* KI-Personalisierung */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm font-semibold text-elvora-text">KI-Personalisierung</span>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 text-[10px] font-semibold">OPENAI</span>
            </div>
            <button onClick={() => setAiEnabled(!aiEnabled)} className={toggleClass(aiEnabled)}>
              <div className={toggleDotClass(aiEnabled)} />
            </button>
          </div>

          {aiEnabled ? (
            <>
              <p className="text-xs text-elvora-text-dim mb-4">
                Jede Erst-Email wird per KI individuell auf den Lead zugeschnitten. Basierend auf den Website-Problemen, der Branche und dem Standort wird ein persönlicher Einstieg generiert.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">OpenAI API-Key</label>
                  <input
                    type="password"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className={inputMonoClass}
                  />
                  <p className="text-[11px] text-elvora-text-dim mt-1">
                    Hol dir deinen Key auf platform.openai.com/api-keys
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-elvora-text-dim mb-1">Modell</label>
                  <select
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  >
                    <option value="gpt-4o-mini" className="bg-elvora-card">GPT-4o Mini (schnell & günstig)</option>
                    <option value="gpt-4o" className="bg-elvora-card">GPT-4o (beste Qualität)</option>
                    <option value="gpt-4.1-mini" className="bg-elvora-card">GPT-4.1 Mini</option>
                    <option value="gpt-4.1-nano" className="bg-elvora-card">GPT-4.1 Nano (am günstigsten)</option>
                  </select>
                </div>

                {/* AI Test */}
                <div className="pt-3 mt-3 border-t border-elvora-border">
                  <label className="block text-xs text-elvora-text-dim mb-2">KI testen</label>
                  <button
                    onClick={async () => {
                      setAiTestLoading(true);
                      setAiTestResult(null);
                      try {
                        const res = await fetch('/api/ai/personalize', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            lead_name: 'Müller Sanitär GmbH',
                            ansprechpartner: 'Herr Müller',
                            website: 'www.mueller-sanitaer.de',
                            city: 'Essen',
                            score: 42,
                            problems: [
                              { label: 'Kein SSL-Zertifikat', severity: 'critical' },
                              { label: 'Website nicht mobilfähig', severity: 'major' },
                              { label: 'Veraltetes Design (2018)', severity: 'major' },
                            ],
                            seo_issues: [
                              { label: 'Keine Meta-Beschreibung', impact: 'high' },
                              { label: 'Fehlende Alt-Texte bei Bildern', impact: 'medium' },
                            ],
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          setAiTestResult({
                            ok: true,
                            message: `Generiert (${data.tokens} Tokens, ${data.model})`,
                            data: { subject: data.subject, intro: data.intro, pitch: data.pitch },
                          });
                        } else {
                          setAiTestResult({ ok: false, message: data.error || 'Fehler' });
                        }
                      } catch {
                        setAiTestResult({ ok: false, message: 'Netzwerkfehler' });
                      } finally {
                        setAiTestLoading(false);
                      }
                    }}
                    disabled={aiTestLoading || !openaiApiKey}
                    className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                  >
                    {aiTestLoading ? 'Generiere...' : 'Test-Personalisierung generieren'}
                  </button>

                  {aiTestResult && (
                    <div className="mt-3">
                      <div className={`text-xs font-medium mb-2 ${aiTestResult.ok ? 'text-elvora-success' : 'text-elvora-danger'}`}>
                        {aiTestResult.message}
                      </div>
                      {aiTestResult.data && (
                        <div className="space-y-2 rounded-lg bg-elvora-bg-alt border border-elvora-border p-3">
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium">Betreff</span>
                            <p className="text-xs text-elvora-text mt-0.5">{aiTestResult.data.subject}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium">Intro</span>
                            <p className="text-xs text-elvora-text-muted mt-0.5">{aiTestResult.data.intro}</p>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium">Pitch</span>
                            <p className="text-xs text-elvora-text-muted mt-0.5">{aiTestResult.data.pitch}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Auto-Classify Toggle */}
                <div className="pt-3 mt-3 border-t border-elvora-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-elvora-text block">Auto-Klassifizierung</span>
                      <span className="text-[11px] text-elvora-text-dim">Eingehende Antworten automatisch analysieren (Interesse, Absage, Frage, Out-of-Office)</span>
                    </div>
                    <button onClick={() => setAiClassifyEnabled(!aiClassifyEnabled)} className={`${toggleClass(aiClassifyEnabled)} flex-shrink-0 ml-3`}>
                      <div className={toggleDotClass(aiClassifyEnabled)} />
                    </button>
                  </div>
                  {aiClassifyEnabled && (
                    <div className="mt-2 rounded-lg bg-elvora-bg-alt border border-elvora-border p-2.5">
                      <ul className="text-[11px] text-elvora-text-dim space-y-1">
                        <li>- <span className="text-elvora-success">Interesse</span>: Lead wird automatisch auf &quot;Meeting&quot; gesetzt</li>
                        <li>- <span className="text-red-400">Absage/Abmeldung</span>: Lead wird auf &quot;Verloren&quot; gesetzt</li>
                        <li>- <span className="text-amber-400">Frage</span>: Follow-Ups pausiert, manuelle Antwort empfohlen</li>
                        <li>- <span className="text-elvora-text-dim">Abwesenheit</span>: Follow-Ups pausiert</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Info Box */}
                <div className="rounded-lg bg-amber-500/5 border border-elvora-border p-3 mt-2">
                  <div className="text-[10px] font-medium text-amber-400/70 uppercase tracking-wider mb-1">So funktioniert es</div>
                  <ul className="text-xs text-elvora-text-dim space-y-1">
                    <li>1. Beim Email-Versand analysiert die KI die Website-Probleme des Leads</li>
                    <li>2. Betreff, Intro und Pitch werden individuell formuliert</li>
                    <li>3. Der Rest der Email (Score, Probleme, CTA) bleibt gleich</li>
                    <li>4. Falls die KI ausfällt, wird automatisch das Template verwendet</li>
                  </ul>
                  <p className="text-[11px] text-elvora-text-dim mt-2">
                    Kosten: ca. 0,01-0,03 Cent pro Email (GPT-4o Mini)
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-elvora-text-dim">
              KI-Personalisierung ist deaktiviert. Emails werden mit dem Standard-Template versendet.
            </p>
          )}
        </div>

        {/* OpenClaw Integration */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🦞</span>
            <span className="text-sm font-semibold text-elvora-text">OpenClaw Integration</span>
            <span className="px-2 py-0.5 rounded-md bg-elvora-success/10 text-elvora-success text-[10px] font-semibold">API</span>
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
                  className={`flex-1 ${inputMonoClass}`}
                />
                <button
                  onClick={() => setApiKey(crypto.randomUUID())}
                  className="px-3 py-2 rounded-lg bg-elvora-success/10 text-elvora-success text-xs font-medium hover:bg-elvora-success/20 transition-colors flex-shrink-0"
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
                className={inputClass}
              />
            </div>

            {/* API Endpoints Reference */}
            <div className="pt-3 mt-3 border-t border-elvora-border">
              <div className="text-[10px] font-medium text-elvora-text-dim uppercase tracking-wider mb-2">API-Endpoints für OpenClaw</div>
              <div className="space-y-1 text-xs font-mono">
                {[
                  { method: 'GET', color: 'text-elvora-success bg-elvora-success/10', path: '/api/leads', desc: 'Lead-Liste' },
                  { method: 'PATCH', color: 'text-elvora-warning bg-elvora-warning/10', path: '/api/leads/:id/status', desc: 'Status ändern' },
                  { method: 'POST', color: 'text-elvora-pink bg-elvora-pink/10', path: '/api/webhooks/openclaw', desc: 'Webhook' },
                  { method: 'POST', color: 'text-elvora-pink bg-elvora-pink/10', path: '/api/email/send', desc: 'Mail senden' },
                  { method: 'POST', color: 'text-elvora-pink bg-elvora-pink/10', path: '/api/email/bulk', desc: 'Bulk-Versand' },
                  { method: 'POST', color: 'text-elvora-purple-light bg-elvora-purple/10', path: '/api/cron/scan', desc: 'Scan + Follow-Ups' },
                ].map((ep, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${ep.color}`}>{ep.method}</span>
                    <span className="text-elvora-text-muted">{ep.path}</span>
                    <span className="text-elvora-text-dim ml-auto">{ep.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Agentur-Daten */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">Agentur-Daten</span>
            <span className="text-[10px] text-elvora-text-dim">(für Angebote & Client-Portal)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Firmenname</label>
              <input type="text" value={agencyName} onChange={e => setAgencyName(e.target.value)} placeholder="Elvora GmbH" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">E-Mail</label>
              <input type="email" value={agencyEmail} onChange={e => setAgencyEmail(e.target.value)} placeholder="info@elvora.de" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Telefon</label>
              <input type="text" value={agencyPhone} onChange={e => setAgencyPhone(e.target.value)} placeholder="+49 201 12345678" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">USt-IdNr.</label>
              <input type="text" value={agencyTaxId} onChange={e => setAgencyTaxId(e.target.value)} placeholder="DE123456789" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-elvora-text-dim mb-1">Adresse</label>
              <input type="text" value={agencyAddress} onChange={e => setAgencyAddress(e.target.value)} placeholder="Musterstr. 1, 45127 Essen" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Bank (Name)</label>
              <input type="text" value={agencyBankName} onChange={e => setAgencyBankName(e.target.value)} placeholder="Sparkasse Essen" className={inputClass} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">IBAN</label>
              <input type="text" value={agencyBankIban} onChange={e => setAgencyBankIban(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" className={inputMonoClass} />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">BIC</label>
              <input type="text" value={agencyBankBic} onChange={e => setAgencyBankBic(e.target.value)} placeholder="COBADEFFXXX" className={inputMonoClass} />
            </div>
          </div>
        </div>

        {/* Angebots-Vorlagen */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">Angebots-Vorlagen</span>
          </div>

          {propTemplates.length > 0 && (
            <div className="space-y-2 mb-4">
              {propTemplates.map(t => {
                const services: string[] = (() => { try { return JSON.parse(t.services || '[]'); } catch { return []; } })();
                return (
                  <div key={t.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-elvora-bg-alt border border-elvora-border group">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-elvora-text font-medium">{t.name}</div>
                      <div className="text-xs text-elvora-text-dim">{t.price.toLocaleString('de-DE')} € {t.price_type === 'monthly' ? '/ Monat' : 'einmalig'} · {services.length} Leistungen</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => startEditTemplate(t)} className="px-2 py-1 rounded text-xs text-elvora-text-dim hover:text-elvora-text hover:bg-white/5 transition-colors">Bearbeiten</button>
                      <button onClick={() => deleteTemplate(t.id)} className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-all">Löschen</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-2 p-3 rounded-lg bg-elvora-bg-alt border border-elvora-border">
            <div className="text-xs text-elvora-text-dim font-medium">{editingTemplate ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input type="text" value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Name (z.B. Website Relaunch)" className={`md:col-span-2 ${inputClass}`} />
              <div className="flex gap-2">
                <input type="number" value={tplPrice} onChange={e => setTplPrice(e.target.value)} placeholder="Preis" className={`flex-1 ${inputClass}`} />
                <select value={tplPriceType} onChange={e => setTplPriceType(e.target.value)} className={inputClass} style={{width: 'auto'}}>
                  <option value="once">Einmalig</option>
                  <option value="monthly">Monatlich</option>
                </select>
              </div>
            </div>
            <input type="text" value={tplDescription} onChange={e => setTplDescription(e.target.value)} placeholder="Kurzbeschreibung (optional)" className={inputClass} />
            <div>
              <label className="block text-[10px] text-elvora-text-dim mb-1">Leistungen (eine pro Zeile)</label>
              <textarea value={tplServices} onChange={e => setTplServices(e.target.value)} rows={4} placeholder={"Responsives Webdesign\nSEO-Optimierung\nSSL & Hosting"} className={`${inputClass} resize-none`} />
            </div>
            <div className="flex gap-2">
              <button onClick={saveTemplate} disabled={tplSaving || !tplName.trim() || !tplPrice} className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple/80 transition-colors disabled:opacity-50">
                {tplSaving ? 'Speichert...' : editingTemplate ? 'Aktualisieren' : 'Vorlage erstellen'}
              </button>
              {editingTemplate && (
                <button onClick={() => { setEditingTemplate(null); setTplName(''); setTplPrice(''); setTplPriceType('once'); setTplDescription(''); setTplServices(''); }} className="px-4 py-2 rounded-lg bg-white/5 text-elvora-text-dim text-xs hover:text-elvora-text transition-colors">
                  Abbrechen
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Passwort ändern */}
        <div className="card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-elvora-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-sm font-semibold text-elvora-text">Panel-Passwort ändern</span>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Neues Passwort</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 8 Zeichen"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-elvora-text-dim mb-1">Bestätigen</label>
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Nochmal eingeben"
                className={inputClass}
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
              className="px-4 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-xs font-medium hover:bg-elvora-surface transition-colors disabled:opacity-50"
            >
              {pwChanging ? 'Ändere...' : 'Passwort ändern'}
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card rounded-xl p-5 border-elvora-danger/20">
          <div className="text-sm font-semibold text-elvora-danger mb-3">Gefahrenzone</div>
          <div className="flex gap-3">
            <button className="px-3 py-2 rounded-lg bg-elvora-danger/10 text-elvora-danger text-xs font-medium hover:bg-elvora-danger/20 transition-colors">
              Alle Leads löschen
            </button>
            <button className="px-3 py-2 rounded-lg bg-elvora-danger/10 text-elvora-danger text-xs font-medium hover:bg-elvora-danger/20 transition-colors">
              Datenbank zurücksetzen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
