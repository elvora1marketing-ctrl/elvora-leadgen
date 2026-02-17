'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from './AuthProvider';

const navItems = [
  {
    label: 'Übersicht',
    href: '/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'Leads prüfen',
    href: '/review',
    badge: true,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Pipeline',
    href: '/leads',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: 'GMB Audit',
    href: '/gmb-audit',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Einstellungen',
    href: '/settings',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Prevent body scroll when sidebar open on mobile
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
      <div className="fixed top-0 left-0 right-0 h-14 bg-elvora-bg-alt border-b border-white/5 flex items-center px-4 z-50 lg:hidden safe-area-top">
        <button
          onClick={() => setOpen(true)}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/5 transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="flex items-center gap-2 ml-3">
          <svg width="24" height="24" viewBox="0 0 100 100" className="flex-shrink-0">
            <defs>
              <linearGradient id="elvora-grad-mobile" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#EC4899" />
                <stop offset="100%" stopColor="#F97316" />
              </linearGradient>
            </defs>
            <circle cx="50" cy="50" r="48" fill="url(#elvora-grad-mobile)" />
            <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="42" fontWeight="700" fontFamily="Inter, sans-serif">E</text>
          </svg>
          <span className="text-sm font-bold gradient-text">ELVORA</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-elvora-success pulse-dot" />
          <span className="text-[10px] text-elvora-text-dim">Aktiv</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 bottom-0 w-56 bg-elvora-bg-alt border-r border-white/5 flex flex-col z-50 transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        {/* Elvora Logo */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="36" height="36" viewBox="0 0 100 100" className="flex-shrink-0">
                <defs>
                  <linearGradient id="elvora-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" />
                    <stop offset="50%" stopColor="#EC4899" />
                    <stop offset="100%" stopColor="#F97316" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="48" fill="url(#elvora-grad)" />
                <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fill="white" fontSize="42" fontWeight="700" fontFamily="Inter, sans-serif">E</text>
              </svg>
              <span className="text-lg font-bold gradient-text tracking-tight">ELVORA</span>
            </div>
            {/* Close button on mobile */}
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5"
            >
              <svg className="w-5 h-5 text-elvora-text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-elvora-gradient text-white shadow-elvora'
                    : 'text-elvora-text-muted hover:text-white hover:bg-white/5'
                }`}
              >
                {item.icon}
                {item.label}
                {item.badge && (
                  <span className="ml-auto bg-elvora-pink/20 text-elvora-pink text-xs font-semibold px-2 py-0.5 rounded-full">
                    12
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Scanner Status + Logout */}
        <div className="p-3 border-t border-white/5 space-y-1">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-elvora-success pulse-dot" />
            <span className="text-xs text-elvora-text-dim">Scanner aktiv</span>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-elvora-text-dim hover:text-red-400 hover:bg-red-500/5 transition-all text-xs"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Abmelden
          </button>
        </div>
      </aside>
    </>
  );
}
