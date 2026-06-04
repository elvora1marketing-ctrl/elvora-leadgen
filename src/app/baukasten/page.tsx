'use client';

import { useState, useEffect, useCallback } from 'react';

interface BlockSlot {
  type: string;
  description: string;
}

interface CatalogBlock {
  id: string;
  category: string;
  name: string;
  description: string;
  tags: string[];
  useCase: string;
  variants: string[];
  slots: Record<string, BlockSlot>;
  deps: string[];
  file: string;
  spec: string;
}

interface BlockDetail extends CatalogBlock {
  code: string;
  spec: string;
}

const categoryLabels: Record<string, string> = {
  hero: 'Hero',
  features: 'Features',
  pricing: 'Pricing',
  testimonials: 'Testimonials',
  contact: 'Kontakt',
  footer: 'Footer',
  cta: 'CTA',
  faq: 'FAQ',
  team: 'Team',
  stats: 'Statistiken',
  gallery: 'Galerie',
  navigation: 'Navigation',
};

const categoryColors: Record<string, string> = {
  hero: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  features: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  pricing: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  testimonials: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  contact: 'bg-pink-500/15 text-pink-400 border-pink-500/20',
  footer: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
  cta: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  faq: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
};

export default function BaukastenPage() {
  const [blocks, setBlocks] = useState<CatalogBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'code' | 'spec'>('overview');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  const loadCatalog = useCallback(async () => {
    try {
      const res = await fetch('/api/baukasten?action=catalog');
      if (res.ok) {
        const data = await res.json();
        setBlocks(data.blocks || []);
      }
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadCatalog(); }, [loadCatalog]);

  const loadBlockDetail = async (id: string) => {
    setDetailLoading(true);
    setActiveTab('overview');
    try {
      const res = await fetch(`/api/baukasten?action=block&id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedBlock(data);
      }
    } catch { /* silent */ }
    setDetailLoading(false);
  };

  const copyCode = async () => {
    if (!selectedBlock?.code) return;
    await navigator.clipboard.writeText(selectedBlock.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const categories = ['all', ...Array.from(new Set(blocks.map(b => b.category)))];

  const filtered = blocks.filter(b => {
    if (filterCategory !== 'all' && b.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return b.name.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.tags.some(t => t.toLowerCase().includes(q)) ||
        b.id.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-elvora-purple to-elvora-pink flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Baukasten</h1>
            <p className="text-sm text-elvora-text-muted">Kuratierte UI-Blocks fuer Kunden-Websites</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{blocks.length}</span>
            <span className="text-sm text-elvora-text-muted">Blocks</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{new Set(blocks.map(b => b.category)).size}</span>
            <span className="text-sm text-elvora-text-muted">Kategorien</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{blocks.reduce((sum, b) => sum + b.variants.length, 0)}</span>
            <span className="text-sm text-elvora-text-muted">Varianten</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Block suchen..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-sm bg-elvora-card border border-elvora-border rounded-lg text-white placeholder:text-elvora-text-dim focus:border-elvora-purple/50 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterCategory === cat
                  ? 'bg-elvora-purple/15 text-elvora-purple-light border border-elvora-purple/20'
                  : 'text-elvora-text-muted hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              {cat === 'all' ? 'Alle' : categoryLabels[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Block Grid */}
        <div className={`${selectedBlock ? 'w-1/2 hidden lg:block' : 'w-full'}`}>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="card rounded-xl p-5 animate-pulse">
                  <div className="h-4 w-20 bg-elvora-surface rounded mb-3" />
                  <div className="h-5 w-3/4 bg-elvora-surface rounded mb-2" />
                  <div className="h-4 w-full bg-elvora-surface rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card rounded-xl p-12 text-center">
              <svg className="w-12 h-12 text-elvora-text-dim mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-elvora-text-muted text-sm">
                {blocks.length === 0 ? 'Noch keine Blocks im Baukasten.' : 'Keine Blocks gefunden.'}
              </p>
            </div>
          ) : (
            <div className={`grid gap-4 ${selectedBlock ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
              {filtered.map(block => (
                <button
                  key={block.id}
                  onClick={() => loadBlockDetail(block.id)}
                  className={`card rounded-xl p-5 text-left transition-all hover:border-elvora-border-hover group ${
                    selectedBlock?.id === block.id ? 'border-elvora-purple/40 bg-elvora-purple/[0.03]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                      categoryColors[block.category] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                    }`}>
                      {categoryLabels[block.category] || block.category}
                    </span>
                    <span className="text-[11px] text-elvora-text-dim font-mono">{block.id}</span>
                  </div>

                  <h3 className="text-sm font-semibold text-white mb-1.5 group-hover:text-elvora-purple-light transition-colors">
                    {block.name}
                  </h3>

                  <p className="text-xs text-elvora-text-muted leading-relaxed mb-3 line-clamp-2">
                    {block.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                      {block.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-elvora-text-dim">
                          {tag}
                        </span>
                      ))}
                      {block.tags.length > 3 && (
                        <span className="text-[10px] text-elvora-text-dim">+{block.tags.length - 3}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-elvora-text-dim">
                      <span>{block.variants.length} Var.</span>
                      <span>·</span>
                      <span>{Object.keys(block.slots).length} Slots</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedBlock && (
          <div className="w-full lg:w-1/2 lg:sticky lg:top-6 lg:self-start">
            <div className="card rounded-xl overflow-hidden">
              {/* Detail Header */}
              <div className="px-5 py-4 border-b border-elvora-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                    categoryColors[selectedBlock.category] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                  }`}>
                    {categoryLabels[selectedBlock.category] || selectedBlock.category}
                  </span>
                  <h2 className="text-sm font-semibold text-white">{selectedBlock.name}</h2>
                </div>
                <button
                  onClick={() => setSelectedBlock(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-elvora-card text-elvora-text-dim hover:text-white transition-colors lg:flex hidden"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <button
                  onClick={() => setSelectedBlock(null)}
                  className="lg:hidden flex items-center gap-1 text-xs text-elvora-text-muted hover:text-white"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Zurueck
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-elvora-border">
                {(['overview', 'code', 'spec'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2.5 text-xs font-medium transition-all relative ${
                      activeTab === tab
                        ? 'text-white'
                        : 'text-elvora-text-muted hover:text-white'
                    }`}
                  >
                    {tab === 'overview' ? 'Uebersicht' : tab === 'code' ? 'Code' : 'Spec'}
                    {activeTab === tab && (
                      <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-elvora-purple" />
                    )}
                  </button>
                ))}
              </div>

              {detailLoading ? (
                <div className="p-6 space-y-3 animate-pulse">
                  <div className="h-4 w-3/4 bg-elvora-surface rounded" />
                  <div className="h-4 w-1/2 bg-elvora-surface rounded" />
                  <div className="h-32 bg-elvora-surface rounded" />
                </div>
              ) : (
                <div className="p-5 max-h-[70vh] overflow-y-auto">
                  {activeTab === 'overview' && (
                    <div className="space-y-5">
                      <div>
                        <p className="text-sm text-elvora-text-muted leading-relaxed">{selectedBlock.description}</p>
                      </div>

                      <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-elvora-text-dim font-medium mb-2">Use-Case</h4>
                        <p className="text-sm text-elvora-text-muted">{selectedBlock.useCase}</p>
                      </div>

                      <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-elvora-text-dim font-medium mb-2">Varianten</h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedBlock.variants.map(v => (
                            <span key={v} className="text-xs px-2.5 py-1 rounded-lg bg-elvora-surface border border-elvora-border text-white">
                              {v}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-elvora-text-dim font-medium mb-2">
                          Slots ({Object.keys(selectedBlock.slots).length})
                        </h4>
                        <div className="space-y-2">
                          {Object.entries(selectedBlock.slots).map(([name, slot]) => (
                            <div key={name} className="flex items-start gap-3 px-3 py-2 rounded-lg bg-elvora-surface/50">
                              <code className="text-xs text-elvora-purple-light font-mono mt-0.5 flex-shrink-0">{name}</code>
                              <div className="flex-1 min-w-0">
                                <span className="text-[11px] text-elvora-text-dim font-mono block">{slot.type}</span>
                                <span className="text-xs text-elvora-text-muted">{slot.description}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-elvora-text-dim font-medium mb-2">Abhaengigkeiten</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedBlock.deps.map(dep => (
                            <span key={dep} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-elvora-text-muted font-mono">
                              {dep}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[11px] uppercase tracking-wider text-elvora-text-dim font-medium mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedBlock.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-elvora-text-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-elvora-border">
                        <div className="flex items-center gap-4 text-[11px] text-elvora-text-dim">
                          <span className="font-mono">{selectedBlock.file}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'code' && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-elvora-text-dim font-mono">{selectedBlock.file}</span>
                        <button
                          onClick={copyCode}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-elvora-text-muted hover:text-white hover:bg-white/5 transition-all"
                        >
                          {codeCopied ? (
                            <>
                              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Kopiert
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Kopieren
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="bg-black/40 border border-elvora-border rounded-lg p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-elvora-text-muted">
                        <code>{selectedBlock.code || 'Code nicht gefunden.'}</code>
                      </pre>
                    </div>
                  )}

                  {activeTab === 'spec' && (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="bg-black/40 border border-elvora-border rounded-lg p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-elvora-text-muted whitespace-pre-wrap">
                        {selectedBlock.spec || 'Spec nicht gefunden.'}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
