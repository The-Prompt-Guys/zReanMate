import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { NavyHeader } from '../layouts/AppLayout.jsx';
import { Owl } from '../layouts/AuthLayout.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { LanguageSwitcher, useT } from '../i18n/index.js';
import { useProfile } from '../profile/useProfile.js';

/** docs/screens/10-profile/01-profile-tab. */
export const ProfilePage = () => {
  const t = useT();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { profile, error, update } = useProfile();
  const [reminders, setReminders] = useStoredPreference('reanmate.study-reminders', true);
  const [darkMode, setDarkMode] = useStoredPreference('reanmate.dark-mode', false);
  const shown = profile ?? { fullName: user?.full_name, summary: { kits: 0, streak: 0, mastery: 0 }, activityDays: [] };
  const edit = async () => {
    const fullName = window.prompt(t('profile.edit'), shown.fullName ?? '')?.trim();
    if (fullName) await update({ fullName });
  };
  useEffect(() => {
    document.documentElement.classList.toggle('theme-dark', darkMode);
  }, [darkMode]);

  return (
    <main>
      <NavyHeader className="flex flex-wrap items-center gap-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-white/20 text-2xl font-bold">
          {(shown.fullName ?? 'S').charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-bold">{shown.fullName}</h1>
          <p className="mt-0.5 text-base text-white/75">{t('profile.tagline')}</p>
        </div>
        <button
          type="button"
          onClick={edit}
          className="shrink-0 rounded-full border border-white/50 px-5 py-2 text-base font-semibold"
        >
          {t('profile.edit')}
        </button>
      </NavyHeader>

      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-5 sm:px-6">
        {error && <p className="text-center text-danger-600">{error.message}</p>}
        <section className="rounded-card bg-tint-100 p-5">
          <div className="flex items-start justify-between">
            <h2 className="text-xl font-bold text-navy-900">{t('classes.yourProgress')}</h2>
            <Owl variant="default" className="-mt-2 size-14" />
          </div>

          <dl className="mt-3 grid grid-cols-3 divide-x divide-white/80 text-center">
            <Stat icon={<KitsIcon />} value={shown.summary.kits} label={t('profile.statKits')} />
            <Stat icon={<StreakIcon />} value={shown.summary.streak} label={t('profile.statStreak')} />
            <Stat
              icon={<TargetIcon />}
              value={`${shown.summary.mastery}%`}
              label={t('profile.statMastery')}
            />
          </dl>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy-900">{t('profile.preferences')}</h2>

          <ul className="mt-3 divide-y divide-tint-200 overflow-hidden rounded-card bg-white shadow-sm ring-1 ring-tint-200/70">
            <Row
              icon={<BellIcon />}
              label={t('profile.notifications')}
              onClick={() => navigate('/notifications')}
            />
            <Row
              icon={<ClockIcon />}
              label={t('profile.reminders')}
              onClick={() => setReminders((value) => !value)}
              value={reminders ? t('profile.on') : t('profile.off')}
            />
            <Row
              icon={<MoonIcon />}
              label={t('profile.appearance')}
              onClick={() => setDarkMode((value) => !value)}
              value={darkMode ? t('profile.dark') : t('profile.light')}
            />
            <li className="flex items-center gap-4 px-4 py-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
                <GlobeIcon />
              </span>
              <span className="flex-1 text-lg font-bold text-navy-900">{t('profile.language')}</span>
              <LanguageSwitcher className="rounded-full bg-tint-100 px-4 py-2 text-sm font-bold text-navy-800" />
            </li>
          </ul>

          <ul className="mt-3 divide-y divide-tint-200 overflow-hidden rounded-card bg-white shadow-sm ring-1 ring-tint-200/70">
            <Row icon={<HelpIcon />} label={t('profile.help')} onClick={() => navigate('/assistant')} />
          </ul>

          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-card bg-white py-4 text-lg font-bold text-danger-600 shadow-sm ring-1 ring-tint-200/70"
          >
            {t('auth.logout')}
          </button>
        </section>
      </div>
    </main>
  );
};

const Stat = ({ icon, value, label }) => (
  <div className="min-w-0 px-2">
    <span className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-navy-800">
      {icon}
    </span>
    <dd className="mt-2 text-2xl font-bold text-navy-900">{value}</dd>
    <dt className="mt-0.5 break-words text-sm text-navy-600">{label}</dt>
  </div>
);

const Row = ({ icon, label, onClick, value }) => (
  <li>
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-tint-100/60">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
        {icon}
      </span>
      <span className="flex-1 text-lg font-bold text-navy-900">{label}</span>
      {value && <span className="text-sm font-semibold text-navy-600">{value}</span>}
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  </li>
);

const useStoredPreference = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored == null ? initialValue : stored === 'true';
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, String(value));
    } catch {
      // Preference remains available for this session.
    }
  }, [key, value]);

  return [value, setValue];
};

const p = {
  viewBox: '0 0 24 24',
  className: 'size-6',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const KitsIcon = () => (
  <svg {...p}>
    <rect x="4" y="6" width="13" height="14" rx="2.5" />
    <path d="M9 3h9a2 2 0 0 1 2 2v11" />
  </svg>
);

const StreakIcon = () => (
  <svg {...p}>
    <path d="M13.6 3.5c.4 3.2-1.1 4.6-2.6 6.1-1.1 1.1-1.9 2.2-1.5 4a3.2 3.2 0 0 0 2.8 2.5c-.2-1.7.5-2.8 1.6-3.8 1.4 1.1 2.3 2.6 2.3 4.4A4.7 4.7 0 0 1 11.5 21C7.9 20.8 5 18 5 14.3c0-3.2 2-5.3 4.2-7.3.2 1.8 1 2.7 1.8 3.3.7-1.6 1.6-3.8 2.6-6.8Z" />
  </svg>
);

const TargetIcon = () => (
  <svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="m15 9 5-5m0 0h-3.5M20 4v3.5" />
  </svg>
);

const BellIcon = () => (
  <svg {...p}>
    <path d="M18 15V10a6 6 0 0 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </svg>
);

const ClockIcon = () => (
  <svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const MoonIcon = () => (
  <svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
  </svg>
);

const GlobeIcon = () => (
  <svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 2.5 15 0 18-2.5-3-2.5-15.4 0-18Z" />
  </svg>
);

const HelpIcon = () => (
  <svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .9-1 1.6M12 16.5v.3" />
  </svg>
);
