'use client';

import { useState } from 'react';

interface KanbanLead {
  id: number;
  name: string;
  city: string;
  score: number;
  dealValue: number | null;
  phone: string;
  lastAction: string;
  priority: 'low' | 'medium' | 'high';
}

interface Column {
  id: string;
  title: string;
  color: string;
  leads: KanbanLead[];
}

const initialColumns: Column[] = [
  {
    id: 'not_contacted',
    title: 'Nicht kontaktiert',
    color: 'bg-elvora-text-dim',
    leads: [
      { id: 1, name: 'Krause Sanitärtechnik GmbH', city: 'Essen', score: 92, dealValue: 3500, phone: '+49 201 7654321', lastAction: 'Vor 2h qualifiziert', priority: 'high' },
      { id: 4, name: 'Weber Klempnerei & Sanitär', city: 'Duisburg', score: 95, dealValue: 4200, phone: '+49 203 4445566', lastAction: 'Vor 1 Tag qualifiziert', priority: 'high' },
      { id: 7, name: 'Fischer Heizung & Bad', city: 'Essen', score: 84, dealValue: 2800, phone: '+49 201 9988776', lastAction: 'Vor 3 Tagen qualifiziert', priority: 'medium' },
    ],
  },
  {
    id: 'in_talks',
    title: 'Im Gespräch',
    color: 'bg-elvora-warning',
    leads: [
      { id: 2, name: 'Meier Haustechnik', city: 'Dortmund', score: 87, dealValue: 3200, phone: '+49 231 5551234', lastAction: 'Gestern angerufen, interessiert', priority: 'high' },
      { id: 8, name: 'Hoffmann Sanitär Dortmund', city: 'Dortmund', score: 79, dealValue: 2500, phone: '+49 231 6667788', lastAction: 'Termin am 18. Feb', priority: 'medium' },
    ],
  },
  {
    id: 'proposal',
    title: 'Angebot gesendet',
    color: 'bg-elvora-purple',
    leads: [
      { id: 5, name: 'Schneider Wärmetechnik', city: 'Bochum', score: 88, dealValue: 3800, phone: '+49 234 1122334', lastAction: 'Angebot am 12. Feb', priority: 'high' },
    ],
  },
  {
    id: 'won',
    title: 'Gewonnen',
    color: 'bg-elvora-success',
    leads: [
      { id: 6, name: 'Braun SHK Technik GmbH', city: 'Essen', score: 91, dealValue: 4500, phone: '+49 201 2233445', lastAction: 'Unterschrieben am 10. Feb', priority: 'high' },
    ],
  },
];

function getScoreClass(score: number): string {
  if (score >= 85) return 'score-hot';
  if (score >= 70) return 'score-warm';
  return 'score-cold';
}

export default function LeadsPage() {
  const [columns] = useState<Column[]>(initialColumns);

  const totalDeals = columns.reduce((sum, col) => sum + col.leads.length, 0);
  const totalValue = columns.reduce(
    (sum, col) => sum + col.leads.reduce((s, l) => s + (l.dealValue || 0), 0), 0
  );

  return (
    <div className="animate-fade-in">
      {/* Header with summary */}
      <div className="flex items-center justify-between mb-4 lg:mb-5">
        <h1 className="text-lg font-bold text-white">Pipeline</h1>
        <div className="flex items-center gap-3 lg:gap-4 text-xs sm:text-sm">
          <span className="text-elvora-text-dim">{totalDeals} Deals</span>
          <span className="text-elvora-accent font-semibold">{totalValue.toLocaleString('de-DE')} EUR</span>
        </div>
      </div>

      {/* Kanban - horizontal scroll on mobile */}
      <div className="flex lg:grid lg:grid-cols-4 gap-3 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x snap-mandatory lg:snap-none">
        {columns.map((col) => (
          <div key={col.id} className="min-w-[280px] lg:min-w-0 snap-start">
            <div className="flex items-center gap-2 mb-3 px-1">
              <div className={`w-2 h-2 rounded-full ${col.color}`} />
              <span className="text-xs font-semibold text-white">{col.title}</span>
              <span className="ml-auto text-xs text-elvora-text-dim">{col.leads.length}</span>
            </div>
            <div className="space-y-2 min-h-[300px]">
              {col.leads.map((lead) => (
                <div key={lead.id} className="glass rounded-xl p-3 card-hover cursor-pointer">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-medium text-white leading-tight pr-2">{lead.name}</h4>
                    <div className={`${getScoreClass(lead.score)} px-1.5 py-0.5 rounded-lg flex-shrink-0`}>
                      <span className="text-[11px] font-bold text-white">{lead.score}</span>
                    </div>
                  </div>
                  <div className="text-xs text-elvora-text-dim mb-2">{lead.city}</div>
                  {lead.dealValue && (
                    <div className="text-base font-bold text-elvora-accent mb-2">
                      {lead.dealValue.toLocaleString('de-DE')} EUR
                    </div>
                  )}
                  <div className="text-xs text-elvora-text-dim">{lead.lastAction}</div>
                  <div className="mt-2 pt-2 border-t border-white/5 text-xs text-elvora-text-dim font-mono">
                    {lead.phone}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
