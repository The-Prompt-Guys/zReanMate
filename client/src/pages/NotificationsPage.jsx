import { useState } from 'react';
import { Link } from 'react-router-dom';

import { NavyHeader } from '../layouts/AppLayout.jsx';
import { useT } from '../i18n/index.js';

export const NotificationsPage = () => {
  const t = useT();
  const [notifications, setNotifications] = useState(() => [
    { id: 'assignment', title: t('profile.notificationAssignmentTitle'), body: t('profile.notificationAssignmentBody'), time: t('profile.notificationToday'), read: false },
    { id: 'study', title: t('profile.notificationStudyTitle'), body: t('profile.notificationStudyBody'), time: t('profile.notificationOneHourAgo'), read: false },
    { id: 'quiz', title: t('profile.notificationQuizTitle'), body: t('profile.notificationQuizBody'), time: t('profile.notificationYesterday'), read: true },
  ]);
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const markRead = (id) => setNotifications((items) => items.map((item) => item.id === id ? { ...item, read: true } : item));
  const markAllRead = () => setNotifications((items) => items.map((item) => ({ ...item, read: true })));

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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-navy-900">{t('profile.notificationsTitle')}</h2>
          {unreadCount > 0 && <button type="button" onClick={markAllRead} className="text-sm font-bold text-brand-600">{t('profile.markAllRead')}</button>}
        </div>

        <ul className="space-y-3">
          {notifications.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => markRead(notification.id)}
                className={`flex w-full items-start gap-4 rounded-card p-4 text-left shadow-sm ring-1 ring-tint-200/70 transition-colors ${notification.read ? 'bg-white' : 'bg-tint-100'}`}
              >
                <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${notification.read ? 'bg-tint-100' : 'bg-brand-600 text-white'}`}>
                  <BellIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <strong className="text-base font-bold text-navy-900">{notification.title}</strong>
                    {!notification.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-600" aria-label={t('profile.unread')} />}
                  </span>
                  <span className="mt-1 block text-sm text-navy-600">{notification.body}</span>
                  <span className="mt-2 block text-xs font-semibold text-ink-500">{notification.time}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
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