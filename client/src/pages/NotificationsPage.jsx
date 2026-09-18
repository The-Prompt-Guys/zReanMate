import { Link } from 'react-router-dom';

import { NavyHeader } from '../layouts/AppLayout.jsx';
import { useT } from '../i18n/index.js';

export const NotificationsPage = () => {
  const t = useT();

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

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pt-5 sm:px-6">
        <section className="rounded-card bg-white p-8 text-center shadow-sm ring-1 ring-tint-200/70">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-tint-100 text-navy-800">
            <BellIcon />
          </span>
          <h2 className="mt-4 text-xl font-bold text-navy-900">{t('profile.noNotifications')}</h2>
          <p className="mt-2 text-base text-navy-600">{t('profile.noNotificationsHint')}</p>
        </section>
      </div>
    </main>
  );
};

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 15V10a6 6 0 0 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </svg>
);