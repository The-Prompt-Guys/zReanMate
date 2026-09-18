import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { NavyHeader } from '../layouts/AppLayout.jsx';
import { BrandLockup, Owl } from '../layouts/AuthLayout.jsx';
import { KitRow } from './kits/KitsPage.jsx';
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

/** How far the hero travels before it is fully collapsed. */
const HEADER_TRAVEL = 150;

/**
 * Holds the page still when there is not enough of it to scroll.
 *
 * A short dashboard still scrolls a handful of pixels, which is enough to
 * rubber-band on a phone and to half-collapse the header for no gain. Below
 * `travel` the collapse could not finish anyway, so scrolling is locked until
 * real content arrives — the observer re-measures when kits land or the window
 * resizes.
 *
 * The lock is a class on <html> rather than an inline style on <body>, because
 * BottomSheet sets and restores that inline style and the two would fight.
 */
const useScrollLock = (travel, signal) => {
  useEffect(() => {
    const root = document.documentElement;

    const measure = () => {
      const locked = root.scrollHeight - root.clientHeight < travel;
      // Locking a page that is already scrolled would strand it mid-scroll with
      // no way back, so it is returned to the top first.
      if (locked && window.scrollY > 0) window.scrollTo(0, 0);
      root.classList.toggle('scroll-locked', locked);
    };

    // `signal` re-runs this whenever what is on the page changes — the kits
    // arriving is a React state change, which is a far more dependable trigger
    // than waiting for a layout observer to notice the body grew. The rAF lets
    // that render reach layout before anything is measured.
    const frame = window.requestAnimationFrame(measure);

    // Belt and braces for everything React cannot see: a rotate, a desktop
    // resize, an image finally decoding.
    const observer = new ResizeObserver(() => window.requestAnimationFrame(measure));
    observer.observe(document.body);
    observer.observe(root);
    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      root.classList.remove('scroll-locked');
    };
  }, [travel, signal]);
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

  // Below the header's own travel there is nothing worth scrolling for, so the
  // page is held still rather than rubber-banding over a few stray pixels. The
  // signal re-measures once the kits have actually rendered.
  useScrollLock(HEADER_TRAVEL, `${kitsStatus}:${kits.length}:${isEmpty}:${withCalendar}`);

  /**
   * The hero lifts and fades as the page scrolls under it.
   *
   * Someone who has asked for reduced motion gets none of it — a parallax
   * header is exactly the kind of movement that setting is for — so the
   * progress is pinned at 0 and the panel simply scrolls with the page.
   */
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return undefined;

    let frame;
    const updateHeader = () => {
      frame = undefined;
      setHeaderProgress(Math.min(window.scrollY / HEADER_TRAVEL, 1));
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
      {/*
        Pinned rather than scrolled away, so the content below rides up over it
        instead of dragging a gap behind — the panel reads as sliding under the
        list. No CSS transition: the value is already driven frame-by-frame off
        the scroll position, and easing it would only add lag.
      */}
      <NavyHeader
        className="sticky top-0 z-0 will-change-transform"
        style={{
          transform: `translateY(-${Math.round(headerProgress * 52)}px)`,
          opacity: 1 - headerProgress * 0.55,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <BrandLockup />
          {/*
            The reference draws an unread badge on this bell. There is no
            notifications endpoint (docs/API-CONTRACT.md lists none), so the
            badge is left off rather than shipped with a hardcoded count.
          */}
          <button
            type="button"
            aria-label={t('profile.notifications')}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <BellIcon />
          </button>
        </div>

        <div className="mt-5 flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h1 className="greeting text-[1.65rem] font-extrabold tracking-tight">
              {t('dashboard.welcome', { name: user?.full_name ?? '' })}
            </h1>
            <Link
              to="/kits"
              className="mt-5 inline-flex rounded-full bg-white px-7 py-3 text-base font-extrabold text-brand-600"
            >
              {t('dashboard.startStudying')}
            </Link>
          </div>
          <Owl variant="waving" className="-mb-3 size-32 shrink-0" />
        </div>
      </NavyHeader>

      <div className="relative z-10 space-y-6 bg-canvas px-5 pt-5">
        {/* /kits/add asks which kit first; with no kits to choose between it
            forwards to /kits/new, which is where the empty state below points
            directly. */}
        <Link
          to="/kits/add"
          className="flex items-center gap-3.5 rounded-card bg-white p-3 shadow-sm ring-1 ring-tint-200/70"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
            <PlusIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-extrabold text-ink-900">{t('dashboard.addMaterial')}</span>
            <span className="block text-base font-medium text-ink-600">{t('dashboard.addMaterialHint')}</span>
          </span>
          <ArrowRightIcon className="size-5 shrink-0 text-ink-900" />
        </Link>

        {withCalendar && (
          <>
            <section className="grid grid-cols-2 gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70">
              <MonthCalendar data={calendarData} />
              <div className="min-w-0 border-s border-tint-200 ps-4">
                <h2 className="font-extrabold text-ink-900">{t('dashboard.assignmentDates')}</h2>
                <ul className="mt-3 space-y-3">
                  {assignmentDates.map((item) => (
                    <li key={item.title} className="flex items-start gap-2.5">
                      <span className="grid shrink-0 rounded-lg bg-gold-400/30 px-2.5 py-1.5 text-center">
                        <span className="text-[0.65rem] font-bold text-ink-600">{item.month}</span>
                        <span className="text-lg font-extrabold leading-none text-ink-900">{item.day}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold leading-snug text-ink-900">
                          {item.title}
                        </span>
                        <span className="block text-xs font-medium text-ink-600">{item.course}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-extrabold text-ink-900">{t('classes.yourClasses')}</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {dashboardClasses.map((klass, index) => (
                  <Link
                    key={klass.id}
                    to={`/classes/${klass.id}`}
                    className="rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
                  >
                    <span className="grid size-11 place-items-center rounded-xl bg-tint-100 text-brand-600">
                      {index % 2 === 0 ? <LaptopIcon /> : <BookIcon />}
                    </span>
                    <span className="mt-2.5 block font-bold leading-snug text-ink-900">
                      {language === 'km' ? klass.titleKm ?? klass.title : klass.title}
                    </span>
                    <span className="mt-1.5 block text-sm font-medium text-ink-600">{klass.teacher}</span>
                    <span className="mt-2 flex items-center gap-1.5 text-sm font-medium text-ink-600">
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
              <h2 className="text-xl font-extrabold text-ink-900">{t('dashboard.studyKits')}</h2>
              {isEmpty && (
                <p className="text-base font-medium text-ink-600">{t('dashboard.studyKitsReady')}</p>
              )}
            </div>
            {!isEmpty && (
              <Link to="/kits" className="flex items-center gap-1 text-sm font-bold text-brand-600">
                {t('common.seeAll')}
                <ChevronRightIcon className="size-4" />
              </Link>
            )}
          </div>

          {isEmpty ? (
            <div className="mt-3 rounded-card bg-white px-5 py-5 text-center shadow-sm ring-1 ring-tint-200/70">
              <EmptyKitArt />
              <h3 className="mt-3 text-lg font-extrabold tracking-tight text-ink-900">
                {t('dashboard.emptyTitle')}
              </h3>
              <p className="mt-1 text-sm font-medium text-ink-600">{t('dashboard.emptyBody')}</p>
              <Link
                to="/kits/add"
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2 text-sm font-extrabold text-white"
              >
                {t('dashboard.emptyAction')}
                <ChevronRightIcon className="size-4" />
              </Link>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {kits.slice(0, 4).map((kit) => (
                <KitRow key={kit.id} kit={kit} />
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
        <button type="button" aria-label={t('common.previous')} className="text-brand-600">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="m15 6-6 6 6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-sm font-extrabold text-ink-900">{label}</p>
        <button type="button" aria-label={t('common.next')} className="text-brand-600">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-y-1 text-center">
        {DAY_INITIALS.map((key, i) => (
          <span key={i} className="text-[0.6rem] font-bold text-ink-600">
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
                  day === today ? 'bg-brand-600 font-bold text-white' : 'font-semibold text-ink-900'
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

/** The reference ends its buttons with a chevron, not the full-shaft arrow. */
const ChevronRightIcon = ({ className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <path d="m9.5 5 7 7-7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
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

/**
 * The document-with-plus illustration on the empty state.
 *
 * Inked in `currentColor` rather than navy — the reference draws this line art
 * in the same near-black as the headings. The badge takes a gradient because
 * the reference lights it from the top-left, and the motion marks to the left
 * and the burst top-right are part of the drawing, not decoration to drop.
 */
const EmptyKitArt = () => (
  <svg viewBox="0 0 84 50" className="mx-auto h-12 w-auto text-ink-900" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="kit-badge-fill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="var(--color-gold-300)" />
        <stop offset="100%" stopColor="var(--color-gold-500)" />
      </linearGradient>
    </defs>
    <path d="M31 2.5h20l13 13v30.5a2.5 2.5 0 0 1-2.5 2.5H31a2.5 2.5 0 0 1-2.5-2.5V5a2.5 2.5 0 0 1 2.5-2.5Z" fill="#fff" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M51 2.5v13h13" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    <path d="M35 21h11M48.5 24.5h5M35 28h13M35 35h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <circle cx="60" cy="38" r="10" fill="url(#kit-badge-fill)" />
    <path d="M60 33.5v9M55.5 38h9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M3 21h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m6 31 4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="m70 6-2 6m9-3-5 3.5m7 4.5h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
