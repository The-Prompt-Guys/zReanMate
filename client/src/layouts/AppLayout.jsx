import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';

import { useT } from '../i18n/index.js';

/**
 * Shell for the signed-in app: a scrolling body above a fixed bottom tab bar,
 * capped near a phone width because every screen in docs/screens/ is a phone
 * mockup.
 *
 * The tab set is not fixed — docs/screens/02-dashboard/01 shows four tabs and
 * the Classes variant shows five — so `Classes` appears only for a user who has
 * one. The prototype user is a student with a class, so it shows.
 */

const TABS = [
  { to: '/', labelKey: 'nav.home', Icon: HomeIcon, end: true },
  { to: '/kits', labelKey: 'nav.kits', Icon: KitsIcon },
  { to: '/classes', labelKey: 'nav.classes', Icon: ClassesIcon },
  { to: '/practice', labelKey: 'nav.practice', Icon: PracticeIcon },
  { to: '/profile', labelKey: 'nav.profile', Icon: ProfileIcon },
];

export const AppLayout = () => {
  const t = useT();
  const { pathname } = useLocation();
  // Holds the code, not a boolean: a countable cap and a plan-gated feature are
  // different messages, and showing "you have reached your free limit" for a
  // Plus-only feature tells the user to delete things that are not the problem.
  const [planWall, setPlanWall] = useState(null);
  useEffect(() => {
    const show = (event) => setPlanWall(event.detail?.code ?? 'quota_exceeded');
    window.addEventListener('reanmate:plan-wall', show);
    return () => window.removeEventListener('reanmate:plan-wall', show);
  }, []);

  // Immersive screens (quiz, flashcards, tutor) own the full height and hide
  // the tab bar, matching the screenshots where it is absent.
  const immersive = /^\/(quiz|flashcards|tutor|study)\b/.test(pathname);

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col bg-canvas">
        {planWall && <div className="sticky top-0 z-30 flex items-center gap-3 bg-gold-400 px-4 py-3 text-sm font-semibold text-navy-900"><span className="flex-1">{t(planWall === 'feature_unavailable' ? 'plan.featureWall' : 'kits.quotaTitle')}</span><Link to="/onboarding/plan" className="underline">{t('profile.upgrade')}</Link><button type="button" onClick={() => setPlanWall(null)} aria-label={t('common.close')}>×</button></div>}
        <div className={immersive ? 'flex-1' : 'flex-1 pb-24'}>
          <Outlet />
        </div>

        {!immersive && (
          <nav
            aria-label={t('nav.home')}
            className="fixed bottom-0 z-20 w-full max-w-[26rem] border-t border-tint-200 bg-white/95 backdrop-blur"
          >
            <ul className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
              {TABS.map(({ to, labelKey, Icon, end }) => (
                <li key={to} className="flex-1">
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-1 py-2.5 text-xs font-semibold transition-colors ${
                        isActive ? 'text-navy-800' : 'text-navy-600/55'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon filled={isActive} />
                        <span>{t(labelKey)}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
};

/**
 * Navy hero used at the top of Home, Kits and Classes — square bottom edge,
 * white text, per the current kits/header treatment.
 */
export const NavyHeader = ({ children, className = '', ...props }) => (
  <header className={`bg-navy-800 px-6 pb-7 pt-6 text-white ${className}`} {...props}>
    {children}
  </header>
);

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function HomeIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...stroke} fill={filled ? 'currentColor' : 'none'}>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function KitsIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...stroke} fill={filled ? 'currentColor' : 'none'}>
      <path d="M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 8l2-4h14l2 4M10 12h4" stroke="currentColor" fill="none" />
    </svg>
  );
}

function ClassesIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...stroke} fill={filled ? 'currentColor' : 'none'}>
      <path d="M12 7c-2-1.6-4.4-2-7-2v12c2.6 0 5 .4 7 2 2-1.6 4.4-2 7-2V5c-2.6 0-5 .4-7 2z" />
      <path d="M12 7v12" stroke="currentColor" fill="none" />
    </svg>
  );
}

function PracticeIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...stroke} fill={filled ? 'currentColor' : 'none'}>
      <path d="M4 19.5 5.5 15 16 4.5a2.1 2.1 0 0 1 3 3L8.5 18z" />
      <path d="M14.5 6 18 9.5" stroke="currentColor" fill="none" />
    </svg>
  );
}

function ProfileIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true" {...stroke} fill={filled ? 'currentColor' : 'none'}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}
