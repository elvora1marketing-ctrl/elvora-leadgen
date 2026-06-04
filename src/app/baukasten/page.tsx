'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { blockRegistry, getNestedValue, setNestedValue, type EditableField } from '@/lib/baukasten-registry';

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
  specContent: string;
}

interface PageBlock {
  uid: string;
  id: string;
  props: Record<string, unknown>;
}

const categoryLabels: Record<string, string> = {
  hero: 'Hero', features: 'Features', pricing: 'Pricing', testimonials: 'Testimonials',
  contact: 'Kontakt', footer: 'Footer', cta: 'CTA', faq: 'FAQ', team: 'Team',
  stats: 'Statistiken', gallery: 'Galerie', navigation: 'Navigation',
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

const deviceSizes = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '390px', label: 'Mobile' },
} as const;

type DeviceMode = keyof typeof deviceSizes;

export default function BaukastenPage() {
  const [blocks, setBlocks] = useState<CatalogBlock[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'spec'>('preview');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [device, setDevice] = useState<DeviceMode>('desktop');
  const [editProps, setEditProps] = useState<Record<string, unknown>>({});
  const [mode, setMode] = useState<'browse' | 'builder'>('browse');
  const [pageBlocks, setPageBlocks] = useState<PageBlock[]>([]);
  const [editorOpen, setEditorOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const builderIframeRef = useRef<HTMLIFrameElement>(null);
  const iframeReady = useRef(false);
  const builderIframeReady = useRef(false);
  const pendingMessage = useRef<unknown>(null);
  const pendingBuilderMessage = useRef<unknown>(null);

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

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.data?.type === 'ready') {
        if (e.source === iframeRef.current?.contentWindow) {
          iframeReady.current = true;
          if (pendingMessage.current) {
            iframeRef.current?.contentWindow?.postMessage(pendingMessage.current, '*');
            pendingMessage.current = null;
          }
        }
        if (e.source === builderIframeRef.current?.contentWindow) {
          builderIframeReady.current = true;
          if (pendingBuilderMessage.current) {
            builderIframeRef.current?.contentWindow?.postMessage(pendingBuilderMessage.current, '*');
            pendingBuilderMessage.current = null;
          }
        }
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const sendToPreview = useCallback((blockId: string, props: Record<string, unknown>) => {
    const msg = { type: 'render', blocks: [{ id: blockId, props }] };
    if (iframeReady.current && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage(msg, '*');
    } else {
      pendingMessage.current = msg;
    }
  }, []);

  const sendToBuilderPreview = useCallback((pageBlockList: PageBlock[]) => {
    const msg = { type: 'render', blocks: pageBlockList.map(b => ({ id: b.id, props: b.props })) };
    if (builderIframeReady.current && builderIframeRef.current?.contentWindow) {
      builderIframeRef.current.contentWindow.postMessage(msg, '*');
    } else {
      pendingBuilderMessage.current = msg;
    }
  }, []);

  useEffect(() => {
    if (selectedBlock && activeTab === 'preview') {
      sendToPreview(selectedBlock.id, editProps);
    }
  }, [editProps, selectedBlock, activeTab, sendToPreview]);

  useEffect(() => {
    if (mode === 'builder' && pageBlocks.length > 0) {
      sendToBuilderPreview(pageBlocks);
    }
  }, [pageBlocks, mode, sendToBuilderPreview]);

  const loadBlockDetail = async (id: string) => {
    setDetailLoading(true);
    setActiveTab('preview');
    try {
      const res = await fetch(`/api/baukasten?action=block&id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedBlock({ ...data, specContent: data.spec });
        const reg = blockRegistry[id];
        if (reg) {
          setEditProps(JSON.parse(JSON.stringify(reg.demoProps)));
        }
      }
    } catch { /* silent */ }
    setDetailLoading(false);
  };

  const updateProp = (key: string, value: unknown) => {
    setEditProps(prev => setNestedValue(prev, key, value));
  };

  const resetProps = () => {
    if (selectedBlock) {
      const reg = blockRegistry[selectedBlock.id];
      if (reg) setEditProps(JSON.parse(JSON.stringify(reg.demoProps)));
    }
  };

  const copyCode = async () => {
    if (!selectedBlock?.code) return;
    await navigator.clipboard.writeText(selectedBlock.code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const downloadCode = () => {
    if (!selectedBlock?.code) return;
    const blob = new Blob([selectedBlock.code], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedBlock.file.split('/').pop() || 'block.tsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const addToPage = (block: CatalogBlock) => {
    const reg = blockRegistry[block.id];
    if (!reg) return;
    setPageBlocks(prev => [...prev, {
      uid: `${block.id}-${Date.now()}`,
      id: block.id,
      props: JSON.parse(JSON.stringify(reg.demoProps)),
    }]);
    setMode('builder');
  };

  const removeFromPage = (uid: string) => {
    setPageBlocks(prev => prev.filter(b => b.uid !== uid));
  };

  const moveBlock = (uid: string, dir: -1 | 1) => {
    setPageBlocks(prev => {
      const idx = prev.findIndex(b => b.uid === uid);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const exportPageCode = () => {
    const imports = new Set<string>();
    const jsx: string[] = [];
    for (const pb of pageBlocks) {
      const entry = blockRegistry[pb.id];
      if (!entry) continue;
      const block = blocks.find(b => b.id === pb.id);
      if (!block) continue;
      const compName = block.file.split('/').pop()?.replace('.tsx', '') || pb.id;
      imports.add(`import { ${compName} } from './blocks/${pb.id}/${compName}';`);
      const propsStr = Object.entries(pb.props)
        .map(([k, v]) => `  ${k}={${JSON.stringify(v)}}`)
        .join('\n');
      jsx.push(`      <${compName}\n${propsStr}\n      />`);
    }
    return `${Array.from(imports).join('\n')}\n\nexport default function Page() {\n  return (\n    <div>\n${jsx.join('\n')}\n    </div>\n  );\n}\n`;
  };

  const copyPageCode = async () => {
    await navigator.clipboard.writeText(exportPageCode());
  };

  const categories = ['all', ...Array.from(new Set(blocks.map(b => b.category)))];
  const filtered = blocks.filter(b => {
    if (filterCategory !== 'all' && b.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return b.name.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) ||
        b.tags.some(t => t.toLowerCase().includes(q)) || b.id.toLowerCase().includes(q);
    }
    return true;
  });

  const registryEntry = selectedBlock ? blockRegistry[selectedBlock.id] : null;

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-elvora-purple to-elvora-pink flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Baukasten</h1>
            <p className="text-sm text-elvora-text-muted">{blocks.length} Blocks · {new Set(blocks.map(b => b.category)).size} Kategorien</p>
          </div>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center gap-1 bg-elvora-card border border-elvora-border rounded-lg p-0.5">
          <button
            onClick={() => setMode('browse')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'browse' ? 'bg-elvora-purple/15 text-elvora-purple-light' : 'text-elvora-text-muted hover:text-white'
            }`}
          >
            Durchsuchen
          </button>
          <button
            onClick={() => setMode('builder')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              mode === 'builder' ? 'bg-elvora-purple/15 text-elvora-purple-light' : 'text-elvora-text-muted hover:text-white'
            }`}
          >
            Page Builder
            {pageBlocks.length > 0 && (
              <span className="ml-1.5 min-w-[18px] h-[18px] rounded-full bg-elvora-purple/20 text-elvora-purple-light text-[10px] font-semibold inline-flex items-center justify-center px-1">
                {pageBlocks.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {mode === 'browse' ? (
        <>
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
            <div className={`${selectedBlock ? 'w-[320px] flex-shrink-0 hidden lg:block' : 'w-full'}`}>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="card rounded-xl p-4 animate-pulse">
                      <div className="h-4 w-20 bg-elvora-surface rounded mb-2" />
                      <div className="h-5 w-3/4 bg-elvora-surface rounded mb-1" />
                      <div className="h-4 w-full bg-elvora-surface rounded" />
                    </div>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="card rounded-xl p-12 text-center">
                  <p className="text-elvora-text-muted text-sm">
                    {blocks.length === 0 ? 'Noch keine Blocks im Baukasten.' : 'Keine Blocks gefunden.'}
                  </p>
                </div>
              ) : (
                <div className={`grid gap-3 ${selectedBlock ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
                  {filtered.map(block => (
                    <div key={block.id} className={`card rounded-xl p-4 transition-all hover:border-elvora-border-light group ${
                      selectedBlock?.id === block.id ? 'border-elvora-purple/40 bg-elvora-purple/[0.03]' : ''
                    }`}>
                      <button
                        onClick={() => loadBlockDetail(block.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            categoryColors[block.category] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                          }`}>
                            {categoryLabels[block.category] || block.category}
                          </span>
                          <span className="text-[11px] text-elvora-text-dim font-mono">{block.id}</span>
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-elvora-purple-light transition-colors">
                          {block.name}
                        </h3>
                        <p className="text-xs text-elvora-text-muted leading-relaxed line-clamp-2 mb-2">
                          {block.description}
                        </p>
                      </button>
                      <div className="flex items-center justify-between pt-2 border-t border-elvora-border">
                        <div className="flex flex-wrap gap-1">
                          {block.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-elvora-text-dim">{tag}</span>
                          ))}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); addToPage(block); }}
                          className="text-[10px] font-medium text-elvora-text-dim hover:text-elvora-purple-light transition-colors flex items-center gap-1"
                          title="Zur Seite hinzufuegen"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Seite
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Detail Panel */}
            {selectedBlock && (
              <div className="flex-1 min-w-0">
                <div className="card rounded-xl overflow-hidden">
                  {/* Detail Header */}
                  <div className="px-4 py-3 border-b border-elvora-border flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md border flex-shrink-0 ${
                        categoryColors[selectedBlock.category] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                      }`}>
                        {categoryLabels[selectedBlock.category] || selectedBlock.category}
                      </span>
                      <h2 className="text-sm font-semibold text-white truncate">{selectedBlock.name}</h2>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => addToPage(selectedBlock)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-elvora-text-muted hover:text-elvora-purple-light hover:bg-elvora-purple/10 transition-all"
                        title="Zur Seite hinzufuegen"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Seite
                      </button>
                      <button
                        onClick={() => setSelectedBlock(null)}
                        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-elvora-card text-elvora-text-dim hover:text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Tabs + Device Toggle */}
                  <div className="flex items-center justify-between border-b border-elvora-border px-1">
                    <div className="flex">
                      {(['preview', 'code', 'spec'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-4 py-2.5 text-xs font-medium transition-all relative ${
                            activeTab === tab ? 'text-white' : 'text-elvora-text-muted hover:text-white'
                          }`}
                        >
                          {tab === 'preview' ? 'Vorschau' : tab === 'code' ? 'Code' : 'Spec'}
                          {activeTab === tab && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-elvora-purple" />}
                        </button>
                      ))}
                    </div>

                    {activeTab === 'preview' && (
                      <div className="flex items-center gap-1 pr-2">
                        {(Object.keys(deviceSizes) as DeviceMode[]).map(d => (
                          <button
                            key={d}
                            onClick={() => setDevice(d)}
                            className={`p-1.5 rounded-md transition-all ${
                              device === d ? 'text-elvora-purple-light bg-elvora-purple/10' : 'text-elvora-text-dim hover:text-white'
                            }`}
                            title={deviceSizes[d].label}
                          >
                            {d === 'desktop' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                            {d === 'tablet' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                            {d === 'mobile' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                          </button>
                        ))}
                        <div className="w-px h-4 bg-elvora-border mx-1" />
                        <button
                          onClick={() => setEditorOpen(!editorOpen)}
                          className={`p-1.5 rounded-md transition-all ${editorOpen ? 'text-elvora-purple-light bg-elvora-purple/10' : 'text-elvora-text-dim hover:text-white'}`}
                          title="Prop-Editor"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {detailLoading ? (
                    <div className="p-6 space-y-3 animate-pulse">
                      <div className="h-4 w-3/4 bg-elvora-surface rounded" />
                      <div className="h-64 bg-elvora-surface rounded" />
                    </div>
                  ) : (
                    <>
                      {activeTab === 'preview' && (
                        <div className="flex">
                          {/* Preview iframe */}
                          <div className="flex-1 min-w-0 bg-[#0A0A0B] flex justify-center">
                            <div
                              className="w-full transition-all duration-300"
                              style={{
                                maxWidth: deviceSizes[device].width,
                                ...(device !== 'desktop' ? { borderLeft: '1px solid #26262A', borderRight: '1px solid #26262A' } : {}),
                              }}
                            >
                              <iframe
                                ref={iframeRef}
                                src="/baukasten/preview"
                                className="w-full border-0"
                                style={{ height: '500px' }}
                                onLoad={() => {
                                  if (selectedBlock) {
                                    setTimeout(() => sendToPreview(selectedBlock.id, editProps), 100);
                                  }
                                }}
                              />
                            </div>
                          </div>

                          {/* Prop Editor Sidebar */}
                          {editorOpen && registryEntry && (
                            <div className="w-[280px] flex-shrink-0 border-l border-elvora-border overflow-y-auto" style={{ maxHeight: '500px' }}>
                              <div className="px-3 py-2.5 border-b border-elvora-border flex items-center justify-between">
                                <span className="text-xs font-semibold text-white">Props bearbeiten</span>
                                <button onClick={resetProps} className="text-[10px] text-elvora-text-dim hover:text-elvora-purple-light transition-colors">
                                  Zuruecksetzen
                                </button>
                              </div>
                              <div className="p-3 space-y-3">
                                {registryEntry.fields.map((field: EditableField) => (
                                  <div key={field.key}>
                                    <label className="text-[11px] text-elvora-text-muted font-medium mb-1 block">{field.label}</label>
                                    {field.type === 'select' ? (
                                      <select
                                        value={String(getNestedValue(editProps, field.key) || '')}
                                        onChange={e => updateProp(field.key, e.target.value)}
                                        className="w-full h-8 px-2 text-xs bg-elvora-card border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none"
                                      >
                                        {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                                      </select>
                                    ) : field.type === 'textarea' ? (
                                      <textarea
                                        value={String(getNestedValue(editProps, field.key) || '')}
                                        onChange={e => updateProp(field.key, e.target.value)}
                                        rows={3}
                                        className="w-full px-2 py-1.5 text-xs bg-elvora-card border border-elvora-border rounded-lg text-white resize-none focus:border-elvora-purple/50 focus:outline-none"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={String(getNestedValue(editProps, field.key) || '')}
                                        onChange={e => updateProp(field.key, e.target.value)}
                                        className="w-full h-8 px-2 text-xs bg-elvora-card border border-elvora-border rounded-lg text-white focus:border-elvora-purple/50 focus:outline-none"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'code' && (
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs text-elvora-text-dim font-mono">{selectedBlock.file}</span>
                            <div className="flex items-center gap-2">
                              <button onClick={downloadCode} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-elvora-text-muted hover:text-white hover:bg-white/5 transition-all">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                .tsx
                              </button>
                              <button onClick={copyCode} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-elvora-text-muted hover:text-white hover:bg-white/5 transition-all">
                                {codeCopied ? (
                                  <><svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Kopiert</>
                                ) : (
                                  <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Kopieren</>
                                )}
                              </button>
                            </div>
                          </div>
                          <pre className="bg-black/40 border border-elvora-border rounded-lg p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-elvora-text-muted max-h-[60vh]">
                            <code>{selectedBlock.code || 'Code nicht gefunden.'}</code>
                          </pre>
                        </div>
                      )}

                      {activeTab === 'spec' && (
                        <div className="p-4">
                          <pre className="bg-black/40 border border-elvora-border rounded-lg p-4 overflow-x-auto text-[12px] leading-relaxed font-mono text-elvora-text-muted whitespace-pre-wrap max-h-[60vh]">
                            {selectedBlock.specContent || 'Spec nicht gefunden.'}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* PAGE BUILDER MODE */
        <div className="flex gap-6">
          {/* Block Picker (left) */}
          <div className="w-[260px] flex-shrink-0 space-y-2">
            <div className="card rounded-xl p-3 border-dashed">
              <h3 className="text-xs font-semibold text-white mb-2">Blocks hinzufuegen</h3>
              <div className="space-y-1.5">
                {blocks.map(block => (
                  <button
                    key={block.id}
                    onClick={() => addToPage(block)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-white/5 transition-all group"
                  >
                    <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 ${
                      categoryColors[block.category] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                    }`}>
                      {(categoryLabels[block.category] || block.category).slice(0, 4)}
                    </span>
                    <span className="text-xs text-elvora-text-muted group-hover:text-white truncate">{block.name}</span>
                    <svg className="w-3 h-3 text-elvora-text-dim group-hover:text-elvora-purple-light ml-auto flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Page Composition (center) */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Composition List */}
            <div className="card rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-elvora-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  Seite ({pageBlocks.length} {pageBlocks.length === 1 ? 'Block' : 'Blocks'})
                </h3>
                <div className="flex items-center gap-2">
                  {pageBlocks.length > 0 && (
                    <>
                      <button
                        onClick={copyPageCode}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-elvora-text-muted hover:text-white hover:bg-white/5 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Code kopieren
                      </button>
                      <button
                        onClick={() => setPageBlocks([])}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        Leeren
                      </button>
                    </>
                  )}
                </div>
              </div>

              {pageBlocks.length === 0 ? (
                <div className="p-8 text-center">
                  <svg className="w-10 h-10 text-elvora-text-dim mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p className="text-sm text-elvora-text-muted">Blocks links auswaehlen um eine Seite zusammenzubauen.</p>
                </div>
              ) : (
                <div className="divide-y divide-elvora-border">
                  {pageBlocks.map((pb, idx) => {
                    const block = blocks.find(b => b.id === pb.id);
                    return (
                      <div key={pb.uid} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                        <span className="text-xs text-elvora-text-dim font-mono w-5 text-center">{idx + 1}</span>
                        <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          categoryColors[block?.category || ''] || 'bg-gray-500/15 text-gray-400 border-gray-500/20'
                        }`}>
                          {categoryLabels[block?.category || ''] || block?.category || pb.id}
                        </span>
                        <span className="text-xs text-white flex-1 truncate">{block?.name || pb.id}</span>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => moveBlock(pb.uid, -1)} disabled={idx === 0} className="w-6 h-6 flex items-center justify-center rounded text-elvora-text-dim hover:text-white disabled:opacity-20 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                          </button>
                          <button onClick={() => moveBlock(pb.uid, 1)} disabled={idx === pageBlocks.length - 1} className="w-6 h-6 flex items-center justify-center rounded text-elvora-text-dim hover:text-white disabled:opacity-20 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                          </button>
                          <button onClick={() => removeFromPage(pb.uid)} className="w-6 h-6 flex items-center justify-center rounded text-elvora-text-dim hover:text-red-400 transition-all">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Builder Preview */}
            {pageBlocks.length > 0 && (
              <div className="card rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-elvora-border flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Vorschau</span>
                  <div className="flex items-center gap-1">
                    {(Object.keys(deviceSizes) as DeviceMode[]).map(d => (
                      <button
                        key={d}
                        onClick={() => setDevice(d)}
                        className={`p-1.5 rounded-md transition-all ${
                          device === d ? 'text-elvora-purple-light bg-elvora-purple/10' : 'text-elvora-text-dim hover:text-white'
                        }`}
                        title={deviceSizes[d].label}
                      >
                        {d === 'desktop' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                        {d === 'tablet' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                        {d === 'mobile' && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-[#0A0A0B] flex justify-center">
                  <div
                    className="w-full transition-all duration-300"
                    style={{
                      maxWidth: deviceSizes[device].width,
                      ...(device !== 'desktop' ? { borderLeft: '1px solid #26262A', borderRight: '1px solid #26262A' } : {}),
                    }}
                  >
                    <iframe
                      ref={builderIframeRef}
                      src="/baukasten/preview"
                      className="w-full border-0"
                      style={{ height: `${Math.max(400, pageBlocks.length * 500)}px` }}
                      onLoad={() => {
                        setTimeout(() => sendToBuilderPreview(pageBlocks), 100);
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
