import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { NavyHeader } from '../layouts/AppLayout.jsx';
import { useT } from '../i18n/index.js';

const STORAGE_KEY = 'reanmate.notifications-enabled';

export const NotificationsPage = () => {
  const t = useT();
  const [enabled, setEnabled] = useStoredBoolean(STORAGE_KEY, true);
  const [permission, setPermission] = useState(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === 'granted') setEnabled(true);
  };

  const browserSupported = permission !== 'unsupported';
  const granted = permission === 'granted';

  return (
    <main>
      <NavyHeader>
        <Link to="/profile" aria-label={t('common.back')} className="mb-4 inline-flex text-base font-semibold text-white/85">
          <span aria-hidden="true" className="mr-2 text-xl">←</span>
          {t('profile.title')}
        </Link>
        <h1 className="text-3xl font-bold">{t('profile.notificationsTitle')}</h1>
        <p className="mt-1 text-base text-white/75">{t('profile.notificationsSubtitle')}</p>
      </NavyHeader>

      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-5 sm:px-6">
        <section className="rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
              <BellIcon />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-navy-900">{t('profile.browserNotifications')}</h2>
              <p className="mt-1 text-base text-navy-600">{t('profile.browserNotificationsHint')}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={browserSupported && !granted ? requestPermission : () => setEnabled((value) => !value)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled && granted ? 'bg-brand-600' : 'bg-tint-200'}`}
            >
              <span className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${enabled && granted ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <p className={`mt-5 rounded-field p-3 text-sm font-semibold ${granted ? 'bg-tint-100 text-navy-800' : 'bg-danger-50 text-danger-600'}`}>
            {granted ? t('profile.notificationsAllowed') : t('profile.notificationsBlocked')}
          </p>

          {browserSupported && !granted && (
            <button type="button" onClick={requestPermission} className="mt-4 w-full rounded-card bg-brand-600 px-4 py-3 text-base font-bold text-white">
              {t('profile.enableNotifications')}
            </button>
          )}
        </section>
      </div>
    </main>
  );
};

const useStoredBoolean = (key, initialValue) => {
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

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 15V10a6 6 0 0 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </svg>
);