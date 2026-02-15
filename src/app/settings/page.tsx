'use client';

import { useState, KeyboardEvent } from 'react';

export default function SettingsPage() {
  const [cities, setCities] = useState<string[]>(['Essen', 'Dortmund', 'Bochum', 'Duisburg']);
  const [cityInput, setCityInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['Sanitär', 'Heizung', 'Klempner', 'SHK']);
  const [keywordInput, setKeywordInput] = useState('');
  const [scoreThreshold, setScoreThreshold] = useState(85);
  const [saved, setSaved] = useState(false);

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

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-bold text-white">Einstellungen</h1>
        <button
          onClick={handleSave}
          className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
            saved
              ? 'bg-elvora-success/20 text-elvora-success border border-elvora-success/30'
              : 'bg-elvora-gradient text-white hover:shadow-elvora-lg'
          }`}
        >
          {saved ? 'Gespeichert!' : 'Speichern'}
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
