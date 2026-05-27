'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface Account {
  id: number;
  name: string;
  company: string | null;
  contact_name: string | null;
  contact_email: string | null;
  icp_description: string | null;
  icp_industries: string;
  icp_locations: string;
  icp_company_sizes: string;
}

interface Domain {
  id: number;
  domain: string;
  status: string;
}

const STEPS = [
  { key: 'icp', label: 'Zielgruppe definieren' },
  { key: 'domains', label: 'Domains verbinden' },
  { key: 'blacklist', label: 'Blacklist einrichten' },
  { key: 'review', label: 'Überprüfen & Starten' },
];

const INDUSTRIES = [
  'Handwerk', 'Gastronomie', 'Einzelhandel', 'E-Commerce', 'Immobilien',
  'Beratung', 'IT & Software', 'Gesundheit', 'Finanzen', 'Bildung',
  'Logistik', 'Produktion', 'Marketing', 'Recht', 'Architektur',
];

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '500+'];

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get('id');

  const [step, setStep] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ICP state
  const [icpDesc, setIcpDesc] = useState('');
  const [icpIndustries, setIcpIndustries] = useState<string[]>([]);
  const [icpLocations, setIcpLocations] = useState('');
  const [icpSizes, setIcpSizes] = useState<string[]>([]);

  // Domain state
  const [domainInput, setDomainInput] = useState('');
  const [domains, setDomains] = useState<Domain[]>([]);
  const [addingDomain, setAddingDomain] = useState(false);

  // Blacklist state
  const [blacklistInput, setBlacklistInput] = useState('');
  const [blacklistCount, setBlacklistCount] = useState(0);

  useEffect(() => {
    if (!accountId) return;
    fetch(`/api/accounts/${accountId}`)
      .then(r => r.json())
      .then(data => {
        setAccount(data);
        setIcpDesc(data.icp_description || '');
        try { setIcpIndustries(JSON.parse(data.icp_industries || '[]')); } catch { setIcpIndustries([]); }
        try {
          const locs = JSON.parse(data.icp_locations || '[]');
          setIcpLocations(locs.join(', '));
        } catch { setIcpLocations(''); }
        try { setIcpSizes(JSON.parse(data.icp_company_sizes || '[]')); } catch { setIcpSizes([]); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    fetch(`/api/outbound/domains?account_id=${accountId}`)
      .then(r => r.json())
      .then(data => setDomains(data.domains || []))
      .catch(() => {});
    fetch(`/api/accounts/${accountId}/blacklist`)
      .then(r => r.json())
      .then(data => setBlacklistCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {});
  }, [accountId]);

  const saveIcp = async () => {
    if (!accountId) return;
    setSaving(true);
    await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        icp_description: icpDesc,
        icp_industries: JSON.stringify(icpIndustries),
        icp_locations: JSON.stringify(icpLocations.split(',').map(s => s.trim()).filter(Boolean)),
        icp_company_sizes: JSON.stringify(icpSizes),
      }),
    });
    setSaving(false);
    setStep(1);
  };

  const addDomain = async () => {
    if (!accountId || !domainInput.trim()) return;
    setAddingDomain(true);
    const res = await fetch('/api/outbound/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: domainInput.trim(), account_id: Number(accountId), daily_limit: 50 }),
    });
    if (res.ok) {
      const data = await res.json();
      setDomains(prev => [...prev, data.domain]);
      setDomainInput('');
    }
    setAddingDomain(false);
  };

  const addBlacklist = async () => {
    if (!accountId || !blacklistInput.trim()) return;
    const emails = blacklistInput.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
    const res = await fetch(`/api/accounts/${accountId}/blacklist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emails }),
    });
    if (res.ok) {
      const data = await res.json();
      setBlacklistCount(prev => prev + data.added);
      setBlacklistInput('');
    }
  };

  const completeOnboarding = async () => {
    if (!accountId) return;
    setSaving(true);
    await fetch(`/api/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_completed: 1, status: 'active' }),
    });
    setSaving(false);
    router.push('/accounts');
  };

  if (!accountId) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card-glass p-8 rounded-xl text-center">
          <p className="text-elvora-text-muted">Keine Konto-ID angegeben. Gehe zu <a href="/accounts" className="text-elvora-accent">Konten</a> und starte Onboarding von dort.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-6 max-w-3xl mx-auto text-elvora-text-muted text-center py-12">Laden...</div>;
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Onboarding: {account?.name}</h1>
        <p className="text-elvora-text-muted text-sm mt-1">Schritt {step + 1} von {STEPS.length}</p>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex-1">
            <div className={`h-1.5 rounded-full transition-all ${i <= step ? 'bg-elvora-accent' : 'bg-white/10'}`} />
            <p className={`text-xs mt-1 ${i === step ? 'text-white' : 'text-elvora-text-muted'}`}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Step 0: ICP */}
      {step === 0 && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white">Ideal Customer Profile (ICP)</h2>
          <p className="text-elvora-text-muted text-sm">Beschreibe die Zielgruppe für diesen Kunden.</p>

          <textarea placeholder="Beschreibung der Zielgruppe..." value={icpDesc} onChange={e => setIcpDesc(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted h-24" />

          <div>
            <label className="text-sm text-elvora-text-muted block mb-2">Branchen</label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRIES.map(ind => (
                <button key={ind} onClick={() => setIcpIndustries(prev => prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind])}
                  className={`px-3 py-1 rounded-full text-xs transition ${icpIndustries.includes(ind) ? 'bg-elvora-accent text-white' : 'bg-elvora-darker text-elvora-text-muted hover:text-white border border-white/10'}`}>
                  {ind}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-elvora-text-muted block mb-2">Standorte (kommagetrennt)</label>
            <input placeholder="z.B. Hamburg, Berlin, München" value={icpLocations} onChange={e => setIcpLocations(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" />
          </div>

          <div>
            <label className="text-sm text-elvora-text-muted block mb-2">Firmengröße</label>
            <div className="flex flex-wrap gap-2">
              {COMPANY_SIZES.map(size => (
                <button key={size} onClick={() => setIcpSizes(prev => prev.includes(size) ? prev.filter(s => s !== size) : [...prev, size])}
                  className={`px-3 py-1 rounded-full text-xs transition ${icpSizes.includes(size) ? 'bg-elvora-accent text-white' : 'bg-elvora-darker text-elvora-text-muted hover:text-white border border-white/10'}`}>
                  {size} MA
                </button>
              ))}
            </div>
          </div>

          <button onClick={saveIcp} disabled={saving}
            className="px-6 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition disabled:opacity-50">
            {saving ? 'Speichern...' : 'Weiter →'}
          </button>
        </div>
      )}

      {/* Step 1: Domains */}
      {step === 1 && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white">Sending-Domains verbinden</h2>
          <p className="text-elvora-text-muted text-sm">Füge Domains hinzu, über die E-Mails für diesen Kunden versendet werden.</p>

          <div className="flex gap-2">
            <input placeholder="z.B. outreach-firma.de" value={domainInput} onChange={e => setDomainInput(e.target.value)}
              className="flex-1 px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted" />
            <button onClick={addDomain} disabled={addingDomain || !domainInput.trim()}
              className="px-4 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition disabled:opacity-50">
              {addingDomain ? '...' : 'Hinzufügen'}
            </button>
          </div>

          {domains.length > 0 && (
            <div className="space-y-2">
              {domains.map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-2 rounded-lg bg-elvora-darker">
                  <span className="text-white">{d.domain}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${d.status === 'warming' ? 'bg-yellow-500/20 text-yellow-400' : d.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-elvora-text-muted text-xs">Neue Domains starten automatisch im Warmup-Modus (15 Tage).</p>

          <div className="flex gap-2">
            <button onClick={() => setStep(0)} className="px-4 py-2 rounded-lg bg-elvora-darker text-elvora-text-muted hover:text-white transition">← Zurück</button>
            <button onClick={() => setStep(2)} className="px-6 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition">
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Blacklist */}
      {step === 2 && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white">Blacklist</h2>
          <p className="text-elvora-text-muted text-sm">E-Mail-Adressen oder Domains die für diesen Kunden nicht kontaktiert werden sollen.</p>

          <textarea placeholder="E-Mails eingeben (eine pro Zeile, oder kommagetrennt)&#10;z.B. konkurrent@firma.de, ceo@bestehender-kunde.de"
            value={blacklistInput} onChange={e => setBlacklistInput(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-elvora-darker border border-white/10 text-white placeholder-elvora-text-muted h-32" />

          <div className="flex items-center gap-4">
            <button onClick={addBlacklist} disabled={!blacklistInput.trim()}
              className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition disabled:opacity-50">
              Zur Blacklist hinzufügen
            </button>
            <span className="text-elvora-text-muted text-sm">{blacklistCount} Einträge</span>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 rounded-lg bg-elvora-darker text-elvora-text-muted hover:text-white transition">← Zurück</button>
            <button onClick={() => setStep(3)} className="px-6 py-2 rounded-lg bg-elvora-accent text-white hover:bg-elvora-accent/80 transition">
              Weiter →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="card-glass p-6 rounded-xl space-y-4">
          <h2 className="text-lg font-semibold text-white">Zusammenfassung</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-elvora-darker">
              <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Zielgruppe</p>
              <p className="text-white text-sm mt-1">{icpDesc || '—'}</p>
              {icpIndustries.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {icpIndustries.map(i => <span key={i} className="px-2 py-0.5 rounded-full bg-elvora-accent/20 text-elvora-accent text-xs">{i}</span>)}
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-elvora-darker">
              <p className="text-elvora-text-muted text-xs uppercase tracking-wider">Infrastruktur</p>
              <p className="text-white text-sm mt-2">{domains.length} Domain{domains.length !== 1 ? 's' : ''}</p>
              <p className="text-white text-sm">{blacklistCount} Blacklist-Einträge</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="px-4 py-2 rounded-lg bg-elvora-darker text-elvora-text-muted hover:text-white transition">← Zurück</button>
            <button onClick={completeOnboarding} disabled={saving}
              className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-500 transition disabled:opacity-50">
              {saving ? 'Aktiviere...' : 'Onboarding abschließen & Konto aktivieren'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
