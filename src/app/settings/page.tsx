'use client';

import { useState, KeyboardEvent } from 'react';

export default function SettingsPage() {
  const [cities, setCities] = useState<string[]>(['Essen', 'Dortmund', 'Bochum', 'Duisburg']);
  const [cityInput, setCityInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>(['Sanit\u00e4r', 'Heizung', 'Klempner', 'SHK']);
  const [keywordInput, setKeywordInput] = useState('');
  const [scoreThreshold, setScoreThreshold] = useState(85);
  const [scanSchedule, setScanSchedule] = useState('daily_3am');
  const [saved, setSaved] = useState(false);

  function handleCityKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && cityInput.trim()) {
      e.preventDefault();
      if (!cities.includes(cityInput.trim())) {
        setCities([...cities, cityInput.trim()]);
      }
      setCityInput('');
    }
  }

  function removeCity(city: string) {
    setCities(cities.filter((c) => c !== city));
  }

  function handleKeywordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      if (!keywords.includes(keywordInput.trim())) {
        setKeywords([...keywords, keywordInput.trim()]);
      }
      setKeywordInput('');
    }
  }

  function removeKeyword(keyword: string) {
    setKeywords(keywords.filter((k) => k !== keyword));
  }

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const scheduleOptions = [
    { value: 'daily_3am', label: 'Daily at 03:00', description: 'Recommended - runs once per day during off-hours' },
    { value: 'daily_6am', label: 'Daily at 06:00', description: 'Early morning scan before business hours' },
    { value: 'twice_daily', label: 'Twice Daily', description: 'Runs at 03:00 and 15:00 for more frequent updates' },
    { value: 'weekly_monday', label: 'Weekly (Monday)', description: 'Once per week on Monday at 03:00' },
    { value: 'manual', label: 'Manual Only', description: 'Only scans when you trigger it manually' },
  ];

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-elvora-text-muted text-sm mt-1">Configure OpenClaw scanner and lead generation</p>
        </div>
        <button
          onClick={handleSave}
          className={`px-6 py-2.5 rounded-xl font-medium text-sm transition-all ${
            saved
              ? 'bg-elvora-success/20 text-elvora-success border border-elvora-success/30'
              : 'bg-elvora-gradient text-white hover:shadow-elvora-lg'
          }`}
        >
          {saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Target Cities */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Target Cities</h2>
          <p className="text-xs text-elvora-text-dim mb-4">
            Cities to scan for SHK businesses. Press Enter to add.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {cities.map((city) => (
              <span
                key={city}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elvora-purple/10 text-elvora-purple-light text-sm border border-elvora-purple/20"
              >
                {city}
                <button
                  onClick={() => removeCity(city)}
                  className="text-elvora-purple-light/50 hover:text-elvora-danger transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={handleCityKeyDown}
            placeholder="Type a city name and press Enter..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 focus:ring-1 focus:ring-elvora-purple/20 transition-all"
          />
        </div>

        {/* Keywords */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Search Keywords</h2>
          <p className="text-xs text-elvora-text-dim mb-4">
            Keywords to search for on Google Maps. Press Enter to add.
          </p>

          <div className="flex flex-wrap gap-2 mb-4">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-elvora-primary/10 text-elvora-primary-light text-sm border border-elvora-primary/20"
              >
                {keyword}
                <button
                  onClick={() => removeKeyword(keyword)}
                  className="text-elvora-primary/50 hover:text-elvora-danger transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            ))}
          </div>

          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={handleKeywordKeyDown}
            placeholder="Type a keyword and press Enter..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-elvora-text-dim focus:outline-none focus:border-elvora-purple/50 focus:ring-1 focus:ring-elvora-purple/20 transition-all"
          />
        </div>

        {/* Score Threshold */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Score Threshold</h2>
          <p className="text-xs text-elvora-text-dim mb-4">
            Minimum score for a lead to be flagged as &ldquo;hot&rdquo;. Currently set to{' '}
            <span className="text-elvora-purple-light font-semibold">{scoreThreshold}</span>.
          </p>

          <div className="space-y-4">
            <input
              type="range"
              min={0}
              max={100}
              value={scoreThreshold}
              onChange={(e) => setScoreThreshold(parseInt(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-5
                [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-elvora-gradient
                [&::-webkit-slider-thumb]:shadow-elvora
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:border-2
                [&::-webkit-slider-thumb]:border-white/20
              "
            />
            <div className="flex justify-between text-xs text-elvora-text-dim">
              <span>0 - All leads</span>
              <span className="text-elvora-purple-light font-mono font-semibold text-base">
                {scoreThreshold}
              </span>
              <span>100 - Only perfect</span>
            </div>
          </div>
        </div>

        {/* Scan Schedule */}
        <div className="glass rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-1">Scan Schedule</h2>
          <p className="text-xs text-elvora-text-dim mb-4">
            How often OpenClaw should scan for new leads.
          </p>

          <div className="space-y-3">
            {scheduleOptions.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all ${
                  scanSchedule === option.value
                    ? 'bg-elvora-purple/10 border border-elvora-purple/30'
                    : 'bg-white/[0.02] border border-white/5 hover:bg-white/[0.04]'
                }`}
              >
                <div className="mt-0.5">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      scanSchedule === option.value
                        ? 'border-elvora-purple'
                        : 'border-white/20'
                    }`}
                  >
                    {scanSchedule === option.value && (
                      <div className="w-2 h-2 rounded-full bg-elvora-purple" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <input
                    type="radio"
                    name="schedule"
                    value={option.value}
                    checked={scanSchedule === option.value}
                    onChange={(e) => setScanSchedule(e.target.value)}
                    className="sr-only"
                  />
                  <p className="text-sm text-white font-medium">{option.label}</p>
                  <p className="text-xs text-elvora-text-dim mt-0.5">{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="glass rounded-2xl p-6 border-elvora-danger/20">
          <h2 className="text-sm font-semibold text-elvora-danger mb-1">Danger Zone</h2>
          <p className="text-xs text-elvora-text-dim mb-4">
            Destructive actions that cannot be undone.
          </p>

          <div className="flex gap-4">
            <button className="px-4 py-2.5 rounded-xl bg-elvora-danger/10 border border-elvora-danger/20 text-elvora-danger text-sm font-medium hover:bg-elvora-danger/20 transition-all">
              Clear All Leads
            </button>
            <button className="px-4 py-2.5 rounded-xl bg-elvora-danger/10 border border-elvora-danger/20 text-elvora-danger text-sm font-medium hover:bg-elvora-danger/20 transition-all">
              Reset Database
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
