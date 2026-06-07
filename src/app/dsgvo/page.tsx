'use client';

import { useState, useEffect, useCallback } from 'react';

type Tab = 'overview' | 'generator' | 'avv' | 'data' | 'retention';

export default function DsgvoPage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [retentionStats, setRetentionStats] = useState<Record<string, number> | null>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<Record<string, unknown[]> | null>(null);
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<Record<string, number> | null>(null);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<Record<string, number> | null>(null);
  const [copiedText, setCopiedText] = useState('');

  // Generator state
  const [gen, setGen] = useState({
    company_name: '',
    company_address: '',
    company_email: '',
    company_phone: '',
    company_ceo: '',
    website_url: '',
    hosting_provider: 'Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen',
    uses_chat: true,
    uses_booking: true,
    uses_forms: true,
    uses_reviews: true,
    uses_analytics: false,
    analytics_provider: '',
    dsb_name: '',
    dsb_email: '',
  });

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      const s: Record<string, string> = {};
      for (const item of (data.settings || [])) s[item.key] = item.value;
      setSettings(s);
      setGen(prev => ({
        ...prev,
        company_name: s.agency_name || prev.company_name,
        company_address: s.agency_address || prev.company_address,
        company_email: s.agency_email || prev.company_email,
        company_phone: s.agency_phone || prev.company_phone,
      }));
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  async function loadRetention() {
    try {
      const res = await fetch('/api/dsgvo?action=retention_stats');
      const data = await res.json();
      setRetentionStats(data.stats || null);
    } catch {}
  }

  async function searchData() {
    if (!searchEmail.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setDeleteResult(null);
    try {
      const res = await fetch(`/api/dsgvo?action=export&email=${encodeURIComponent(searchEmail.trim())}`);
      const data = await res.json();
      setSearchResult(data.data || {});
    } catch {} finally { setSearching(false); }
  }

  async function deleteData() {
    if (!searchEmail.trim() || !confirm(`ACHTUNG: Alle Daten fuer "${searchEmail}" werden unwiderruflich geloescht. Fortfahren?`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/dsgvo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_by_email', email: searchEmail.trim() }),
      });
      const data = await res.json();
      setDeleteResult(data.deleted || {});
      setSearchResult(null);
    } catch {} finally { setDeleting(false); }
  }

  async function runCleanup() {
    if (!confirm('Alte Daten gemaess Aufbewahrungsfrist loeschen?')) return;
    setCleaningUp(true);
    try {
      const res = await fetch('/api/dsgvo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup_old' }),
      });
      const data = await res.json();
      setCleanupResult(data.deleted || {});
      loadRetention();
    } catch {} finally { setCleaningUp(false); }
  }

  async function anonymizeIps() {
    await fetch('/api/dsgvo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'anonymize_ip' }),
    });
    alert('IP-Adressen wurden anonymisiert.');
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  }

  function generatePrivacyPolicy(): string {
    const g = gen;
    let text = `DATENSCHUTZERKLAERUNG

Stand: ${new Date().toLocaleDateString('de-DE')}

1. VERANTWORTLICHER

${g.company_name}
${g.company_address}
E-Mail: ${g.company_email}
${g.company_phone ? `Telefon: ${g.company_phone}` : ''}
${g.company_ceo ? `Geschaeftsfuehrer: ${g.company_ceo}` : ''}
${g.dsb_name ? `\nDatenschutzbeauftragter: ${g.dsb_name}\nE-Mail: ${g.dsb_email}` : ''}

2. ALLGEMEINES ZUR DATENVERARBEITUNG

Wir verarbeiten personenbezogene Daten unserer Nutzer grundsaetzlich nur, soweit dies zur Bereitstellung einer funktionsfaehigen Website sowie unserer Inhalte und Leistungen erforderlich ist. Die Verarbeitung personenbezogener Daten unserer Nutzer erfolgt regelmaessig nur nach Einwilligung des Nutzers. Eine Ausnahme gilt in solchen Faellen, in denen eine vorherige Einholung einer Einwilligung aus tatsaechlichen Gruenden nicht moeglich ist und die Verarbeitung der Daten durch gesetzliche Vorschriften gestattet ist.

Rechtsgrundlage: Art. 6 Abs. 1 lit. a, b, f DSGVO

3. HOSTING

Diese Website wird gehostet bei:
${g.hosting_provider}

Der Hoster erhebt in sog. Logfiles folgende Daten, die Ihr Browser uebermittelt: IP-Adresse, Datum und Uhrzeit der Anfrage, Zeitzonendifferenz zur Greenwich Mean Time, Inhalt der Anforderung, HTTP-Statuscode, uebertragene Datenmenge, Website von der die Anforderung kommt und Informationen zu Browser und Betriebssystem.

Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der sicheren Bereitstellung der Website)

4. SSL-/TLS-VERSCHLUESSELUNG

Diese Seite nutzt aus Sicherheitsgruenden eine SSL-/TLS-Verschluesselung. Eine verschluesselte Verbindung erkennen Sie daran, dass die Adresszeile des Browsers von "http://" auf "https://" wechselt.

5. COOKIES UND EINWILLIGUNG

Diese Website verwendet technisch notwendige Cookies. Optionale Cookies (z.B. fuer eingebettete Widgets) werden erst nach Ihrer ausdruecklichen Einwilligung gesetzt. Sie koennen Ihre Einwilligung jederzeit ueber den Cookie-Banner widerrufen.

Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung)`;

    if (g.uses_forms) {
      text += `

6. KONTAKTFORMULAR

Wenn Sie uns per Kontaktformular Anfragen zukommen lassen, werden Ihre Angaben aus dem Formular inklusive der von Ihnen dort angegebenen Kontaktdaten zwecks Bearbeitung der Anfrage und fuer den Fall von Anschlussfragen bei uns gespeichert.

Folgende Daten werden erhoben:
- Name
- E-Mail-Adresse
- Telefonnummer (optional)
- Ihre Nachricht
- Seiten-URL (technisch)

Die Daten werden nicht ohne Ihre Einwilligung weitergegeben. Die Verarbeitung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung). Ihre Daten werden nach Abschluss der Bearbeitung geloescht, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.

Aufbewahrungsfrist: ${settings.data_retention_days || '365'} Tage nach letztem Kontakt`;
    }

    if (g.uses_booking) {
      text += `

${g.uses_forms ? '7' : '6'}. TERMINBUCHUNG

Fuer die Online-Terminbuchung erheben wir folgende Daten:
- Name
- E-Mail-Adresse
- Telefonnummer (optional)
- Gewuenschtes Datum und Uhrzeit
- Optionale Nachricht

Diese Daten werden ausschliesslich zur Terminvereinbarung und -verwaltung verwendet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragsanbahnung/Vertragsdurchfuehrung).

Die Daten werden nach Ablauf der gesetzlichen Aufbewahrungsfrist geloescht.`;
    }

    if (g.uses_chat) {
      const secNum = (g.uses_forms ? 1 : 0) + (g.uses_booking ? 1 : 0) + 6;
      text += `

${secNum}. LIVE-CHAT / KI-CHATBOT

Auf dieser Website wird ein Chat-Widget eingesetzt. Bei Nutzung des Chats werden folgende Daten verarbeitet:
- Name (freiwillige Angabe)
- E-Mail-Adresse (freiwillige Angabe)
- Chat-Nachrichten und deren Inhalte
- Besuchte Seite (technisch)
- Zeitstempel

Der Chat kann teilweise durch kuenstliche Intelligenz (KI) unterstuetzt werden. Dabei werden Ihre Nachrichten an den Dienst OpenAI (OpenAI LLC, San Francisco, USA) uebermittelt, um automatisierte Antworten zu generieren. OpenAI verarbeitet die Daten gemaess deren Datenschutzrichtlinie und den Standardvertragsklauseln (SCCs) fuer Datenuebermittlungen in Drittlaender.

Die Chat-Daten werden auf unseren Servern in Deutschland gespeichert.

Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO (Einwilligung durch Nutzung des Chats)
Bei KI-Verarbeitung: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an effizientem Kundensupport)

Aufbewahrungsfrist: ${settings.data_retention_days || '365'} Tage`;
    }

    if (g.uses_reviews) {
      const secNum = (g.uses_forms ? 1 : 0) + (g.uses_booking ? 1 : 0) + (g.uses_chat ? 1 : 0) + 6;
      text += `

${secNum}. BEWERTUNGEN

Auf dieser Website werden Kundenbewertungen angezeigt. Dabei werden folgende Daten oeffentlich dargestellt:
- Vorname und erster Buchstabe des Nachnamens
- Bewertungstext
- Sternebewertung
- Datum der Bewertung

Die Veroeffentlichung erfolgt nur mit ausdruecklicher Einwilligung der bewertenden Person. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO.`;
    }

    text += `

IHRE RECHTE

Sie haben gegenueber uns folgende Rechte hinsichtlich der Sie betreffenden personenbezogenen Daten:

- Recht auf Auskunft (Art. 15 DSGVO)
- Recht auf Berichtigung (Art. 16 DSGVO)
- Recht auf Loeschung (Art. 17 DSGVO)
- Recht auf Einschraenkung der Verarbeitung (Art. 18 DSGVO)
- Recht auf Datenuebertragbarkeit (Art. 20 DSGVO)
- Recht auf Widerspruch (Art. 21 DSGVO)
- Recht auf Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO)
- Beschwerderecht bei einer Aufsichtsbehoerde (Art. 77 DSGVO)

Zur Ausuebung Ihrer Rechte kontaktieren Sie uns unter: ${g.company_email}

AENDERUNG DIESER DATENSCHUTZERKLAERUNG

Wir behalten uns vor, diese Datenschutzerklaerung anzupassen, damit sie stets den aktuellen rechtlichen Anforderungen entspricht oder um Aenderungen unserer Leistungen in der Datenschutzerklaerung umzusetzen.`;

    return text;
  }

  function generateAVV(): string {
    const g = gen;
    return `AUFTRAGSVERARBEITUNGSVERTRAG (AVV)
gemaess Art. 28 DSGVO

zwischen

${g.company_name} (nachfolgend "Auftragsverarbeiter")
${g.company_address}

und

[KUNDENNAME] (nachfolgend "Verantwortlicher")
[KUNDENADRESSE]

§ 1 GEGENSTAND UND DAUER

(1) Der Auftragsverarbeiter verarbeitet personenbezogene Daten im Auftrag des Verantwortlichen im Rahmen der Bereitstellung folgender Dienste:
${g.uses_chat ? '- Live-Chat / KI-Chatbot Widget\n' : ''}${g.uses_forms ? '- Kontaktformular Widget\n' : ''}${g.uses_booking ? '- Terminbuchungs Widget\n' : ''}${g.uses_reviews ? '- Bewertungs Widget\n' : ''}- Website-Hosting und -Betrieb

(2) Die Dauer dieses Vertrags entspricht der Laufzeit des Hauptvertrags.

§ 2 ART UND ZWECK DER VERARBEITUNG

Die Verarbeitung umfasst folgende Taetigkeiten:
- Speicherung und Verwaltung von Kontaktanfragen
- Verwaltung von Terminbuchungen
- Bereitstellung und Betrieb von Chat-Funktionen
- Anzeige von Kundenbewertungen
- Zustellung von E-Mail-Benachrichtigungen

§ 3 ART DER PERSONENBEZOGENEN DATEN

Folgende Datenkategorien werden verarbeitet:
- Kontaktdaten (Name, E-Mail, Telefon)
- Kommunikationsinhalte (Chat-Nachrichten, Formularnachrichten)
- Terminbuchungsdaten (Datum, Uhrzeit, Anliegen)
- Bewertungsdaten (Name, Bewertungstext, Sternebewertung)
- Technische Daten (IP-Adresse, besuchte Seiten, Zeitstempel)

§ 4 KATEGORIEN BETROFFENER PERSONEN

- Website-Besucher
- Kunden und Interessenten des Verantwortlichen
- Personen, die den Chat, Kontaktformulare oder Terminbuchung nutzen

§ 5 PFLICHTEN DES AUFTRAGSVERARBEITERS

(1) Der Auftragsverarbeiter verarbeitet personenbezogene Daten ausschliesslich auf dokumentierte Weisung des Verantwortlichen.

(2) Der Auftragsverarbeiter gewaehrleistet, dass sich die zur Verarbeitung befugten Personen zur Vertraulichkeit verpflichtet haben.

(3) Der Auftragsverarbeiter trifft alle erforderlichen technischen und organisatorischen Massnahmen gemaess Art. 32 DSGVO, insbesondere:
- SSL/TLS-Verschluesselung aller Datenubertragungen
- Regelmaessige Backups
- Zugangskontrollen und Authentifizierung
- Serverstandort in Deutschland/EU
- Anonymisierung von IP-Adressen nach 7 Tagen
- Automatische Loeschung nach Aufbewahrungsfrist (${settings.data_retention_days || '365'} Tage)

(4) Der Auftragsverarbeiter unterstuetzt den Verantwortlichen bei der Einhaltung der Betroffenenrechte (Art. 15-22 DSGVO).

§ 6 UNTERAUFTRAGSVERARBEITER

Folgende Unterauftragsverarbeiter werden eingesetzt:
- ${g.hosting_provider} (Server-Hosting)
${g.uses_chat ? '- OpenAI LLC, San Francisco, USA (KI-Chatbot, nur bei aktivierter KI-Funktion, SCCs vorhanden)\n' : ''}- Hetzner Cloud (Backup-Speicher, Deutschland)

Aenderungen werden dem Verantwortlichen vorab mitgeteilt.

§ 7 LOESCHUNG UND RUECKGABE

Nach Beendigung des Auftrags werden alle personenbezogenen Daten geloescht oder zurueckgegeben, sofern keine gesetzliche Aufbewahrungspflicht besteht.

§ 8 KONTAKT

Bei Fragen zu diesem AVV:
${g.company_email}


Ort, Datum: ___________________

Unterschrift Auftragsverarbeiter: ___________________

Unterschrift Verantwortlicher: ___________________`;
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-elvora-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">DSGVO & Datenschutz</h1>
          <p className="text-sm text-elvora-text-dim mt-0.5">Datenschutz-Tools, Generatoren und Compliance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {([
            { key: 'overview' as Tab, label: 'Uebersicht' },
            { key: 'generator' as Tab, label: 'Datenschutz' },
            { key: 'avv' as Tab, label: 'AVV' },
            { key: 'data' as Tab, label: 'Datenauskunft' },
            { key: 'retention' as Tab, label: 'Aufbewahrung' },
          ]).map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'retention') loadRetention(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === t.key ? 'bg-elvora-primary/20 text-elvora-primary-light border border-elvora-primary/30' : 'bg-elvora-bg-alt text-elvora-text-dim border border-elvora-border hover:border-elvora-border-light'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { title: 'Consent-Modus', desc: 'Alle Embed-Widgets unterstuetzen data-consent="required". Widgets laden erst nach Cookie-Einwilligung.', status: 'aktiv', color: 'bg-elvora-success/15 text-elvora-success' },
              { title: 'SSL-Verschluesselung', desc: 'Alle Daten werden verschluesselt uebertragen (HTTPS).', status: 'aktiv', color: 'bg-elvora-success/15 text-elvora-success' },
              { title: 'IP-Anonymisierung', desc: 'IP-Adressen in Formular-Einsendungen werden nach 7 Tagen anonymisiert.', status: 'aktiv', color: 'bg-elvora-success/15 text-elvora-success' },
              { title: 'Aufbewahrungsfrist', desc: `Daten werden nach ${settings.data_retention_days || '365'} Tagen automatisch geloescht.`, status: `${settings.data_retention_days || '365'} Tage`, color: 'bg-elvora-purple/15 text-elvora-purple-light' },
              { title: 'Datenschutz-Checkbox', desc: 'Kontaktformulare enthalten eine Pflicht-Checkbox zur Einwilligung.', status: 'aktiv', color: 'bg-elvora-success/15 text-elvora-success' },
              { title: 'KI-Hinweis', desc: 'Bei aktiviertem KI-Chat wird auf OpenAI-Verarbeitung hingewiesen.', status: 'in DSE', color: 'bg-elvora-purple/15 text-elvora-purple-light' },
            ].map((item, i) => (
              <div key={i} className="card rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="text-[11px] text-elvora-text-dim mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium flex-shrink-0 ${item.color}`}>{item.status}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Embed-Widgets DSGVO-konform einbinden</h3>
            <p className="text-xs text-elvora-text-dim mb-3">Alle Widgets unterstuetzen den Consent-Modus. Fuegen Sie <code className="text-elvora-purple-light">data-consent=&quot;required&quot;</code> hinzu:</p>
            <pre className="bg-elvora-bg rounded-lg p-3 text-xs text-elvora-text-muted font-mono overflow-x-auto border border-elvora-border whitespace-pre-wrap">
{`<!-- Chat-Widget mit Consent -->
<script src="/elvora-chat.js" data-widget-id="1" data-url="https://..."
  data-consent="required" data-privacy-url="/datenschutz"></script>

<!-- Kontaktformular mit Consent -->
<div id="elvora-form"></div>
<script src="/elvora-form.js" data-url="https://..." data-slug="kontakt"
  data-consent="required" data-privacy-url="/datenschutz"></script>

<!-- Bewertungen mit Consent -->
<div id="elvora-reviews"></div>
<script src="/elvora-reviews.js" data-url="https://..." data-slug="default"
  data-consent="required"></script>`}
            </pre>
          </div>
        </div>
      )}

      {/* Privacy Policy Generator */}
      {tab === 'generator' && (
        <div className="grid grid-cols-[350px,1fr] gap-4">
          <div className="card rounded-xl p-5 space-y-3 self-start">
            <h3 className="text-sm font-semibold text-white mb-1">Angaben</h3>
            {[
              { key: 'company_name', label: 'Firmenname', placeholder: 'Elvora Digital GmbH' },
              { key: 'company_address', label: 'Adresse', placeholder: 'Musterstr. 1, 45127 Essen' },
              { key: 'company_email', label: 'E-Mail', placeholder: 'info@elvora.de' },
              { key: 'company_phone', label: 'Telefon', placeholder: '+49 201 123456' },
              { key: 'company_ceo', label: 'Geschaeftsfuehrer', placeholder: 'Max Mustermann' },
              { key: 'website_url', label: 'Website', placeholder: 'https://example.de' },
              { key: 'hosting_provider', label: 'Hosting-Anbieter', placeholder: 'Hetzner Online GmbH' },
              { key: 'dsb_name', label: 'Datenschutzbeauftragter (optional)', placeholder: '' },
              { key: 'dsb_email', label: 'DSB E-Mail (optional)', placeholder: '' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-[11px] text-elvora-text-dim mb-0.5">{f.label}</label>
                <input type="text" value={(gen as Record<string, unknown>)[f.key] as string || ''} onChange={e => setGen({ ...gen, [f.key]: e.target.value })} placeholder={f.placeholder}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-elvora-bg border border-elvora-border text-white text-xs focus:outline-none focus:border-elvora-purple/50" />
              </div>
            ))}
            <div className="pt-2 space-y-1.5">
              <label className="block text-[11px] text-elvora-text-dim">Aktive Widgets</label>
              {[
                { key: 'uses_chat', label: 'Live-Chat / KI-Chatbot' },
                { key: 'uses_booking', label: 'Terminbuchung' },
                { key: 'uses_forms', label: 'Kontaktformulare' },
                { key: 'uses_reviews', label: 'Bewertungen' },
              ].map(w => (
                <label key={w.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={(gen as Record<string, unknown>)[w.key] as boolean} onChange={e => setGen({ ...gen, [w.key]: e.target.checked })}
                    className="w-3.5 h-3.5 rounded border-elvora-border accent-elvora-purple" />
                  <span className="text-xs text-elvora-text-muted">{w.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="card rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Generierte Datenschutzerklaerung</h3>
              <button onClick={() => copyText(generatePrivacyPolicy(), 'dse')}
                className="text-xs text-elvora-purple-light hover:text-white transition-colors flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copiedText === 'dse' ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'} />
                </svg>
                {copiedText === 'dse' ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>
            <pre className="bg-elvora-bg rounded-xl p-4 text-xs text-elvora-text-muted font-mono overflow-y-auto border border-elvora-border whitespace-pre-wrap leading-relaxed" style={{ maxHeight: 'calc(100vh - 300px)' }}>
              {generatePrivacyPolicy()}
            </pre>
          </div>
        </div>
      )}

      {/* AVV Generator */}
      {tab === 'avv' && (
        <div className="card rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Auftragsverarbeitungsvertrag (AVV)</h3>
              <p className="text-[11px] text-elvora-text-dim mt-0.5">Gemaess Art. 28 DSGVO — fuer jeden Kunden erforderlich</p>
            </div>
            <button onClick={() => copyText(generateAVV(), 'avv')}
              className="px-3 py-1.5 rounded-lg bg-elvora-purple text-white text-xs font-medium hover:bg-elvora-purple/80 transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copiedText === 'avv' ? 'M5 13l4 4L19 7' : 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'} />
              </svg>
              {copiedText === 'avv' ? 'Kopiert!' : 'AVV kopieren'}
            </button>
          </div>
          <pre className="bg-elvora-bg rounded-xl p-4 text-xs text-elvora-text-muted font-mono overflow-y-auto border border-elvora-border whitespace-pre-wrap leading-relaxed" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            {generateAVV()}
          </pre>
          <p className="text-[10px] text-elvora-text-dim/50 mt-3">Hinweis: Dieser AVV dient als Vorlage. Lassen Sie ihn ggf. von einem Anwalt pruefen.</p>
        </div>
      )}

      {/* Data Search & Delete */}
      {tab === 'data' && (
        <div className="space-y-4">
          <div className="card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Datenauskunft & Loeschung (Art. 15 & 17 DSGVO)</h3>
            <div className="flex items-center gap-2 mb-4">
              <input type="email" value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="E-Mail-Adresse eingeben..."
                className="flex-1 px-3 py-2.5 rounded-lg bg-elvora-bg border border-elvora-border text-white text-sm focus:outline-none focus:border-elvora-purple/50"
                onKeyDown={e => e.key === 'Enter' && searchData()} />
              <button onClick={searchData} disabled={searching || !searchEmail.trim()}
                className="px-4 py-2.5 rounded-lg bg-elvora-purple text-white text-sm font-medium hover:bg-elvora-purple/80 disabled:opacity-40 transition-colors">
                {searching ? 'Suche...' : 'Daten suchen'}
              </button>
            </div>

            {searchResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-white">Gefundene Daten fuer: {searchEmail}</h4>
                  <button onClick={deleteData} disabled={deleting}
                    className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 border border-red-500/20 transition-colors flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    {deleting ? 'Loesche...' : 'Alle Daten loeschen'}
                  </button>
                </div>
                {Object.entries(searchResult).map(([table, rows]) => (
                  <div key={table} className="bg-elvora-bg rounded-lg p-3 border border-elvora-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-white">{table}</span>
                      <span className="text-[10px] text-elvora-text-dim">({(rows as unknown[]).length} Eintraege)</span>
                    </div>
                    {(rows as unknown[]).length > 0 ? (
                      <pre className="text-[10px] text-elvora-text-dim font-mono overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {JSON.stringify(rows, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-[10px] text-elvora-text-dim">Keine Daten</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {deleteResult && (
              <div className="mt-4 p-4 rounded-xl bg-elvora-success/10 border border-elvora-success/20">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-4 h-4 text-elvora-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm font-medium text-elvora-success">Daten geloescht</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(deleteResult).map(([table, count]) => (
                    <div key={table} className="text-xs text-elvora-text-dim">
                      {table}: <span className="text-white font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-2">Datenexport (Art. 20 DSGVO)</h3>
            <p className="text-xs text-elvora-text-dim mb-3">Suchen Sie oben nach einer E-Mail-Adresse. Die angezeigten Daten koennen als JSON exportiert werden.</p>
            {searchResult && (
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(searchResult, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `dsgvo-export-${searchEmail}.json`; a.click();
                URL.revokeObjectURL(url);
              }} className="px-4 py-2 rounded-lg bg-elvora-surface text-white text-xs font-medium border border-elvora-border hover:border-elvora-border-light transition-colors">
                Als JSON herunterladen
              </button>
            )}
          </div>
        </div>
      )}

      {/* Retention */}
      {tab === 'retention' && (
        <div className="space-y-4">
          <div className="card rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Aufbewahrungsfristen</h3>
            <p className="text-xs text-elvora-text-dim mb-4">
              Aktuelle Aufbewahrungsfrist: <span className="text-white font-medium">{settings.data_retention_days || '365'} Tage</span>.
              Daten aelter als diese Frist koennen automatisch geloescht werden.
            </p>

            {retentionStats ? (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {Object.entries(retentionStats).map(([key, count]) => (
                  <div key={key} className="bg-elvora-bg rounded-lg p-3 border border-elvora-border">
                    <div className="text-xs text-elvora-text-dim">{key}</div>
                    <div className={`text-xl font-bold mt-1 ${count > 0 ? 'text-elvora-warning' : 'text-elvora-success'}`}>{count}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-elvora-text-dim mb-4">Lade Statistiken...</div>
            )}

            <div className="flex items-center gap-3">
              <button onClick={runCleanup} disabled={cleaningUp}
                className="px-4 py-2 rounded-lg bg-elvora-warning/10 text-elvora-warning text-xs font-medium border border-elvora-warning/20 hover:bg-elvora-warning/20 transition-colors disabled:opacity-40">
                {cleaningUp ? 'Loesche...' : 'Alte Daten bereinigen'}
              </button>
              <button onClick={anonymizeIps}
                className="px-4 py-2 rounded-lg bg-elvora-surface text-elvora-text-muted text-xs font-medium border border-elvora-border hover:border-elvora-border-light transition-colors">
                IPs anonymisieren
              </button>
            </div>

            {cleanupResult && (
              <div className="mt-4 p-3 rounded-lg bg-elvora-success/10 border border-elvora-success/20">
                <span className="text-xs text-elvora-success">Bereinigung abgeschlossen:</span>
                <div className="flex gap-4 mt-1">
                  {Object.entries(cleanupResult).map(([key, count]) => (
                    <span key={key} className="text-xs text-elvora-text-dim">{key}: <span className="text-white">{count}</span></span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
