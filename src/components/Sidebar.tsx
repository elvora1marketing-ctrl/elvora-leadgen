'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  inboxBadge?: boolean;
  taskBadge?: boolean;
  triggerBadge?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'CRM',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-1a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" /></svg>,
      },
      {
        label: 'Pipeline',
        href: '/leads',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
      },
      {
        label: 'Akquise',
        href: '/akquise',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
      },
      {
        label: 'Aufgaben',
        href: '/tasks',
        taskBadge: true,
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
      },
      {
        label: 'Monitoring',
        href: '/monitoring',
        triggerBadge: true,
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
      },
      {
        label: 'Inbox',
        href: '/inbox',
        inboxBadge: true,
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
      },
      {
        label: 'Kalender',
        href: '/calendar',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
      },
      {
        label: 'Analytics',
        href: '/analytics',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
      },
      {
        label: 'Kunden',
        href: '/clients',
        icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
      },
    ],
  },
  {
    title: 'Tools',
    items: [
      { label: 'Lead-Pool', href: '/lead-pool', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg> },
      { label: 'Maps Scraper', href: '/scraper', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> },
      { label: 'Entscheider-Finder', href: '/linkedin-scraper', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z" /></svg> },
      { label: 'GMB Audit', href: '/gmb-audit', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
      { label: 'SEO-Tool', href: '/seo-tool', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg> },
      { label: 'Lokale SEO', href: '/local-seo', icon: <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg> },
    ],
  },
];

function ElvoraIcon({ size = 36 }: { size?: number }) {
  const id = `ei_${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 141 141" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}_g1`} x1="48.7" y1="8.08" x2="85.52" y2="73.15" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5c67db" />
          <stop offset="1" stopColor="#7944d0" />
        </linearGradient>
        <linearGradient id={`${id}_g2`} x1="91.59" y1="36.08" x2="86.01" y2="128.67" gradientUnits="userSpaceOnUse">
          <stop offset=".31" stopColor="#be34ad" />
          <stop offset="1" stopColor="#e42b79" />
        </linearGradient>
      </defs>
      <path d="M138.4,0L18.24,117.31C6.91,104.86,0,88.3,0,70.14,0,31.4,31.4,0,70.13,0h68.27Z" fill={`url(#${id}_g1)`} />
      <path d="M140.26,26.17v43.97c-1.52,40.91-32.33,71.45-70.14,70.13-12.74-.44-24.7-3.41-35.01-9.36L140.26,26.17Z" fill={`url(#${id}_g2)`} />
    </svg>
  );
}

function ElvoraText({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="170 20 460 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="et_e" x1="198.15" y1="25.51" x2="198.15" y2="114.61" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#725bcd" /><stop offset="1" stopColor="#933ba3" />
        </linearGradient>
        <linearGradient id="et_l" x1="263.41" y1="25.51" x2="263.41" y2="114.61" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#725bcd" /><stop offset="1" stopColor="#933ba3" />
        </linearGradient>
        <linearGradient id="et_v" x1="278.02" y1="24.21" x2="354.99" y2="83.89" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8553c6" /><stop offset="1" stopColor="#b23a94" />
        </linearGradient>
        <linearGradient id="et_o" x1="365.02" y1="71.16" x2="453.76" y2="71.16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d0407d" /><stop offset=".99" stopColor="#ea4064" />
        </linearGradient>
        <linearGradient id="et_r" x1="464.86" y1="71.06" x2="527.91" y2="71.06" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e54d5a" /><stop offset=".99" stopColor="#f04e43" />
        </linearGradient>
        <linearGradient id="et_a" x1="585.84" y1="21.42" x2="585.84" y2="121.27" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f45e3d" /><stop offset=".99" stopColor="#ef3c35" />
        </linearGradient>
      </defs>
      <path d="M172.63,27.9v87.16h51.04v-16.36h-33.19v-18.69h32.54v-16.08h-32.72v-20.64h32.82v-15.4s-50.57,0-50.48,0Z" fill="url(#et_e)" />
      <path d="M237.68,27.9v87.16h51.45v-16.25h-32.77V27.9h-18.69Z" fill="url(#et_l)" />
      <path d="M281.46,27.9l31.79,87.16h19.94l31.51-87.16h-19.24l-21.2,63.95h-1.19l-21.54-63.95h-20.08Z" fill="url(#et_v)" />
      <path d="M453.76,71.16c.22,17.49-11.2,34.16-27.43,40.56-28.79,11.84-61.29-9.21-61.31-40.56.02-31.36,32.51-52.41,61.31-40.56,16.23,6.4,27.65,23.07,27.43,40.56ZM437.12,71.16c0-19.4-20.38-32.31-38.12-24.95-22.49,9.29-22.49,40.61,0,49.9,17.74,7.36,38.11-5.55,38.12-24.95Z" fill="url(#et_o)" />
      <path d="M515.51,82.49s2.15-.88,2.39-1.01c1.62-.82,3.14-1.83,4.55-2.98,4.54-3.69,7.66-8.82,8.93-14.52,1.71-7.74.74-16.28-3.42-23.1-4.8-7.89-13.51-11.85-22.43-13.01-1.86-.24-3.72-.36-5.59-.4-10.35-.16-31.46-.43-31.46.09v87.31h17.3v-28.72h13.94l15.48,28.72h18.41l-18.1-32.38ZM514.32,58.74c0,6.54-5.3,11.85-11.85,11.85h-17.01v-27.19h17.01c6.55,0,11.85,5.3,11.85,11.85v3.48Z" fill="url(#et_r)" />
      <path d="M596.02,27.25h-20.21l-32.07,87.61c0-.21,17.86,0,17.86,0l5.72-17.82h36.66l5.86,17.82h18.13l-31.94-87.62ZM572.09,82.55l13.75-35.98,13.58,35.98h-27.33Z" fill="url(#et_a)" />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const [taskCount, setTaskCount] = useState(0);
  const [triggerCount, setTriggerCount] = useState(0);
  const { logout } = useAuth();

  const loadBadgeCounts = useCallback(async () => {
    try {
      const [inboxRes, taskRes, triggerRes] = await Promise.all([
        fetch('/api/inbox?unread=1&limit=1'),
        fetch('/api/tasks?completed=0&limit=1'),
        fetch('/api/monitoring/triggers?limit=1'),
      ]);
      if (inboxRes.ok) { const d = await inboxRes.json(); setInboxCount(d.unreadCount || 0); }
      if (taskRes.ok) { const d = await taskRes.json(); setTaskCount(d.counts?.overdue || 0); }
      if (triggerRes.ok) { const d = await triggerRes.json(); setTriggerCount((d.counts?.critical || 0) + (d.counts?.high || 0)); }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadBadgeCounts(); const i = setInterval(loadBadgeCounts, 30000); return () => clearInterval(i); }, [loadBadgeCounts]);
  useEffect(() => { setOpen(false); loadBadgeCounts(); }, [pathname, loadBadgeCounts]);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-elvora-bg-alt border-b border-elvora-border flex items-center px-4 z-50 lg:hidden safe-area-top">
        <button onClick={() => setOpen(true)} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-elvora-card transition-colors">
          <svg className="w-5 h-5 text-elvora-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2 ml-3">
          <ElvoraIcon size={26} />
          <ElvoraText className="h-[14px] w-auto" />
        </div>
      </div>

      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/60 z-50 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-[240px] bg-elvora-bg-alt border-r border-elvora-border flex flex-col z-50 transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="px-5 h-16 flex items-center border-b border-elvora-border">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <ElvoraIcon size={32} />
              <ElvoraText className="h-[15px] w-auto" />
            </div>
            <button onClick={() => setOpen(false)} className="lg:hidden w-7 h-7 flex items-center justify-center rounded-md hover:bg-elvora-card">
              <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="px-3 mb-2">
                <span className="text-[11px] text-elvora-text-dim uppercase tracking-wider font-medium">{section.title}</span>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/dashboard');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all relative ${
                        isActive
                          ? 'bg-elvora-purple/[0.08] text-white'
                          : 'text-elvora-text-muted hover:text-elvora-text hover:bg-white/[0.03]'
                      }`}
                    >
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-elvora-purple" />}
                      <span className={isActive ? 'text-elvora-purple-light' : 'text-elvora-text-dim'}>{item.icon}</span>
                      {item.label}
                      {item.inboxBadge && inboxCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-elvora-pink/15 text-elvora-pink text-[10px] font-semibold flex items-center justify-center px-1">{inboxCount}</span>
                      )}
                      {item.taskBadge && taskCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-elvora-warning/15 text-elvora-warning text-[10px] font-semibold flex items-center justify-center px-1">{taskCount}</span>
                      )}
                      {item.triggerBadge && triggerCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-red-500/15 text-red-400 text-[10px] font-semibold flex items-center justify-center px-1">{triggerCount}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 border-t border-elvora-border">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-all relative ${
              pathname === '/settings' ? 'bg-elvora-purple/[0.08] text-white' : 'text-elvora-text-muted hover:text-elvora-text hover:bg-white/[0.03]'
            }`}
          >
            {pathname === '/settings' && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-elvora-purple" />}
            <svg className="w-[18px] h-[18px] text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Einstellungen
          </Link>
          <div className="flex items-center gap-3 px-3 py-2.5 mt-2">
            <div className="w-8 h-8 rounded-full bg-elvora-card border border-elvora-border flex items-center justify-center text-elvora-text-muted text-xs font-semibold flex-shrink-0">A</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-elvora-text font-medium truncate">Admin</div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-elvora-success" />
                <span className="text-[10px] text-elvora-text-dim">Online</span>
              </div>
            </div>
            <button onClick={logout} className="w-7 h-7 flex items-center justify-center rounded-md text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0" title="Abmelden">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
