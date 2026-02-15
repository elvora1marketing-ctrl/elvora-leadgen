'use client';

import { useState } from 'react';

interface KanbanLead {
  id: number;
  name: string;
  city: string;
  score: number;
  dealValue: number | null;
  phone: string;
  contactStatus: string;
  lastAction: string;
  priority: 'low' | 'medium' | 'high';
}

interface Column {
  id: string;
  title: string;
  status: string;
  color: string;
  leads: KanbanLead[];
}

const initialColumns: Column[] = [
  {
    id: 'not_contacted',
    title: 'Not Contacted',
    status: 'not_contacted',
    color: 'bg-elvora-text-dim',
    leads: [
      {
        id: 1,
        name: 'Krause Sanitärtechnik GmbH',
        city: 'Essen',
        score: 92,
        dealValue: 3500,
        phone: '+49 201 7654321',
        contactStatus: 'not_contacted',
        lastAction: 'Qualified 2h ago',
        priority: 'high',
      },
      {
        id: 4,
        name: 'Weber Klempnerei & Sanitär',
        city: 'Duisburg',
        score: 95,
        dealValue: 4200,
        phone: '+49 203 4445566',
        contactStatus: 'not_contacted',
        lastAction: 'Qualified 1d ago',
        priority: 'high',
      },
      {
        id: 7,
        name: 'Fischer Heizung & Bad',
        city: 'Essen',
        score: 84,
        dealValue: 2800,
        phone: '+49 201 9988776',
        contactStatus: 'not_contacted',
        lastAction: 'Qualified 3d ago',
        priority: 'medium',
      },
    ],
  },
  {
    id: 'in_talks',
    title: 'In Talks',
    status: 'called',
    color: 'bg-elvora-warning',
    leads: [
      {
        id: 2,
        name: 'Meier Haustechnik',
        city: 'Dortmund',
        score: 87,
        dealValue: 3200,
        phone: '+49 231 5551234',
        contactStatus: 'called',
        lastAction: 'Called yesterday, interested',
        priority: 'high',
      },
      {
        id: 8,
        name: 'Hoffmann Sanitär Dortmund',
        city: 'Dortmund',
        score: 79,
        dealValue: 2500,
        phone: '+49 231 6667788',
        contactStatus: 'meeting',
        lastAction: 'Meeting scheduled Feb 18',
        priority: 'medium',
      },
    ],
  },
  {
    id: 'proposal',
    title: 'Proposal Sent',
    status: 'proposal',
    color: 'bg-elvora-purple',
    leads: [
      {
        id: 5,
        name: 'Schneider Wärmetechnik',
        city: 'Bochum',
        score: 88,
        dealValue: 3800,
        phone: '+49 234 1122334',
        contactStatus: 'proposal',
        lastAction: 'Proposal sent Feb 12',
        priority: 'high',
      },
    ],
  },
  {
    id: 'won',
    title: 'Won',
    status: 'won',
    color: 'bg-elvora-success',
    leads: [
      {
        id: 6,
        name: 'Braun SHK Technik GmbH',
        city: 'Essen',
        score: 91,
        dealValue: 4500,
        phone: '+49 201 2233445',
        contactStatus: 'won',
        lastAction: 'Signed Feb 10',
        priority: 'high',
      },
    ],
  },
];

function getPriorityStyles(priority: string): { dot: string; label: string } {
  switch (priority) {
    case 'high':
      return { dot: 'bg-elvora-danger', label: 'High' };
    case 'medium':
      return { dot: 'bg-elvora-warning', label: 'Med' };
    default:
      return { dot: 'bg-elvora-text-dim', label: 'Low' };
  }
}

function getScoreClass(score: number): string {
  if (score >= 85) return 'score-hot';
  if (score >= 70) return 'score-warm';
  return 'score-cold';
}

export default function LeadsPage() {
  const [columns] = useState<Column[]>(initialColumns);

  const totalDeals = columns.reduce((sum, col) => sum + col.leads.length, 0);
  const totalValue = columns.reduce(
    (sum, col) => sum + col.leads.reduce((s, l) => s + (l.dealValue || 0), 0),
    0
  );
  const wonValue = columns
    .find((c) => c.id === 'won')
    ?.leads.reduce((s, l) => s + (l.dealValue || 0), 0) || 0;
  const avgDealSize = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0;
  const winRate = totalDeals > 0
    ? Math.round(((columns.find((c) => c.id === 'won')?.leads.length || 0) / totalDeals) * 100)
    : 0;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Qualified Leads</h1>
          <p className="text-elvora-text-muted text-sm mt-1">Sales pipeline and lead management</p>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {columns.map((column) => (
          <div key={column.id} className="flex flex-col">
            {/* Column Header */}
            <div className="flex items-center gap-2 mb-4 px-1">
              <div className={`w-2 h-2 rounded-full ${column.color}`} />
              <h3 className="text-sm font-semibold text-white">{column.title}</h3>
              <span className="ml-auto text-xs text-elvora-text-dim bg-white/5 px-2 py-0.5 rounded-full">
                {column.leads.length}
              </span>
            </div>

            {/* Column Body */}
            <div className="space-y-3 min-h-[400px]">
              {column.leads.map((lead) => {
                const priorityStyle = getPriorityStyles(lead.priority);
                return (
                  <div
                    key={lead.id}
                    className="glass rounded-xl p-4 card-hover cursor-pointer group"
                  >
                    {/* Card Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="text-sm font-medium text-white group-hover:text-elvora-purple-light transition-colors leading-tight pr-2">
                        {lead.name}
                      </h4>
                      <div className={`${getScoreClass(lead.score)} px-2 py-0.5 rounded-lg flex-shrink-0`}>
                        <span className="text-xs font-bold text-white">{lead.score}</span>
                      </div>
                    </div>

                    {/* City & Priority */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-elvora-text-dim">{lead.city}</span>
                      <span className="text-elvora-text-dim">-</span>
                      <div className="flex items-center gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                        <span className="text-xs text-elvora-text-dim">{priorityStyle.label}</span>
                      </div>
                    </div>

                    {/* Deal Value */}
                    {lead.dealValue && (
                      <div className="mb-3">
                        <span className="text-lg font-bold text-elvora-accent">
                          {lead.dealValue.toLocaleString('de-DE')} EUR
                        </span>
                      </div>
                    )}

                    {/* Last Action */}
                    <p className="text-xs text-elvora-text-dim">{lead.lastAction}</p>

                    {/* Phone */}
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <p className="text-xs text-elvora-text-dim font-mono">{lead.phone}</p>
                    </div>
                  </div>
                );
              })}

              {column.leads.length === 0 && (
                <div className="glass rounded-xl p-8 text-center">
                  <p className="text-sm text-elvora-text-dim">No leads yet</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Stats */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Pipeline Summary</h3>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">Total Deals</p>
            <p className="text-2xl font-bold text-white">{totalDeals}</p>
          </div>
          <div>
            <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">Pipeline Value</p>
            <p className="text-2xl font-bold text-elvora-accent">
              {totalValue.toLocaleString('de-DE')} <span className="text-sm">EUR</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">Avg Deal Size</p>
            <p className="text-2xl font-bold text-elvora-purple-light">
              {avgDealSize.toLocaleString('de-DE')} <span className="text-sm">EUR</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-elvora-text-dim uppercase tracking-wider mb-1">Win Rate</p>
            <p className="text-2xl font-bold text-elvora-success">{winRate}%</p>
            <p className="text-xs text-elvora-text-dim mt-1">
              {wonValue.toLocaleString('de-DE')} EUR won
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
