'use client';

import { useState, useEffect, KeyboardEvent, ReactNode } from 'react';

const inputClass = 'w-full px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 transition-colors';
const inputMonoClass = `${inputClass} font-mono`;

type TabKey = 'general' | 'email' | 'outreach' | 'ai' | 'scraper' | 'proposals' | 'goals' | 'integration' | 'security' | 'datenschutz';

interface FollowUpStep {
  step: number;
  days: number;
  subject: string;
  body: string;
}

interface Template {
  id: number;
  name: string;
  price: number;
  price_type: string;
  description: string | null;
  services: string;
  is_default: number;
}

interface ActivityGoal {
  id?: number;
  activity_type: string;
  period: string;
  target: number;
}

const TABS: { key: TabKey; label: string; description: string; icon: ReactNode }[] = [
  {
    key: 'general', label: 'Allgemein', description: 'Zielstädte, Keywords, Score & Agentur',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    key: 'email', label: 'E-Mail', description: 'Resend, Templates & Follow-Ups',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    key: 'outreach', label: 'Outreach', description: 'Massen-Versand & Entscheider',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2zM12 12v6m-3-3l3 3 3-3" /></svg>,
  },
  {
    key: 'ai', label: 'KI', description: 'Personalisierung & Klassifizierung',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>,
  },
  {
    key: 'scraper', label: 'Scraper APIs', description: 'SearXNG, Maps, SEO & LinkedIn',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>,
  },
  {
    key: 'proposals', label: 'Angebote', description: 'Vorlagen & Bausteine',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    key: 'goals', label: 'Ziele', description: 'Deal-Alterung & Aktivitäts-Ziele',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    key: 'integration', label: 'Integration', description: 'API-Key & Webhooks',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
  },
  {
    key: 'security', label: 'Sicherheit', description: 'Passwort & Gefahrenzone',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
  },
  {
    key: 'datenschutz', label: 'Datenschutz', description: 'DSGVO, Datenaufbewahrung & Löschung',
    icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
];

const DEFAULT_FOLLOWUP: FollowUpStep[] = [
  { step: 1, days: 3, subject: 'Kurze Nachfrage: Website-Analyse für {firmenname}', body: 'ich hatte Ihnen vor ein paar Tagen eine Analyse Ihrer Website {website} geschickt. Haben Sie die Mail gesehen?\n\nKurz zusammengefasst: Ihr Website-Score liegt bei {score}/100 – da gibt es ein paar Sachen, die Sie vermutlich Kunden kosten.\n\nFalls Sie Interesse haben, können wir gerne kurz telefonieren. 15 Minuten reichen völlig.' },
  { step: 2, days: 7, subject: 'Noch aktuell? Ihre Website-Probleme, {ansprechpartner}', body: 'ich melde mich nochmal kurz wegen Ihrer Website. Die Probleme, die wir gefunden haben, sind leider nicht von alleine weggegangen.\n\nAndere Betriebe in {stadt} investieren gerade in ihre Online-Präsenz – das heißt, je länger Sie warten, desto weiter fallen Sie zurück.\n\nSollen wir mal 15 Minuten telefonieren? Ich zeige Ihnen, was wir konkret für {firmenname} tun können.' },
  { step: 3, days: 14, subject: 'Letzter Hinweis: {score} Punkte für {firmenname}', body: 'letzte Nachricht von mir zu diesem Thema – ich möchte nicht nerven.\n\nIhre Website hat nach wie vor einen Score von {score}/100. Falls Sie in den nächsten Wochen etwas daran ändern möchten, melden Sie sich gerne.\n\nIch wünsche Ihnen alles Gute!' },
];


const DEAL_ROT_STAGES = [
  { key: 'deal_rot_days_not_contacted', label: 'Nicht kontaktiert', defaultVal: 5 },
  { key: 'deal_rot_days_email_sent', label: 'Mail gesendet', defaultVal: 7 },
  { key: 'deal_rot_days_called', label: 'Angerufen', defaultVal: 5 },
  { key: 'deal_rot_days_meeting', label: 'Meeting', defaultVal: 10 },
  { key: 'deal_rot_days_proposal', label: 'Angebot', defaultVal: 14 },
];
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  // General
  const [cities, setCities] = useState<string[]>(['Essen', 'Dortmund', 'Bochum', 'Duisburg']);
  const [cityInput, setCityInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['Sanitär', 'Heizung', 'Klempner', 'SHK']);
  const [keywordInput, setKeywordInput] = useState('');
  const [scoreThreshold, setScoreThreshold] = useState(85);
  const [agencyName, setAgencyName] = useState('');
  const [agencyAddress, setAgencyAddress] = useState('');
  const [agencyPhone, setAgencyPhone] = useState('');
  const [agencyEmail, setAgencyEmail] = useState('');
  const [agencyTaxId, setAgencyTaxId] = useState('');
  const [agencyBankIban, setAgencyBankIban] = useState('');
  const [agencyBankBic, setAgencyBankBic] = useState('');
  const [agencyBankName, setAgencyBankName] = useState('');

  // Email
  const [resendApiKey, setResendApiKey] = useState('');
  const [emailFromName, setEmailFromName] = useState('');
  const [emailFromEmail, setEmailFromEmail] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('https://calendly.com/elvora-meeting/30min');
  const [testEmailTo, setTestEmailTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [tplSubject, setTplSubject] = useState('Website-Analyse für {firmenname} – {score}/100 Punkte');
  const [tplIntro, setTplIntro] = useState('mein Name ist {absender} von Elvora. Wir helfen Betrieben in der Region dabei, online sichtbar zu werden und automatisch Kundenanfragen zu generieren.');
  const [tplPitch, setTplPitch] = useState('Ich habe mir Ihre Website {website} angeschaut und dabei ein paar Punkte gefunden, die Sie vermutlich Kunden kosten:');
  const [tplLeistungen, setTplLeistungen] = useState('Moderne, mobiloptimierte Website\nGoogle-Optimierung für {stadt}\nSSL-Zertifikat & Sicherheits-Setup\nGoogle Business Profil optimieren\nAutomatische Kundenanfragen generieren');
  const [tplCta, setTplCta] = useState('Lassen Sie uns kurz sprechen – 15 Minuten, die sich lohnen.');
  const [followUpEnabled, setFollowUpEnabled] = useState(true);
  const [followUpSequence, setFollowUpSequence] = useState<FollowUpStep[]>(DEFAULT_FOLLOWUP);
  const [followUpStats, setFollowUpStats] = useState<{ pending: number; sent: number } | null>(null);

  // Outreach
  const [outreachMailsPerHour, setOutreachMailsPerHour] = useState(60);
  const [outreachPreferEntscheider, setOutreachPreferEntscheider] = useState(true);
  const [outreachAutoSendEnabled, setOutreachAutoSendEnabled] = useState(false);
  const [outreachAutoSendMaxScore, setOutreachAutoSendMaxScore] = useState(50);

  // AI
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiClassifyEnabled, setAiClassifyEnabled] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string; data?: { subject: string; intro: string; pitch: string } } | null>(null);

  // Scraper APIs
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [searxngUrl, setSearxngUrl] = useState('http://localhost:8888');
  const [braveSearchApiKey, setBraveSearchApiKey] = useState('');
  const [dataforseoLogin, setDataforseoLogin] = useState('');
  const [dataforseoPassword, setDataforseoPassword] = useState('');
  const [rapidapiKey, setRapidapiKey] = useState('');
  const [rapidapiLinkedinHost, setRapidapiLinkedinHost] = useState('fresh-linkedin-profile-data.p.rapidapi.com');

  // Proposals
  const [propTemplates, setPropTemplates] = useState<Template[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplPrice, setTplPrice] = useState('');
  const [tplPriceType, setTplPriceType] = useState('once');
  const [tplDescription, setTplDescription] = useState('');
  const [tplServices, setTplServices] = useState('');
  const [tplSaving, setTplSaving] = useState(false);

  // Goals & Automation
  const [dealRotDays, setDealRotDays] = useState<Record<string, number>>({
    deal_rot_days_not_contacted: 5,
    deal_rot_days_email_sent: 7,
    deal_rot_days_called: 5,
    deal_rot_days_meeting: 10,
    deal_rot_days_proposal: 14,
  });
  const [goalEmails, setGoalEmails] = useState(10);
  const [goalCalls, setGoalCalls] = useState(5);
  const [goalMeetings, setGoalMeetings] = useState(2);
  const [goalsSaving, setGoalsSaving] = useState(false);
  const [goalsSaved, setGoalsSaved] = useState(false);

  // Integration
  const [apiKey, setApiKey] = useState('');
  const [openclawUrl, setOpenclawUrl] = useState('');

  // Security
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [pwChanging, setPwChanging] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Datenschutz
  const [privacyPolicyUrl, setPrivacyPolicyUrl] = useState('');
  const [impressumUrl, setImpressumUrl] = useState('');
  const [dataRetentionDays, setDataRetentionDays] = useState(365);
  const [emailTrackingEnabled, setEmailTrackingEnabled] = useState(true);
  const [gdprSearchEmail, setGdprSearchEmail] = useState('');
  const [gdprSearchResult, setGdprSearchResult] = useState<Record<string, unknown> | null>(null);
  const [gdprSearching, setGdprSearching] = useState(false);
  const [gdprDeleting, setGdprDeleting] = useState(false);
  const [gdprDeleteResult, setGdprDeleteResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [auditLog, setAuditLog] = useState<{ action: string; details: string; created_at: string }[]>([]);

  // Save state
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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
        if (data.followup_enabled !== undefined) setFollowUpEnabled(data.followup_enabled !== 'false');
        if (data.followup_sequence) { try { setFollowUpSequence(JSON.parse(data.followup_sequence)); } catch { /* keep */ } }
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
        if (data.outreach_default_mails_per_hour) setOutreachMailsPerHour(parseInt(data.outreach_default_mails_per_hour));
        if (data.outreach_prefer_entscheider) setOutreachPreferEntscheider(data.outreach_prefer_entscheider === 'true');
        if (data.outreach_auto_send_enabled) setOutreachAutoSendEnabled(data.outreach_auto_send_enabled === 'true');
        if (data.outreach_auto_send_max_score) setOutreachAutoSendMaxScore(parseInt(data.outreach_auto_send_max_score));
        if (data.privacy_policy_url) setPrivacyPolicyUrl(data.privacy_policy_url);
        if (data.impressum_url) setImpressumUrl(data.impressum_url);
        if (data.data_retention_days) setDataRetentionDays(parseInt(data.data_retention_days));
        if (data.email_tracking_enabled !== undefined) setEmailTrackingEnabled(data.email_tracking_enabled !== '0');
        // Deal rot thresholds
        const rotUpdates: Record<string, number> = {};
        for (const stage of DEAL_ROT_STAGES) {
          if (data[stage.key]) rotUpdates[stage.key] = parseInt(data[stage.key]);
        }
        if (Object.keys(rotUpdates).length > 0) {
          setDealRotDays(prev => ({ ...prev, ...rotUpdates }));
        }
      })
      .catch(() => { /* silent */ });

    fetch('/api/followups/process')
      .then(res => res.json())
      .then(data => { if (data.stats) setFollowUpStats({ pending: data.stats.pending, sent: data.stats.sent }); })
      .catch(() => { /* silent */ });

    loadTemplates();

    // Load activity goals
    fetch('/api/goals')
      .then(res => res.json())
      .then(data => {
        if (data.goals) {
          for (const g of data.goals as ActivityGoal[]) {
            if (g.period === 'daily') {
              if (g.activity_type === 'email') setGoalEmails(g.target);
              if (g.activity_type === 'call') setGoalCalls(g.target);
              if (g.activity_type === 'meeting') setGoalMeetings(g.target);
            }
          }
        }
      })
      .catch(() => { /* silent */ });
  }, []);

  function loadTemplates() {
    fetch('/api/proposal-templates')
      .then(res => res.json())
      .then(data => setPropTemplates(data.templates || []))
      .catch(() => { /* silent */ });
  }

  async function saveTemplate() {
    if (!tplName.trim() || !tplPrice) return;
    setTplSaving(true);
    try {
      const servicesArr = tplServices.split('\n').map(s => s.trim()).filter(Boolean);
      const body = JSON.stringify({ name: tplName, price: parseFloat(tplPrice), price_type: tplPriceType, description: tplDescription || null, services: servicesArr });
      if (editingTemplate) {
        await fetch(`/api/proposal-templates/${editingTemplate.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body });
      } else {
        await fetch('/api/proposal-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      }
      setTplName(''); setTplPrice(''); setTplPriceType('once'); setTplDescription(''); setTplServices(''); setEditingTemplate(null);
      loadTemplates();
    } finally { setTplSaving(false); }
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
        outreach_default_mails_per_hour: outreachMailsPerHour.toString(),
        outreach_prefer_entscheider: outreachPreferEntscheider ? 'true' : 'false',
        outreach_auto_send_enabled: outreachAutoSendEnabled ? 'true' : 'false',
        outreach_auto_send_max_score: outreachAutoSendMaxScore.toString(),
        ...Object.fromEntries(DEAL_ROT_STAGES.map(s => [s.key, dealRotDays[s.key].toString()])),
        privacy_policy_url: privacyPolicyUrl,
        impressum_url: impressumUrl,
        data_retention_days: dataRetentionDays.toString(),
        email_tracking_enabled: emailTrackingEnabled ? '1' : '0',
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
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

  async function saveActivityGoals() {
    setGoalsSaving(true);
    try {
      await Promise.all([
        fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activity_type: 'email', period: 'daily', target: goalEmails }) }),
        fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activity_type: 'call', period: 'daily', target: goalCalls }) }),
        fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ activity_type: 'meeting', period: 'daily', target: goalMeetings }) }),
      ]);
      setGoalsSaved(true);
      setTimeout(() => setGoalsSaved(false), 2000);
    } catch { /* silent */ }
    finally { setGoalsSaving(false); }
  }

  async function sendTestEmail() {
    if (!testEmailTo) return;
    setTestSending(true);
    setTestResult(null);
    try {
      await saveSettings();
      const res = await fetch('/api/email/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_name: 'Test Firma GmbH', lead_email: testEmailTo, ansprechpartner: 'Herr Test',
          website: 'www.test-firma.de', city: 'Essen', score: 87,
          problems: [{ label: 'Kein SSL-Zertifikat', severity: 'critical' }, { label: 'Nicht mobilfähig', severity: 'major' }],
          seo_issues: [{ label: 'Meta-Beschreibungen fehlen', impact: 'high' }],
        }),
      });
      const data = await res.json();
      setTestResult(res.ok ? { ok: true, message: `Test-Mail an ${testEmailTo} gesendet!` } : { ok: false, message: data.error || 'Fehler' });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : 'Netzwerkfehler' });
    } finally {
      setTestSending(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  }

  async function testAi() {
    setAiTestLoading(true);
    setAiTestResult(null);
    try {
      const res = await fetch('/api/ai/personalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_name: 'Müller Sanitär GmbH', ansprechpartner: 'Herr Müller',
          website: 'www.mueller-sanitaer.de', city: 'Essen', score: 42,
          problems: [
            { label: 'Kein SSL-Zertifikat', severity: 'critical' },
            { label: 'Website nicht mobilfähig', severity: 'major' },
            { label: 'Veraltetes Design (2018)', severity: 'major' },
          ],
          seo_issues: [{ label: 'Keine Meta-Beschreibung', impact: 'high' }, { label: 'Fehlende Alt-Texte bei Bildern', impact: 'medium' }],
        }),
      });
      const data = await res.json();
      if (res.ok) setAiTestResult({ ok: true, message: `Generiert (${data.tokens} Tokens, ${data.model})`, data: { subject: data.subject, intro: data.intro, pitch: data.pitch } });
      else setAiTestResult({ ok: false, message: data.error || 'Fehler' });
    } catch {
      setAiTestResult({ ok: false, message: 'Netzwerkfehler' });
    } finally {
      setAiTestLoading(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) { setPwResult({ ok: false, message: 'Min. 8 Zeichen' }); return; }
    if (newPassword !== confirmNewPassword) { setPwResult({ ok: false, message: 'Passwörter stimmen nicht überein' }); return; }
    setPwChanging(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
  }

  const toggleClass = (enabled: boolean) => `relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-elvora-success' : 'bg-elvora-border'}`;
  const toggleDotClass = (enabled: boolean) => `absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`;

  return (
    <div className="max-w-6xl mx-auto pt-16 lg:pt-0">
      {/* Sticky Save Bar */}
      <div className="sticky top-0 lg:top-0 z-20 -mx-4 lg:-mx-6 px-4 lg:px-6 py-4 bg-elvora-bg/95 backdrop-blur border-b border-elvora-border mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-elvora-text">Einstellungen</h1>
            <p className="text-xs text-elvora-text-dim mt-0.5 hidden sm:block">{TABS.find(t => t.key === activeTab)?.description}</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              saved ? 'bg-elvora-success/15 text-elvora-success border border-elvora-success/20'
                : saveError ? 'bg-red-500/15 text-red-400 border border-red-500/20'
                : 'bg-elvora-gradient text-white shadow-elvora disabled:opacity-50'
            }`}
          >
            {saved ? '✓ Gespeichert' : saving ? 'Speichere...' : saveError ? 'Fehler!' : 'Alle Änderungen speichern'}
          </button>
        </div>
        {saveError && (
          <div className="mt-3 p-2.5 rounded-lg text-xs bg-red-500/10 border border-red-500/20 text-red-400">{saveError}</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Tab Sidebar */}
        <nav className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible -mx-4 lg:mx-0 px-4 lg:px-0 pb-2 lg:pb-0">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all whitespace-nowrap flex-shrink-0 lg:w-full lg:text-left ${
                  activeTab === tab.key
                    ? 'bg-elvora-purple/[0.08] text-white'
                    : 'text-elvora-text-muted hover:text-elvora-text hover:bg-white/[0.03]'
                }`}
              >
                <span className={activeTab === tab.key ? 'text-elvora-purple-light' : 'text-elvora-text-dim'}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="space-y-4 min-w-0">
          {activeTab === 'general' && (
            <>
              <SectionCard title="Zielstädte" description="Städte für automatische Scrapings und Filter">
                <div className="flex flex-wrap gap-2 mb-3">
                  {cities.map(c => (
                    <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elvora-purple/10 text-elvora-purple-light text-sm border border-elvora-purple/15">
                      {c}
                      <button onClick={() => setCities(cities.filter(x => x !== c))} className="text-elvora-purple-light/50 hover:text-red-400 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
                <input value={cityInput} onChange={e => setCityInput(e.target.value)} onKeyDown={addCity} placeholder="Stadt eingeben + Enter" className={inputClass} />
              </SectionCard>

              <SectionCard title="Suchbegriffe" description="Standard-Keywords für Scraper">
                <div className="flex flex-wrap gap-2 mb-3">
                  {keywords.map(k => (
                    <span key={k} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-elvora-pink/10 text-elvora-pink-light text-sm border border-elvora-pink/15">
                      {k}
                      <button onClick={() => setKeywords(keywords.filter(x => x !== k))} className="text-elvora-pink-light/50 hover:text-red-400 transition-colors">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
                <input value={keywordInput} onChange={e => setKeywordInput(e.target.value)} onKeyDown={addKeyword} placeholder="Keyword eingeben + Enter" className={inputClass} />
              </SectionCard>

              <SectionCard title="Score-Schwelle" description="Ab welchem Score Leads als 'qualifiziert' gelten">
                <div className="flex items-center gap-4 mb-2">
                  <input type="range" min={0} max={100} value={scoreThreshold} onChange={e => setScoreThreshold(parseInt(e.target.value))} className="flex-1 accent-elvora-purple" />
                  <span className="text-2xl font-semibold text-elvora-purple-light font-mono w-12 text-right">{scoreThreshold}</span>
                </div>
                <div className="flex justify-between text-[10px] text-elvora-text-dim">
                  <span>0 (alle Leads)</span><span>100 (nur perfekte)</span>
                </div>
              </SectionCard>

              <SectionCard title="Agentur-Daten" description="Wird in Angeboten, Mails und Footer verwendet">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Firmenname"><input value={agencyName} onChange={e => setAgencyName(e.target.value)} placeholder="Elvora GmbH" className={inputClass} /></Field>
                  <Field label="E-Mail"><input type="email" value={agencyEmail} onChange={e => setAgencyEmail(e.target.value)} placeholder="info@elvora.de" className={inputClass} /></Field>
                  <Field label="Telefon"><input value={agencyPhone} onChange={e => setAgencyPhone(e.target.value)} placeholder="+49 201 12345678" className={inputClass} /></Field>
                  <Field label="USt-IdNr."><input value={agencyTaxId} onChange={e => setAgencyTaxId(e.target.value)} placeholder="DE123456789" className={inputClass} /></Field>
                  <Field label="Adresse" colSpan2><input value={agencyAddress} onChange={e => setAgencyAddress(e.target.value)} placeholder="Musterstr. 1, 45127 Essen" className={inputClass} /></Field>
                  <Field label="Bank-Name"><input value={agencyBankName} onChange={e => setAgencyBankName(e.target.value)} placeholder="Sparkasse Essen" className={inputClass} /></Field>
                  <Field label="IBAN"><input value={agencyBankIban} onChange={e => setAgencyBankIban(e.target.value)} placeholder="DE89 3704 0044 0532 0130 00" className={inputMonoClass} /></Field>
                  <Field label="BIC"><input value={agencyBankBic} onChange={e => setAgencyBankBic(e.target.value)} placeholder="COBADEFFXXX" className={inputMonoClass} /></Field>
                </div>
              </SectionCard>
            </>
          )}

          {activeTab === 'email' && (
            <>
              <SectionCard title="Resend Konfiguration" badge="RESEND" badgeColor="success" description="E-Mail-Versand über resend.com – 100 Mails/Tag kostenlos">
                <div className="space-y-3">
                  <Field label="Resend API-Key">
                    <input type="password" value={resendApiKey} onChange={e => setResendApiKey(e.target.value)} placeholder="re_xxxxxxxxx..." className={inputMonoClass} />
                  </Field>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Absendername"><input value={emailFromName} onChange={e => setEmailFromName(e.target.value)} placeholder="Luan von Elvora" className={inputClass} /></Field>
                    <Field label="Absender E-Mail" hint="Verifizierte Domain"><input type="email" value={emailFromEmail} onChange={e => setEmailFromEmail(e.target.value)} placeholder="luan@elvora.me" className={inputClass} /></Field>
                  </div>
                  <Field label="Calendly URL" hint="Wird als 'Termin vereinbaren' Button gezeigt">
                    <input type="url" value={calendlyUrl} onChange={e => setCalendlyUrl(e.target.value)} placeholder="https://calendly.com/dein-name/15min" className={inputClass} />
                  </Field>
                  <div className="pt-3 mt-3 border-t border-elvora-border">
                    <label className="block text-xs text-elvora-text-dim mb-1.5">Test-Mail senden</label>
                    <div className="flex gap-2">
                      <input type="email" value={testEmailTo} onChange={e => setTestEmailTo(e.target.value)} placeholder="test@deine-email.de" className={`flex-1 ${inputClass}`} />
                      <button onClick={sendTestEmail} disabled={testSending || !testEmailTo || !resendApiKey} className="px-4 py-2 rounded-lg bg-elvora-pink/10 text-elvora-pink text-xs font-medium hover:bg-elvora-pink/20 transition-colors disabled:opacity-50 flex-shrink-0">
                        {testSending ? 'Sende...' : 'Testen'}
                      </button>
                    </div>
                    {testResult && <div className={`mt-2 text-xs font-medium ${testResult.ok ? 'text-elvora-success' : 'text-red-400'}`}>{testResult.message}</div>}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="E-Mail Template" description="Standard-Mail die beim Outreach versendet wird. Platzhalter werden automatisch ersetzt.">
                <PlaceholderHint />
                <div className="space-y-3 mt-3">
                  <Field label="Betreff"><input value={tplSubject} onChange={e => setTplSubject(e.target.value)} className={inputClass} /></Field>
                  <Field label="Intro" hint="Nach 'Guten Tag {ansprechpartner},...'"><textarea value={tplIntro} onChange={e => setTplIntro(e.target.value)} rows={3} className={`${inputClass} resize-none`} /></Field>
                  <Field label="Pitch" hint="Überleitung zu den Problemen"><textarea value={tplPitch} onChange={e => setTplPitch(e.target.value)} rows={2} className={`${inputClass} resize-none`} /></Field>
                  <Field label="Leistungen" hint="Eine pro Zeile"><textarea value={tplLeistungen} onChange={e => setTplLeistungen(e.target.value)} rows={5} className={`${inputClass} resize-none`} /></Field>
                  <Field label="Call-to-Action"><input value={tplCta} onChange={e => setTplCta(e.target.value)} className={inputClass} /></Field>
                </div>
              </SectionCard>

              <SectionCard
                title="Follow-Up Sequenz"
                description="Nach dem Erst-Email werden automatisch Follow-Ups gesendet. Stoppt, wenn Lead antwortet."
                rightAction={
                  <>
                    {followUpStats && (
                      <span className="px-2 py-0.5 rounded-md bg-elvora-accent/10 text-elvora-accent text-[10px] font-semibold mr-2">
                        {followUpStats.pending} ausstehend · {followUpStats.sent} gesendet
                      </span>
                    )}
                    <button onClick={() => setFollowUpEnabled(!followUpEnabled)} className={toggleClass(followUpEnabled)}>
                      <div className={toggleDotClass(followUpEnabled)} />
                    </button>
                  </>
                }
              >
                {followUpEnabled ? (
                  <>
                    <PlaceholderHint />
                    <div className="space-y-3 mt-3">
                      {followUpSequence.map((step, idx) => (
                        <div key={step.step} className="rounded-lg bg-elvora-bg-alt border border-elvora-border p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-elvora-accent/15 text-elvora-accent text-xs font-semibold flex items-center justify-center">{step.step}</span>
                              <span className="text-sm font-medium text-elvora-text">Follow-Up {step.step}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-elvora-text-dim">nach</span>
                              <input type="number" min={1} max={60} value={step.days} onChange={e => {
                                const u = [...followUpSequence]; u[idx] = { ...u[idx], days: parseInt(e.target.value) || 1 }; setFollowUpSequence(u);
                              }} className="w-14 px-2 py-1 rounded-lg bg-elvora-bg border border-elvora-border text-elvora-text text-sm text-center" />
                              <span className="text-xs text-elvora-text-dim">Tagen</span>
                              {followUpSequence.length > 1 && (
                                <button onClick={() => setFollowUpSequence(followUpSequence.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step: i + 1 })))} className="ml-1 text-elvora-text-dim hover:text-red-400">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <input value={step.subject} onChange={e => { const u = [...followUpSequence]; u[idx] = { ...u[idx], subject: e.target.value }; setFollowUpSequence(u); }} placeholder="Betreff" className={inputClass} />
                            <textarea value={step.body} onChange={e => { const u = [...followUpSequence]; u[idx] = { ...u[idx], body: e.target.value }; setFollowUpSequence(u); }} rows={4} placeholder="Text" className={`${inputClass} resize-none`} />
                          </div>
                        </div>
                      ))}
                      {followUpSequence.length < 5 && (
                        <button
                          onClick={() => {
                            const last = followUpSequence[followUpSequence.length - 1];
                            setFollowUpSequence([...followUpSequence, { step: followUpSequence.length + 1, days: (last?.days || 7) + 7, subject: 'Erinnerung: {firmenname}', body: '' }]);
                          }}
                          className="w-full py-2 rounded-lg border border-dashed border-elvora-border text-elvora-text-dim text-xs hover:border-elvora-accent/30 hover:text-elvora-accent transition-colors"
                        >+ Stufe hinzufügen</button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-elvora-text-dim">Auto Follow-Ups deaktiviert.</p>
                )}
              </SectionCard>
            </>
          )}

          {activeTab === 'outreach' && (
            <>
              <SectionCard title="Versand-Defaults" description="Standardwerte für die Outreach-Seite (kann pro Versand überschrieben werden)">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs text-elvora-text-dim">Mails pro Stunde (Standard-Throttle)</label>
                      <span className="text-sm font-mono text-elvora-purple-light">{outreachMailsPerHour}/h</span>
                    </div>
                    <input type="range" min={6} max={600} value={outreachMailsPerHour} onChange={e => setOutreachMailsPerHour(parseInt(e.target.value))} className="w-full accent-elvora-purple" />
                    <div className="flex justify-between text-[10px] text-elvora-text-dim mt-1">
                      <span>6/h (sehr sicher)</span><span>60/h (empfohlen)</span><span>600/h (max)</span>
                    </div>
                  </div>

                  <ToggleRow
                    label="Entscheider-Email bevorzugen"
                    description="Wenn ein Geschäftsführer erkannt wurde, dessen Email statt info@ nutzen"
                    enabled={outreachPreferEntscheider}
                    onToggle={() => setOutreachPreferEntscheider(!outreachPreferEntscheider)}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="Auto-Send nach Analyse"
                description="Automatisch Mail versenden, wenn ein Lead analysiert wurde und unter dem Score liegt"
                rightAction={<button onClick={() => setOutreachAutoSendEnabled(!outreachAutoSendEnabled)} className={toggleClass(outreachAutoSendEnabled)}><div className={toggleDotClass(outreachAutoSendEnabled)} /></button>}
              >
                {outreachAutoSendEnabled ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs text-elvora-text-dim">Max. Score für Auto-Send</label>
                        <span className="text-sm font-mono text-elvora-purple-light">{outreachAutoSendMaxScore}</span>
                      </div>
                      <input type="range" min={0} max={100} value={outreachAutoSendMaxScore} onChange={e => setOutreachAutoSendMaxScore(parseInt(e.target.value))} className="w-full accent-elvora-purple" />
                      <p className="text-[11px] text-elvora-text-dim mt-2">
                        Leads mit Score ≤ <span className="text-elvora-text">{outreachAutoSendMaxScore}</span> bekommen direkt nach der Analyse eine Mail.
                        Leads mit höherem Score werden ignoriert (zu gute Website → kein Bedarf).
                      </p>
                    </div>
                    <div className="mt-4 rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                      <div className="text-[11px] text-amber-300 font-medium mb-1">⚠ Vorsicht</div>
                      <p className="text-[11px] text-elvora-text-dim">
                        Auto-Send ist mächtig aber riskant. Wenn du 500 Leads scrapest, gehen sofort 500 Mails raus.
                        Empfehlung: Erstmal manuell über die Outreach-Seite arbeiten, bis du sicher bist dass dein Template gut konvertiert.
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-elvora-text-dim">Mails werden nur manuell über die Outreach-Seite versendet.</p>
                )}
              </SectionCard>
            </>
          )}

          {activeTab === 'ai' && (
            <>
              <SectionCard
                title="KI-Personalisierung"
                badge="OPENAI" badgeColor="warning"
                description="Jede Erst-Email wird per KI individuell auf den Lead zugeschnitten"
                rightAction={<button onClick={() => setAiEnabled(!aiEnabled)} className={toggleClass(aiEnabled)}><div className={toggleDotClass(aiEnabled)} /></button>}
              >
                {aiEnabled ? (
                  <div className="space-y-3">
                    <Field label="OpenAI API-Key" hint="platform.openai.com/api-keys">
                      <input type="password" value={openaiApiKey} onChange={e => setOpenaiApiKey(e.target.value)} placeholder="sk-..." className={inputMonoClass} />
                    </Field>
                    <Field label="Modell">
                      <select value={aiModel} onChange={e => setAiModel(e.target.value)} className={inputClass}>
                        <option value="gpt-4o-mini" className="bg-elvora-card">GPT-4o Mini (schnell & günstig)</option>
                        <option value="gpt-4o" className="bg-elvora-card">GPT-4o (beste Qualität)</option>
                        <option value="gpt-4.1-mini" className="bg-elvora-card">GPT-4.1 Mini</option>
                        <option value="gpt-4.1-nano" className="bg-elvora-card">GPT-4.1 Nano (am günstigsten)</option>
                      </select>
                    </Field>
                    <div className="pt-3 mt-2 border-t border-elvora-border">
                      <button onClick={testAi} disabled={aiTestLoading || !openaiApiKey} className="px-4 py-2 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 disabled:opacity-50">
                        {aiTestLoading ? 'Generiere...' : 'Test-Personalisierung generieren'}
                      </button>
                      {aiTestResult && (
                        <div className="mt-3">
                          <div className={`text-xs font-medium mb-2 ${aiTestResult.ok ? 'text-elvora-success' : 'text-red-400'}`}>{aiTestResult.message}</div>
                          {aiTestResult.data && (
                            <div className="space-y-2 rounded-lg bg-elvora-bg-alt border border-elvora-border p-3">
                              <div><span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium">Betreff</span><p className="text-xs text-elvora-text mt-0.5">{aiTestResult.data.subject}</p></div>
                              <div><span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium">Intro</span><p className="text-xs text-elvora-text-muted mt-0.5">{aiTestResult.data.intro}</p></div>
                              <div><span className="text-[10px] uppercase tracking-wider text-amber-400/70 font-medium">Pitch</span><p className="text-xs text-elvora-text-muted mt-0.5">{aiTestResult.data.pitch}</p></div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-elvora-text-dim pt-2">Kosten: ca. 0,01-0,03 Cent pro Email (GPT-4o Mini)</p>
                  </div>
                ) : (
                  <p className="text-xs text-elvora-text-dim">KI-Personalisierung deaktiviert. Standard-Template wird verwendet.</p>
                )}
              </SectionCard>

              <SectionCard
                title="Antwort-Klassifizierung"
                description="Eingehende Antworten automatisch analysieren (Interesse, Absage, Frage, Out-of-Office)"
                rightAction={<button onClick={() => setAiClassifyEnabled(!aiClassifyEnabled)} className={toggleClass(aiClassifyEnabled)}><div className={toggleDotClass(aiClassifyEnabled)} /></button>}
              >
                {aiClassifyEnabled ? (
                  <ul className="text-[11px] text-elvora-text-dim space-y-1">
                    <li>· <span className="text-elvora-success">Interesse</span>: Lead → "Meeting"</li>
                    <li>· <span className="text-red-400">Absage/Abmeldung</span>: Lead → "Verloren"</li>
                    <li>· <span className="text-amber-400">Frage</span>: Follow-Ups pausiert, manuelle Antwort empfohlen</li>
                    <li>· <span className="text-elvora-text-dim">Abwesenheit</span>: Follow-Ups pausiert</li>
                  </ul>
                ) : (
                  <p className="text-xs text-elvora-text-dim">Antworten werden nicht automatisch klassifiziert.</p>
                )}
              </SectionCard>
            </>
          )}

          {activeTab === 'scraper' && (
            <>
              <SectionCard title="Web-Suche (SearXNG)" badge="EMPFOHLEN" badgeColor="purple" description="Lokale Metasuchmaschine – unlimitiert & kostenlos. Durchsucht Google, Bing & 70+ Quellen.">
                <div className="space-y-3">
                  <Field label="SearXNG URL"><input value={searxngUrl} onChange={e => setSearxngUrl(e.target.value)} placeholder="http://localhost:8888" className={inputMonoClass} /></Field>
                  <p className="text-[11px] text-elvora-text-dim">
                    SearXNG starten:<br />
                    <code className="bg-white/5 px-1.5 py-0.5 rounded text-[10px]">docker run -d --name searxng -p 8888:8080 searxng/searxng</code>
                  </p>
                  <div className="border-t border-white/5 pt-3 mt-3">
                    <Field label="Brave Search API-Key" hint="Fallback wenn SearXNG nicht läuft – brave.com/search/api (2.000/Monat kostenlos)">
                      <input type="password" value={braveSearchApiKey} onChange={e => setBraveSearchApiKey(e.target.value)} placeholder="BSA..." className={inputMonoClass} />
                    </Field>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Google Maps" badge="PLACES API" badgeColor="blue" description="Für Maps-Scraper. Pay-per-use ($32/1000 Requests)">
                <Field label="Google Maps API-Key">
                  <input type="password" value={googleMapsApiKey} onChange={e => setGoogleMapsApiKey(e.target.value)} placeholder="AIzaSy..." className={inputMonoClass} />
                </Field>
                <p className="text-[11px] text-elvora-text-dim mt-2">Cloud Console → APIs &amp; Services → Credentials → "Places API (New)" aktivieren</p>
              </SectionCard>

              <SectionCard title="DataForSEO" badge="KEYWORD &amp; SERP" badgeColor="emerald" description="Keyword-Recherche und SERP-Analyse für lokale SEO">
                <div className="space-y-3">
                  <Field label="Login (E-Mail)"><input value={dataforseoLogin} onChange={e => setDataforseoLogin(e.target.value)} placeholder="deine@email.de" className={inputMonoClass} /></Field>
                  <Field label="Passwort"><input type="password" value={dataforseoPassword} onChange={e => setDataforseoPassword(e.target.value)} placeholder="API-Passwort" className={inputMonoClass} /></Field>
                  <p className="text-[11px] text-elvora-text-dim">dataforseo.com → Dashboard → API Access</p>
                </div>
              </SectionCard>

              <SectionCard title="LinkedIn Scraper" badge="RAPIDAPI" badgeColor="blue" description="LinkedIn-Profile durchsuchen und E-Mails extrahieren">
                <div className="space-y-3">
                  <Field label="RapidAPI Key"><input type="password" value={rapidapiKey} onChange={e => setRapidapiKey(e.target.value)} placeholder="Dein RapidAPI Key..." className={inputMonoClass} /></Field>
                  <Field label="API Host"><input value={rapidapiLinkedinHost} onChange={e => setRapidapiLinkedinHost(e.target.value)} className={inputMonoClass} /></Field>
                  <p className="text-[11px] text-elvora-text-dim">rapidapi.com → "Fresh LinkedIn Profile Data" abonnieren → Key kopieren</p>
                </div>
              </SectionCard>
            </>
          )}

          {activeTab === 'proposals' && (
            <SectionCard title="Angebots-Vorlagen" description="Wiederverwendbare Pakete für die Angebots-Erstellung im CRM">
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
                          <button onClick={() => startEditTemplate(t)} className="px-2 py-1 rounded text-xs text-elvora-text-dim hover:text-elvora-text hover:bg-white/5">Bearbeiten</button>
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
                  <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Name (z.B. Website Relaunch)" className={`md:col-span-2 ${inputClass}`} />
                  <div className="flex gap-2">
                    <input type="number" value={tplPrice} onChange={e => setTplPrice(e.target.value)} placeholder="Preis" className={`flex-1 ${inputClass}`} />
                    <select value={tplPriceType} onChange={e => setTplPriceType(e.target.value)} className={inputClass} style={{ width: 'auto' }}>
                      <option value="once">Einmalig</option><option value="monthly">Monatlich</option>
                    </select>
                  </div>
                </div>
                <input value={tplDescription} onChange={e => setTplDescription(e.target.value)} placeholder="Kurzbeschreibung (optional)" className={inputClass} />
                <Field label="Leistungen (eine pro Zeile)"><textarea value={tplServices} onChange={e => setTplServices(e.target.value)} rows={4} placeholder={"Responsives Webdesign\nSEO-Optimierung\nSSL & Hosting"} className={`${inputClass} resize-none`} /></Field>
                <div className="flex gap-2">
                  <button onClick={saveTemplate} disabled={tplSaving || !tplName.trim() || !tplPrice} className="px-4 py-2 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple/80 disabled:opacity-50">
                    {tplSaving ? 'Speichert...' : editingTemplate ? 'Aktualisieren' : 'Vorlage erstellen'}
                  </button>
                  {editingTemplate && (
                    <button onClick={() => { setEditingTemplate(null); setTplName(''); setTplPrice(''); setTplPriceType('once'); setTplDescription(''); setTplServices(''); }} className="px-4 py-2 rounded-lg bg-white/5 text-elvora-text-dim text-xs hover:text-elvora-text">Abbrechen</button>
                  )}
                </div>
              </div>
            </SectionCard>
          )}


          {activeTab === 'goals' && (
            <>
              <SectionCard title="Deal-Alterung (Deal Rot)" badge="THRESHOLDS" badgeColor="warning" description="Nach wie vielen Tagen ohne Aktivität ein Deal pro Pipeline-Stage als 'veraltet' gilt. Wird in der Pipeline als Warnung angezeigt.">
                <div className="space-y-3">
                  {DEAL_ROT_STAGES.map(stage => (
                    <div key={stage.key} className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm text-elvora-text">{stage.label}</div>
                        <div className="text-[11px] text-elvora-text-dim">Standard: {stage.defaultVal} Tage</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={dealRotDays[stage.key]}
                          onChange={e => setDealRotDays(prev => ({ ...prev, [stage.key]: parseInt(e.target.value) || stage.defaultVal }))}
                          className="w-20 px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm text-center font-mono focus:outline-none focus:border-elvora-purple/50 transition-colors"
                        />
                        <span className="text-xs text-elvora-text-dim">Tage</span>
                      </div>
                    </div>
                  ))}
                  <p className="text-[11px] text-elvora-text-dim pt-2 border-t border-elvora-border">
                    Diese Schwellwerte werden beim nächsten &quot;Alle Änderungen speichern&quot; mit gespeichert.
                  </p>
                </div>
              </SectionCard>

              <SectionCard title="Tägliche Aktivitäts-Ziele" description="Setze Tagesziele für dein Team. Fortschritt wird im Dashboard angezeigt.">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-elvora-text">Emails</div>
                      <div className="text-[11px] text-elvora-text-dim">Ausgehende Emails pro Tag</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={goalEmails}
                        onChange={e => setGoalEmails(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm text-center font-mono focus:outline-none focus:border-elvora-purple/50 transition-colors"
                      />
                      <span className="text-xs text-elvora-text-dim">/ Tag</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-elvora-text">Anrufe</div>
                      <div className="text-[11px] text-elvora-text-dim">Telefonate pro Tag</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={goalCalls}
                        onChange={e => setGoalCalls(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm text-center font-mono focus:outline-none focus:border-elvora-purple/50 transition-colors"
                      />
                      <span className="text-xs text-elvora-text-dim">/ Tag</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm text-elvora-text">Meetings</div>
                      <div className="text-[11px] text-elvora-text-dim">Termine pro Tag</div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={goalMeetings}
                        onChange={e => setGoalMeetings(parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-sm text-center font-mono focus:outline-none focus:border-elvora-purple/50 transition-colors"
                      />
                      <span className="text-xs text-elvora-text-dim">/ Tag</span>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-elvora-border">
                    <button
                      onClick={saveActivityGoals}
                      disabled={goalsSaving}
                      className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${
                        goalsSaved
                          ? 'bg-elvora-success/15 text-elvora-success border border-elvora-success/20'
                          : 'bg-elvora-purple/10 text-elvora-purple-light hover:bg-elvora-purple/20 border border-elvora-purple/20'
                      } disabled:opacity-50`}
                    >
                      {goalsSaved ? '✓ Ziele gespeichert' : goalsSaving ? 'Speichere...' : 'Aktivitäts-Ziele speichern'}
                    </button>
                    <p className="text-[11px] text-elvora-text-dim mt-2">
                      Aktivitäts-Ziele werden separat gespeichert (nicht über den globalen Speichern-Button).
                    </p>
                  </div>
                </div>
              </SectionCard>
            </>
          )}
          {activeTab === 'integration' && (
            <>
              <SectionCard title="API-Key" badge="ZUGRIFFSKONTROLLE" badgeColor="success" description="Für externe Zugriffe auf das Elvora-System (OpenClaw, Webhooks, etc.)">
                <div className="flex gap-2">
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Sicheren Key eingeben oder generieren..." className={`flex-1 ${inputMonoClass}`} />
                  <button onClick={() => setApiKey(crypto.randomUUID())} className="px-3 py-2 rounded-lg bg-elvora-success/10 text-elvora-success text-xs font-medium hover:bg-elvora-success/20 flex-shrink-0">Generieren</button>
                </div>
              </SectionCard>

              <SectionCard title="OpenClaw" badge="WHATSAPP-NACHFASS" badgeColor="success" description="WhatsApp-Nachfass, Lead-Qualifizierung & AI-Conversations">
                <Field label="OpenClaw Gateway URL"><input type="url" value={openclawUrl} onChange={e => setOpenclawUrl(e.target.value)} placeholder="http://localhost:3100" className={inputClass} /></Field>
              </SectionCard>

              <SectionCard title="API-Endpoints" description="Verfügbare Endpoints für externe Integrationen">
                <div className="space-y-1 text-xs font-mono">
                  {[
                    { method: 'GET', color: 'text-elvora-success bg-elvora-success/10', path: '/api/leads', desc: 'Lead-Liste' },
                    { method: 'PATCH', color: 'text-elvora-warning bg-elvora-warning/10', path: '/api/leads/:id/status', desc: 'Status ändern' },
                    { method: 'POST', color: 'text-elvora-pink bg-elvora-pink/10', path: '/api/email/send', desc: 'Einzel-Mail senden' },
                    { method: 'POST', color: 'text-elvora-pink bg-elvora-pink/10', path: '/api/email/outreach', desc: 'Bulk-Outreach starten' },
                    { method: 'POST', color: 'text-elvora-pink bg-elvora-pink/10', path: '/api/webhooks/openclaw', desc: 'OpenClaw Webhook' },
                    { method: 'POST', color: 'text-elvora-purple-light bg-elvora-purple/10', path: '/api/cron/scan', desc: 'Scan + Follow-Ups' },
                    { method: 'POST', color: 'text-elvora-purple-light bg-elvora-purple/10', path: '/api/analyze', desc: 'Website analysieren' },
                  ].map((ep, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] flex-shrink-0 ${ep.color}`}>{ep.method}</span>
                      <span className="text-elvora-text-muted truncate">{ep.path}</span>
                      <span className="text-elvora-text-dim ml-auto flex-shrink-0">{ep.desc}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {activeTab === 'security' && (
            <>
              <SectionCard title="Panel-Passwort" description="Wird verwendet, um sich im Elvora-Panel einzuloggen">
                <div className="space-y-3">
                  <Field label="Neues Passwort"><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 Zeichen" className={inputClass} /></Field>
                  <Field label="Bestätigen"><input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Nochmal eingeben" className={inputClass} /></Field>
                  {pwResult && <div className={`text-xs font-medium ${pwResult.ok ? 'text-elvora-success' : 'text-red-400'}`}>{pwResult.message}</div>}
                  <button onClick={changePassword} disabled={pwChanging || !newPassword || !confirmNewPassword} className="px-4 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-xs font-medium hover:bg-white/5 disabled:opacity-50">
                    {pwChanging ? 'Ändere...' : 'Passwort ändern'}
                  </button>
                </div>
              </SectionCard>

              <div className="card rounded-xl p-5 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <h3 className="text-sm font-semibold text-red-400">Gefahrenzone</h3>
                </div>
                <p className="text-xs text-elvora-text-dim mb-3">Diese Aktionen sind unwiderruflich. Vor dem Klicken doppelt prüfen.</p>
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">Alle Leads löschen</button>
                  <button className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors">Datenbank zurücksetzen</button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'datenschutz' && (
            <>
              <SectionCard title="Datenschutz-Links" description="Links für Impressum und Datenschutzerklärung auf öffentlichen Seiten">
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Datenschutzerklärung URL" hint="Wird im Footer aller öffentlichen Seiten angezeigt">
                    <input value={privacyPolicyUrl} onChange={e => setPrivacyPolicyUrl(e.target.value)} placeholder="https://deine-website.de/datenschutz" className={inputClass} />
                  </Field>
                  <Field label="Impressum URL">
                    <input value={impressumUrl} onChange={e => setImpressumUrl(e.target.value)} placeholder="https://deine-website.de/impressum" className={inputClass} />
                  </Field>
                </div>
              </SectionCard>

              <SectionCard title="E-Mail-Tracking" description="Tracking-Pixel in ausgehenden E-Mails">
                <ToggleRow
                  label="E-Mail-Tracking aktiviert"
                  description="Wenn deaktiviert, werden keine Tracking-Pixel in ausgehende E-Mails eingebettet"
                  enabled={emailTrackingEnabled}
                  onToggle={() => setEmailTrackingEnabled(!emailTrackingEnabled)}
                />
              </SectionCard>

              <SectionCard title="Datenaufbewahrung" description="Automatische Löschung alter Daten">
                <Field label="Aufbewahrungsdauer (Tage)" hint="Abgelehnte/archivierte Leads älter als diese Anzahl Tage werden bei manueller Bereinigung gelöscht">
                  <input type="number" value={dataRetentionDays} onChange={e => setDataRetentionDays(parseInt(e.target.value) || 365)} min={30} className={inputClass} />
                </Field>
              </SectionCard>

              <SectionCard title="Personendaten-Suche (DSGVO Art. 15 & 17)" description="Alle gespeicherten Daten einer Person finden, exportieren oder löschen">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input value={gdprSearchEmail} onChange={e => setGdprSearchEmail(e.target.value)} placeholder="E-Mail-Adresse oder Lead-ID eingeben" className={`${inputClass} flex-1`} />
                    <button
                      onClick={async () => {
                        if (!gdprSearchEmail.trim()) return;
                        setGdprSearching(true);
                        setGdprSearchResult(null);
                        setGdprDeleteResult(null);
                        try {
                          const isId = /^\d+$/.test(gdprSearchEmail.trim());
                          const q = isId ? `type=lead&id=${gdprSearchEmail.trim()}` : `type=lead&id=0`;
                          const res = await fetch(`/api/gdpr/export?${q}`);
                          if (res.ok) {
                            const data = await res.json();
                            setGdprSearchResult(data);
                          } else {
                            setGdprSearchResult(null);
                            setGdprDeleteResult({ ok: false, message: 'Keine Daten gefunden' });
                          }
                        } catch {
                          setGdprDeleteResult({ ok: false, message: 'Fehler bei der Suche' });
                        } finally {
                          setGdprSearching(false);
                        }
                      }}
                      disabled={gdprSearching || !gdprSearchEmail.trim()}
                      className="px-4 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-xs font-medium hover:bg-white/5 disabled:opacity-50"
                    >
                      {gdprSearching ? 'Suche...' : 'Suchen'}
                    </button>
                  </div>
                  {gdprSearchResult && (
                    <div className="space-y-2">
                      <div className="text-xs text-elvora-success font-medium">Daten gefunden</div>
                      <div className="max-h-48 overflow-auto rounded-lg bg-elvora-bg-alt p-3 text-xs text-elvora-text-dim font-mono">
                        {JSON.stringify(gdprSearchResult.person || gdprSearchResult, null, 2).slice(0, 500)}...
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const blob = new Blob([JSON.stringify(gdprSearchResult, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `dsgvo-export-${Date.now()}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="px-3 py-2 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-xs font-medium hover:bg-white/5"
                        >
                          JSON exportieren
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('ACHTUNG: Alle Daten dieser Person werden unwiderruflich gelöscht. Fortfahren?')) return;
                            setGdprDeleting(true);
                            try {
                              const id = (gdprSearchResult as Record<string, unknown>).person ? ((gdprSearchResult as Record<string, Record<string, unknown>>).person.id as number) : parseInt(gdprSearchEmail);
                              const res = await fetch('/api/gdpr/delete', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ type: 'lead', id }),
                              });
                              const data = await res.json();
                              if (res.ok) {
                                setGdprDeleteResult({ ok: true, message: 'Alle Daten wurden gelöscht.' });
                                setGdprSearchResult(null);
                              } else {
                                setGdprDeleteResult({ ok: false, message: data.error || 'Fehler beim Löschen' });
                              }
                            } catch {
                              setGdprDeleteResult({ ok: false, message: 'Netzwerkfehler' });
                            } finally {
                              setGdprDeleting(false);
                            }
                          }}
                          disabled={gdprDeleting}
                          className="px-3 py-2 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50"
                        >
                          {gdprDeleting ? 'Lösche...' : 'Alle Daten löschen'}
                        </button>
                      </div>
                    </div>
                  )}
                  {gdprDeleteResult && (
                    <div className={`text-xs font-medium ${gdprDeleteResult.ok ? 'text-elvora-success' : 'text-red-400'}`}>
                      {gdprDeleteResult.message}
                    </div>
                  )}
                </div>
              </SectionCard>

              <SectionCard
                title="Audit-Protokoll"
                description="Letzte sicherheitsrelevante Aktionen"
                rightAction={
                  <button
                    onClick={() => {
                      fetch('/api/gdpr/audit-log?limit=50')
                        .then(r => r.json())
                        .then(data => setAuditLog(data.entries || []))
                        .catch(() => {});
                    }}
                    className="px-3 py-1.5 rounded-lg bg-elvora-bg-alt border border-elvora-border text-elvora-text text-xs hover:bg-white/5"
                  >
                    Laden
                  </button>
                }
              >
                {auditLog.length === 0 ? (
                  <p className="text-xs text-elvora-text-dim">Klicke &quot;Laden&quot; um das Audit-Protokoll anzuzeigen.</p>
                ) : (
                  <div className="max-h-64 overflow-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-elvora-text-dim border-b border-elvora-border">
                          <th className="text-left py-1.5 pr-3">Datum</th>
                          <th className="text-left py-1.5 pr-3">Aktion</th>
                          <th className="text-left py-1.5">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLog.map((entry, i) => (
                          <tr key={i} className="border-b border-elvora-border/50">
                            <td className="py-1.5 pr-3 text-elvora-text-dim whitespace-nowrap">{new Date(entry.created_at).toLocaleString('de-DE')}</td>
                            <td className="py-1.5 pr-3 text-elvora-text font-medium">{entry.action}</td>
                            <td className="py-1.5 text-elvora-text-dim truncate max-w-[200px]">{entry.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reusable Components ─────────────────────────────────────────

function SectionCard({
  title, description, badge, badgeColor, rightAction, children,
}: {
  title: string;
  description?: string;
  badge?: string;
  badgeColor?: 'success' | 'warning' | 'blue' | 'emerald' | 'purple';
  rightAction?: ReactNode;
  children: ReactNode;
}) {
  const colorMap = {
    success: 'bg-elvora-success/10 text-elvora-success',
    warning: 'bg-amber-500/10 text-amber-400',
    blue: 'bg-blue-500/10 text-blue-400',
    emerald: 'bg-emerald-500/10 text-emerald-400',
    purple: 'bg-elvora-purple/10 text-elvora-purple-light',
  };
  return (
    <div className="card rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-elvora-text">{title}</h3>
            {badge && <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${colorMap[badgeColor || 'success']}`}>{badge}</span>}
          </div>
          {description && <p className="text-xs text-elvora-text-dim mt-1">{description}</p>}
        </div>
        {rightAction && <div className="flex items-center flex-shrink-0">{rightAction}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, hint, colSpan2, children }: { label: string; hint?: string; colSpan2?: boolean; children: ReactNode }) {
  return (
    <div className={colSpan2 ? 'md:col-span-2' : ''}>
      <label className="block text-xs text-elvora-text-dim mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-elvora-text-dim mt-1">{hint}</p>}
    </div>
  );
}

function ToggleRow({ label, description, enabled, onToggle }: { label: string; description?: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm text-elvora-text">{label}</div>
        {description && <div className="text-[11px] text-elvora-text-dim mt-0.5">{description}</div>}
      </div>
      <button onClick={onToggle} className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-elvora-success' : 'bg-elvora-border'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

function PlaceholderHint() {
  const placeholders = ['{firmenname}', '{ansprechpartner}', '{website}', '{stadt}', '{score}', '{absender}'];
  return (
    <div className="flex flex-wrap gap-1 text-[11px]">
      <span className="text-elvora-text-dim">Platzhalter:</span>
      {placeholders.map(p => <code key={p} className="text-elvora-purple-light bg-elvora-purple/10 px-1.5 py-0.5 rounded">{p}</code>)}
    </div>
  );
}
