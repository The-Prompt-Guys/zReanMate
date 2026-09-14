import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { NavyHeader } from '../layouts/AppLayout.jsx';
import { BrandLogo, Owl } from '../layouts/AuthLayout.jsx';
import { KitCard } from '../components/KitCard.jsx';
import { ArrowRightIcon } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { isDemo, loadDemoFixtures } from '../mock/mode.js';
import { useKits } from '../kits/KitsContext.jsx';
import { useLanguage, useT } from '../i18n/index.js';

/**
 * Builds the month grid the calendar header renders.
 *
 * There is no /me/agenda endpoint (see docs/API-CONTRACT.md, "Never built"), and
 * a month grid needs no server: it is the current date plus whichever days carry
 * an assignment. `days` is padded with nulls so the 1st lands under its weekday,
 * Sunday-first to match DAY_INITIALS.
 *
 * @param {string} language - 'km' or 'en', for the month label
 * @param {number[]} [marked] - days of this month that have work due
 */
const currentMonthCalendar = (language = 'en', marked = []) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const leading = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return {
    label: new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en-US', {
      month: 'long',
      year: 'numeric',
    }).format(now),
    days: [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ],
    today: now.getDate(),
    marked,
  };
};

/**
 * docs/screens/02-dashboard/ — three variants of one screen:
 *
 *   (default)        01-dashboard-populated-navy-no-quote
 *   ?empty=1         main dashboard, before any kit exists
 *   ?header=calendar 03-navy-owl-calendar-top, with the month calendar,
 *                    assignment dates and class cards
 */
export const DashboardPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { kits, status: kitsStatus } = useKits();
  const [params] = useSearchParams();
  const [headerProgress, setHeaderProgress] = useState(0);
  const [calendarData, setCalendarData] = useState(() => currentMonthCalendar(language));
  const [dashboardClasses, setDashboardClasses] = useState([]);
  const [assignmentDates, setAssignmentDates] = useState([]);

  // ?empty=1 forces the empty state for design review; a real account with no
  // kits gets it too. Waiting for `kitsStatus` keeps it from flashing over the
  // grid while the first fetch is still in flight.
  const isEmpty = params.get('empty') === '1' || (kitsStatus !== 'loading' && kits.length === 0);
  const withCalendar = params.get('header') === 'calendar';

  useEffect(() => {
    if (!withCalendar) return;
    let active = true;
    const load = async () => {
      if (isDemo()) {
        const fixtures = await loadDemoFixtures();
        if (active) {
          setCalendarData(fixtures.septemberCalendar);
          setDashboardClasses(fixtures.classes);
          setAssignmentDates(fixtures.assignmentDates);
        }
        return;
      }
      const { data } = await api.get('/classes');
      const details = await Promise.all(data.classes.slice(0, 4).map((item) => api.get(`/classes/${item.id}`)));
      if (!active) return;
      setDashboardClasses(data.classes);

      const due = details.flatMap(({ data: detail }) => detail.assignments.map((item) => ({
        title: item.title, course: detail.class.title, at: new Date(item.dueAt),
      })));
      setAssignmentDates(due.slice(0, 4).map((item) => ({
        title: item.title, course: item.course,
        month: new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en', { month: 'short' }).format(item.at),
        day: item.at.getDate(),
      })));

      // Only this month's due dates get a dot — the grid shows one month.
      const now = new Date();
      setCalendarData(currentMonthCalendar(language, [...new Set(due
        .filter((item) => item.at.getMonth() === now.getMonth() && item.at.getFullYear() === now.getFullYear())
        .map((item) => item.at.getDate()))]));
    };
    load().catch(() => { if (active) { setDashboardClasses([]); setAssignmentDates([]); } });
    return () => { active = false; };
  }, [language, withCalendar]);

  useEffect(() => {
    let frame;
    const updateHeader = () => {
      frame = undefined;
      setHeaderProgress(Math.min(window.scrollY / 180, 1));
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateHeader);
    };

    updateHeader();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <main>
      <NavyHeader
        className="will-change-transform transition-[transform,opacity] duration-150 ease-out"
        style={{
          transform: `translateY(-${Math.round(headerProgress * 32)}px)`,
          opacity: 1 - headerProgress * 0.2,
        }}
      >
        <div className="flex items-start justify-between">
          <BrandLogo />
          <button
            type="button"
            aria-label={t('profile.notifications')}
            className="grid size-10 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <BellIcon />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.7rem] font-bold leading-[1.15]">
              {t('dashboard.welcome', { name: user?.full_name ?? '' })}
            </h1>
            <Link
              to="/kits"
              className="mt-5 inline-flex rounded-full bg-white px-7 py-3.5 text-base font-bold text-navy-900"
            >
              {t('dashboard.startStudying')}
            </Link>
          </div>
          <Owl variant="waving" className="-mb-2 size-28 shrink-0" />
        </div>
      </NavyHeader>

      <div className="space-y-6 px-5 pt-5">
        <Link
          to="/kits/new"
          className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white">
            <PlusIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold text-navy-900">{t('dashboard.addMaterial')}</span>
            <span className="block text-sm text-navy-600">{t('dashboard.addMaterialHint')}</span>
          </span>
          <ArrowRightIcon className="size-5 shrink-0 text-navy-800" />
        </Link>

        {withCalendar && (
          <>
            <section className="grid grid-cols-2 gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70">
              <MonthCalendar data={calendarData} />
              <div className="min-w-0 border-s border-tint-200 ps-4">
                <h2 className="font-bold text-navy-900">{t('dashboard.assignmentDates')}</h2>
                <ul className="mt-3 space-y-3">
                  {assignmentDates.map((item) => (
                    <li key={item.title} className="flex items-start gap-2.5">
                      <span className="grid shrink-0 rounded-lg bg-gold-400/30 px-2.5 py-1.5 text-center">
                        <span className="text-[0.65rem] font-semibold text-navy-700">{item.month}</span>
                        <span className="text-lg font-bold leading-none text-navy-900">{item.day}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold leading-snug text-navy-900">
                          {item.title}
                        </span>
                        <span className="block text-xs text-navy-600">{item.course}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-navy-900">{t('classes.yourClasses')}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {dashboardClasses.map((klass, index) => (
                  <Link
                    key={klass.id}
                    to={`/classes/${klass.id}`}
                    className="rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-tint-100 text-navy-800">
                      {index % 2 === 0 ? <LaptopIcon /> : <BookIcon />}
                    </span>
                    <span className="mt-2.5 block font-bold leading-snug text-navy-900">
                      {language === 'km' ? klass.titleKm ?? klass.title : klass.title}
                    </span>
                    <span className="mt-1.5 block text-sm text-navy-600">{klass.teacher}</span>
                    <span className="mt-2 flex items-center gap-1.5 text-sm text-navy-700">
                      <span className="size-2 rounded-full bg-gold-400" aria-hidden="true" />
                      {t('classes.lessonsCompleted', { done: klass.lessonsDone ?? 0, total: klass.lessonCount ?? 0 })}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </>
        )}

        <section>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-navy-900">{t('dashboard.studyKits')}</h2>
              {isEmpty && (
                <p className="text-sm text-navy-600">{t('dashboard.studyKitsReady')}</p>
              )}
            </div>
            {!isEmpty && (
              <Link to="/kits" className="flex items-center gap-1 text-sm font-semibold text-navy-700">
                {t('common.seeAll')}
                <ArrowRightIcon className="size-4" />
              </Link>
            )}
          </div>

          {isEmpty ? (
            <div className="mt-3 rounded-card bg-white px-6 py-8 text-center shadow-sm ring-1 ring-tint-200/70">
              <EmptyKitArt />
              <h3 className="mt-4 text-xl font-bold text-navy-900">{t('dashboard.emptyTitle')}</h3>
              <p className="mt-1.5 text-base text-navy-600">{t('dashboard.emptyBody')}</p>
              <Link
                to="/kits/new"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-navy-800 px-6 py-3.5 text-base font-bold text-white"
              >
                {t('dashboard.emptyAction')}
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3">
              {kits.slice(0, 4).map((kit) => (
                <KitCard key={kit.id} kit={kit} compact />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

/** The month grid from docs/screens/02-dashboard/03. */
const MonthCalendar = ({ data }) => {
  const t = useT();
  const { label, days, today, marked } = data;
  const DAY_INITIALS = ['s', 'm', 't', 'w', 'th', 'f', 'sa'];

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between">
        <button type="button" aria-label={t('common.previous')} className="text-navy-800">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-sm font-bold text-navy-900">{label}</p>
        <button type="button" aria-label={t('common.next')} className="text-navy-800">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
        {DAY_INITIALS.map((key, i) => (
          <span key={i} className="text-[0.6rem] font-semibold text-navy-600">
            {t(`dashboard.dayInitial_${key}`)}
          </span>
        ))}
        {days.map((day, i) =>
          day === null ? (
            <span key={`blank-${i}`} />
          ) : (
            <span key={day} className="relative grid place-items-center py-0.5">
              <span
                className={`grid size-6 place-items-center rounded-full text-xs ${
                  day === today ? 'bg-navy-800 font-bold text-white' : 'font-semibold text-navy-800'
                }`}
              >
                {day}
              </span>
              {marked.includes(day) && (
                <span className="mt-0.5 size-1 rounded-full bg-gold-400" aria-hidden="true" />
              )}
            </span>
          ),
        )}
      </div>
    </div>
  );
};

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 15V10a6 6 0 0 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 7c-2-1.6-4.4-2-7-2v12c2.6 0 5 .4 7 2 2-1.6 4.4-2 7-2V5c-2.6 0-5 .4-7 2z" />
    <path d="M12 7v12" />
  </svg>
);

const LaptopIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M2 20h20" />
  </svg>
);

/** The document-with-plus illustration on the empty state. */
const EmptyKitArt = () => (
  <svg viewBox="0 0 96 88" className="mx-auto size-24" fill="none" aria-hidden="true">
    <path d="M32 12h22l14 14v42a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4Z" fill="#fff" stroke="#0C3C85" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M54 12v14h14" stroke="#0C3C85" strokeWidth="2.6" strokeLinejoin="round" />
    <path d="M37 36h20M37 44h20M37 52h12" stroke="#0C3C85" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="70" cy="60" r="11" fill="#FDC96A" />
    <path d="M70 55v10M65 60h10" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
    <path d="M18 30h8M16 40h6M20 50h6" stroke="#0C3C85" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M76 20l3 5M84 28h-5" stroke="#0C3C85" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);
