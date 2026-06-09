import type { FunnelConfig } from '../src/lib/funnel-config';

const config: FunnelConfig = {
  branding: {
    companyName: 'Müller & Sohn Sanitär',
    primaryColor: '#2563EB',
    accentColor: '#1D4ED8',
    backgroundColor: '#F8FAFC',
    textColor: '#1E293B',
    borderRadius: 12,
  },

  meta: {
    title: 'Kostenlose Beratung — Müller & Sohn Sanitär',
    description: 'Unverbindliche Anfrage in 60 Sekunden. Wir melden uns innerhalb von 2 Stunden.',
    privacyUrl: 'https://mueller-sanitaer.de/datenschutz',
  },

  steps: [
    {
      id: 'leistung',
      type: 'single-choice',
      question: 'Welche Leistung benötigen Sie?',
      description: 'Wählen Sie den Bereich, der am besten passt.',
      options: [
        { value: 'bad-sanierung', label: 'Badsanierung', icon: '🚿', description: 'Komplett- oder Teilsanierung' },
        { value: 'heizung', label: 'Heizung', icon: '🔥', description: 'Installation, Wartung, Austausch' },
        { value: 'rohr-notdienst', label: 'Rohr-Notdienst', icon: '🔧', description: 'Akute Probleme, Rohrbruch' },
        { value: 'solar-waermepumpe', label: 'Solar / Wärmepumpe', icon: '☀️', description: 'Energetische Modernisierung' },
        { value: 'sonstiges', label: 'Sonstiges', icon: '📋' },
      ],
      columns: 2,
    },
    {
      id: 'dringlichkeit',
      type: 'single-choice',
      question: 'Wie dringend ist Ihr Anliegen?',
      options: [
        { value: 'akut', label: 'Akut — so schnell wie möglich', icon: '⚡' },
        { value: 'wochen', label: 'Innerhalb der nächsten Wochen', icon: '📅' },
        { value: 'planen', label: 'Ich plane erst mal', icon: '💡' },
      ],
    },
    {
      id: 'gebaeude',
      type: 'single-choice',
      question: 'Um was für ein Gebäude handelt es sich?',
      options: [
        { value: 'einfamilienhaus', label: 'Einfamilienhaus', icon: '🏠' },
        { value: 'mehrfamilienhaus', label: 'Mehrfamilienhaus', icon: '🏢' },
        { value: 'gewerbe', label: 'Gewerbe', icon: '🏭' },
        { value: 'wohnung', label: 'Eigentumswohnung', icon: '🏬' },
      ],
      columns: 2,
    },
    {
      id: 'budget',
      type: 'single-choice',
      question: 'Haben Sie bereits eine Budgetvorstellung?',
      description: 'Hilft uns, den passenden Umfang vorzuschlagen.',
      options: [
        { value: 'unter-5k', label: 'Unter 5.000 €' },
        { value: '5k-15k', label: '5.000 – 15.000 €' },
        { value: '15k-30k', label: '15.000 – 30.000 €' },
        { value: 'ueber-30k', label: 'Über 30.000 €' },
        { value: 'unklar', label: 'Noch unklar' },
      ],
    },
    {
      id: 'details',
      type: 'textarea',
      question: 'Möchten Sie uns noch etwas mitteilen?',
      description: 'Optional — z. B. besondere Wünsche, vorhandene Ausstattung, Fotos-Link.',
      placeholder: 'Hier können Sie Details zu Ihrem Vorhaben beschreiben...',
      rows: 4,
      required: false,
    },
    {
      id: 'ergebnis',
      type: 'result',
      question: 'Ihre individuelle Einschätzung',
      resultTemplate: 'Basierend auf Ihrer Auswahl ({{leistung}}, {{dringlichkeit}}) können wir Ihnen ein maßgeschneidertes Angebot erstellen. Unser Team für {{gebaeude}}-Projekte meldet sich persönlich bei Ihnen.',
      laborIllusion: {
        enabled: true,
        text: 'Wir prüfen Verfügbarkeit in Ihrer Region...',
        durationMs: 2500,
      },
    },
    {
      id: 'kontakt',
      type: 'contact',
      question: 'Fast geschafft — wohin dürfen wir Ihr Angebot senden?',
      description: 'Ihre Daten werden ausschließlich für diese Anfrage verwendet.',
      fields: {
        name: { required: true, placeholder: 'Vor- und Nachname' },
        email: { required: true, placeholder: 'ihre@email.de' },
        phone: { required: false, placeholder: 'Telefon (optional, für Rückruf)' },
        preferredTime: { required: false, placeholder: 'z. B. Mo–Fr 9–17 Uhr' },
      },
    },
  ],

  trust: {
    position: 'both',
    elements: [
      { type: 'stat', value: '500+', label: 'Projekte abgeschlossen' },
      { type: 'stat', value: '4.9', label: 'Google-Bewertung' },
      { type: 'badge', icon: '✓', text: 'Meisterbetrieb seit 1987' },
      { type: 'review', name: 'Thomas K.', stars: 5, reviewText: 'Schnell, sauber, fair. Absolut empfehlenswert!' },
      { type: 'review', name: 'Sandra M.', stars: 5, reviewText: 'Badsanierung top — pünktlich und im Budget geblieben.' },
    ],
  },

  scarcity: {
    enabled: true,
    text: 'Aktuell hohe Nachfrage — 3 freie Termine diese Woche',
  },

  submitButton: {
    label: 'Kostenloses Angebot anfordern',
    microcopy: 'Unverbindlich · Keine Kosten · Antwort in unter 2 Stunden',
  },

  thankYou: {
    headline: 'Vielen Dank, {{name}}!',
    body: 'Ihre Anfrage zu {{leistung}} ist bei uns eingegangen. Ein Fachberater wird sich persönlich bei Ihnen melden, um die nächsten Schritte zu besprechen.',
    responseTime: 'Innerhalb von 2 Stunden (Mo–Sa, 7–19 Uhr)',
    extra: {
      label: 'Unsere Referenzen ansehen',
      url: 'https://mueller-sanitaer.de/referenzen',
    },
  },

  notify: {
    email: 'info@mueller-sanitaer.de',
    webhookUrl: 'https://hooks.zapier.com/hooks/catch/123/abc',
    confirmationEmail: {
      subject: 'Ihre Anfrage bei Müller & Sohn Sanitär',
      body: 'Hallo {{name}},\n\nvielen Dank für Ihre Anfrage zu {{leistung}}. Wir haben alles erhalten und melden uns in Kürze.\n\nMit freundlichen Grüßen\nIhr Team von Müller & Sohn Sanitär',
    },
  },

  retentionDays: 90,

  spam: {
    honeypot: true,
    minSubmitTimeMs: 3000,
    rateLimit: { maxPerHour: 5, maxPerDay: 15 },
  },
};

export default config;
