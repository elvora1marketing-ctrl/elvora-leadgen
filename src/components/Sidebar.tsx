'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  badge?: boolean;
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
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-1a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1h-4a1 1 0 01-1-1v-5z" />
          </svg>
        ),
      },
      {
        label: 'Pipeline',
        href: '/leads',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        ),
      },
      {
        label: 'Akquise',
        href: '/akquise',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        ),
      },
      {
        label: 'Aufgaben',
        href: '/tasks',
        taskBadge: true,
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
      },
      {
        label: 'Monitoring',
        href: '/monitoring',
        triggerBadge: true,
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        ),
      },
      {
        label: 'Inbox',
        href: '/inbox',
        inboxBadge: true,
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        label: 'Kalender',
        href: '/calendar',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        label: 'Analytics',
        href: '/analytics',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Tools',
    items: [
      {
        label: 'Lead-Pool',
        href: '/lead-pool',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
          </svg>
        ),
      },
      {
        label: 'Maps Scraper',
        href: '/scraper',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        ),
      },
      {
        label: 'Entscheider-Finder',
        href: '/linkedin-scraper',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2zM4 6a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        ),
      },
      {
        label: 'GMB Audit',
        href: '/gmb-audit',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        label: 'SEO-Tool',
        href: '/seo-tool',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ),
      },
      {
        label: 'Lokale SEO',
        href: '/local-seo',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        ),
      },
    ],
  },
];

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
      if (inboxRes.ok) {
        const data = await inboxRes.json();
        setInboxCount(data.unreadCount || 0);
      }
      if (taskRes.ok) {
        const data = await taskRes.json();
        setTaskCount(data.counts?.overdue || 0);
      }
      if (triggerRes.ok) {
        const data = await triggerRes.json();
        setTriggerCount((data.counts?.critical || 0) + (data.counts?.high || 0));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadBadgeCounts();
    const interval = setInterval(loadBadgeCounts, 30000);
    return () => clearInterval(interval);
  }, [loadBadgeCounts]);

  useEffect(() => {
    setOpen(false);
    loadBadgeCounts();
  }, [pathname, loadBadgeCounts]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-elvora-bg-alt/95 backdrop-blur-xl border-b border-white/[0.04] flex items-center px-4 z-50 lg:hidden safe-area-top">
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
        >
          <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2.5 ml-3">
          <div className="w-7 h-7 rounded-lg bg-elvora-gradient flex items-center justify-center">
            <span className="text-white text-xs font-bold">E</span>
          </div>
          <span className="text-sm font-bold gradient-text tracking-tight">ELVORA</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-elvora-success pulse-dot" />
          <span className="text-[10px] text-elvora-text-dim">Aktiv</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-[240px] bg-elvora-bg-alt/95 backdrop-blur-xl border-r border-white/[0.04] flex flex-col z-50 transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-elvora-gradient flex items-center justify-center shadow-elvora-glow-sm">
                <span className="text-white text-sm font-bold">E</span>
              </div>
              <div>
                <span className="text-[15px] font-bold gradient-text tracking-tight">ELVORA</span>
                <div className="text-[10px] text-elvora-text-dim -mt-0.5">Lead Generator</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
            >
              <svg className="w-4 h-4 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="px-3 mb-2">
                <span className="text-[10px] text-elvora-text-dim uppercase tracking-[0.15em] font-semibold">{section.title}</span>
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/dashboard');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 group ${
                        isActive
                          ? 'nav-active text-white'
                          : 'text-elvora-text-muted hover:text-white hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className={`transition-colors ${isActive ? 'text-elvora-purple-light' : 'text-elvora-text-dim group-hover:text-elvora-text-muted'}`}>
                        {item.icon}
                      </span>
                      {item.label}
                      {item.inboxBadge && inboxCount > 0 && (
                        <span className="ml-auto w-5 h-5 rounded-full bg-elvora-pink/20 text-elvora-pink text-[10px] font-bold flex items-center justify-center animate-pulse">
                          {inboxCount}
                        </span>
                      )}
                      {item.taskBadge && taskCount > 0 && (
                        <span className="ml-auto w-5 h-5 rounded-full bg-elvora-warning/20 text-elvora-warning text-[10px] font-bold flex items-center justify-center">
                          {taskCount}
                        </span>
                      )}
                      {item.triggerBadge && triggerCount > 0 && (
                        <span className="ml-auto w-5 h-5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center justify-center animate-pulse">
                          {triggerCount}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom: User + Settings */}
        <div className="px-3 py-3 border-t border-white/[0.04] space-y-1">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all duration-200 ${
              pathname === '/settings'
                ? 'nav-active text-white'
                : 'text-elvora-text-muted hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            <svg className="w-[18px] h-[18px] text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Einstellungen
          </Link>

          {/* User profile section */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1">
            <div className="w-8 h-8 rounded-full bg-elvora-gradient flex items-center justify-center text-white text-xs font-bold shadow-elvora-glow-sm flex-shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] text-white font-medium truncate">Admin</div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-elvora-success pulse-dot" />
                <span className="text-[10px] text-elvora-text-dim">Online</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-elvora-text-dim hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
              title="Abmelden"
            >
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
