import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/AuthContext.jsx';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { BrandLockup, Owl } from '../../layouts/AuthLayout.jsx';
import { useT } from '../../i18n/index.js';
import { useTeacherDashboard } from './useTeacher.js';

/**
 * The teacher's home, from docs/screens — the mirror of the student dashboard.
 *
 * Built out of the same pieces as every other screen in the app: the navy
 * `hero-panel` header, `BrandLockup`, the owl artwork, design tokens and real
 * SVG icons. It previously drew itself out of emoji and hardcoded hex — which
 * is why the header was the wrong blue, the icons rendered as ♧ and ▤ on
 * Windows, and the mascot was whatever the font happened to have.
 *
 * It also drew its own phone frame and its own bottom nav. Both are the
 * layout's job: the frame is AppLayout's max-width column, and the tab bar is
 * AppLayout's, which now switches to the teacher set. Drawing them here is what
 * put two tab bars on screen at once.
 */
export const TeacherDashboardPage = () => {
  const t = useT();
  const { user } = useAuth();
  const { data, status } = useTeacherDashboard();
  const [selectedClassId, setSelectedClassId] = useState('');
  const name = user?.full_name ?? user?.fullName ?? t('teacher.defaultName');
  const summary = data?.summary ?? {};
  const classes = data?.classes ?? [];
  const activeClassId = selectedClassId || classes[0]?.id || '';
  const selectedClass = classes.find((item) => item.id === activeClassId);
  const classAssignments = useMemo(
    () => (data?.assignments ?? []).filter((item) => item.classId === activeClassId),
    [activeClassId, data?.assignments],
  );
  const firstAssignment = classAssignments[0];
  const submitted = firstAssignment?.submissionCount ?? 0;
  const students = firstAssignment?.studentCount ?? 0;
  const submissionPercent = students ? Math.round((submitted / students) * 100) : 0;
  const pendingReviews = classAssignments.reduce((total, item) => total + (Number(item.pendingCount) || 0), 0);
  const lateAssignments = classAssignments.filter((item) => item.dueAt && new Date(item.dueAt) < new Date()).length;

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start justify-between gap-3">
          <BrandLockup />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={t('teacher.notifications')}
              className="grid size-10 place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
            >
              <BellIcon />
            </button>
            <Link to="/teacher/profile" aria-label={t('teacher.profileNav')} className="shrink-0">
              <Avatar user={user} name={name} />
            </Link>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-2">
          {/* Two lines, broken after the greeting rather than mid-name —
              "Welcome, Mr." / "Sok Dara" reads as a mistake. */}
          <h1 className="greeting min-w-0 flex-1 text-[1.65rem] font-extrabold leading-tight tracking-tight">
            {t('teacher.welcome')}
            <br />
            {name}
          </h1>
          <Owl variant="waving" className="-mb-3 size-32 shrink-0" />
        </div>
      </NavyHeader>

      <div className="space-y-4 px-5 pt-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<CapIcon />} label={t('teacher.activeClasses')} value={summary.activeClasses ?? 0} />
          <StatCard icon={<StudentsIcon />} label={t('teacher.totalStudents')} value={summary.totalStudents ?? 0} />
        </div>

        <section className="rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-extrabold leading-tight text-ink-900">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tint-100 text-brand-600">
                <SubmissionIcon />
              </span>
              <span className="min-w-0">{t('teacher.assignmentSubmissions')}</span>
            </h2>
            <Link
              to="/teacher/assignments"
              className="flex shrink-0 items-center gap-1 text-sm font-bold text-brand-600"
            >
              {t('teacher.viewAll')}
              <ChevronRightIcon className="size-4" />
            </Link>
          </div>

          <p className="mt-3 text-sm font-semibold text-ink-600">{t('teacher.selectClassLabel')}</p>
          {/*
            A button, not a styled div: it is a control the teacher is meant to
            operate, and the class list it opens is the next thing to build.
          */}
          <label className="relative mt-1.5 flex w-full items-center gap-2.5 rounded-2xl bg-tint-100 px-3.5 py-3 transition-colors hover:bg-tint-200">
            <BookIcon />
            <select
              aria-label={t('teacher.selectClassLabel')}
              value={activeClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="min-w-0 flex-1 appearance-none bg-transparent pr-8 text-base font-bold text-brand-600 outline-none"
            >
              {!classes.length && <option value="">{t('teacher.selectClass')}</option>}
              {classes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <ChevronDownIcon className="pointer-events-none" />
          </label>

          {/* Divided rather than spaced: the reference rules between the three
              so they read as one breakdown of the same class, not three cards. */}
          <div className="mt-4 grid grid-cols-3 divide-x divide-tint-200">
            <Metric label={t('teacher.submittedLabel')} value={`${submitted} / ${students}`} tone="text-navy-800" bar="bg-navy-800" width={`${submissionPercent}%`} />
            <Metric label={t('teacher.pending')} value={pendingReviews} tone="text-gold-500" bar="bg-gold-500" width="38%" className="px-3" />
            <Metric label={t('teacher.late')} value={lateAssignments} tone="text-danger-600" bar="bg-danger-600" width="22%" className="ps-3" />
          </div>

          <Link
            to={activeClassId ? `/teacher/classes/${activeClassId}?tab=classwork` : '/teacher/assignments'}
            className="mt-4 flex items-center gap-3 border-t border-tint-200 pt-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-extrabold text-ink-900">
                {firstAssignment?.title ?? t('teacher.exampleAssignment')}
              </span>
              <span className="block text-sm font-semibold text-brand-600">
                {t('teacher.submittedCount', { done: submitted, total: students })}
              </span>
            </span>
            <span className="h-2 w-20 shrink-0 overflow-hidden rounded-full bg-tint-100">
              <span className="block h-full rounded-full bg-navy-800" style={{ width: `${submissionPercent}%` }} />
            </span>
            <span className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-ink-900">
              {submissionPercent}%
              <ChevronRightIcon className="size-4 text-brand-600" />
            </span>
          </Link>
        </section>

        <Link
          to="/teacher/classes/new"
          className="flex items-center justify-center gap-2 rounded-full bg-gold-500 py-4 text-lg font-extrabold text-white shadow-sm transition-colors hover:bg-gold-400"
        >
          <PlusIcon />
          {t('teacher.createClass')}
        </Link>
      </div>
    </main>
  );
};

/** Circle-tiled figure, label, then the number — as the reference stacks them. */
const StatCard = ({ icon, label, value }) => (
  <div className="flex items-center gap-2.5 rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70">
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-tint-100 text-brand-600">
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block whitespace-nowrap text-[0.8rem] font-semibold text-ink-600">{label}</span>
      <span className="block text-2xl font-extrabold text-ink-900">{value}</span>
    </span>
  </div>
);

const Metric = ({ label, value, tone, bar, width, className = 'pe-3' }) => (
  <div className={className}>
    <p className="text-sm font-semibold text-ink-600">{label}</p>
    <p className={`mt-0.5 text-2xl font-extrabold ${tone}`}>{value}</p>
    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-tint-100">
      <span className={`block h-full rounded-full ${bar}`} style={{ width }} />
    </span>
  </div>
);

/**
 * The teacher's own photo when there is one. Otherwise their initial — a
 * generic silhouette says nothing, and a broken image says less.
 */
const Avatar = ({ user, name }) => {
  const src = user?.avatar_url ?? user?.avatarUrl;
  if (src) {
    return <img src={src} alt="" aria-hidden="true" className="size-11 rounded-full object-cover ring-2 ring-white/40" />;
  }
  return (
    <span className="grid size-11 place-items-center rounded-full bg-white/20 text-lg font-extrabold text-white ring-2 ring-white/30">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
};

const BellIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 15V10a6 6 0 0 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21a2.2 2.2 0 0 0 4 0" />
  </svg>
);

const CapIcon = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 4 9 4.5-9 4.5-9-4.5z" />
    <path d="M6.5 10.8V16c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-5.2" />
    <path d="M21 8.5V14" />
  </svg>
);

const StudentsIcon = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <path d="M16 6.2a3.2 3.2 0 0 1 0 6.1M17.5 14.4a5.5 5.5 0 0 1 3 4.6" />
  </svg>
);

const SubmissionIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="m8.75 14 1.6 1.6 3.4-3.4" />
  </svg>
);

const BookIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 7c-2-1.6-4.4-2-7-2v12c2.6 0 5 .4 7 2 2-1.6 4.4-2 7-2V5c-2.6 0-5 .4-7 2z" />
    <path d="M12 7v12" />
  </svg>
);

const ChevronRightIcon = ({ className = 'size-4' }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
    <path d="m9.5 5 7 7-7 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ChevronDownIcon = ({ className = '' }) => (
  <svg viewBox="0 0 24 24" className={`size-5 shrink-0 text-brand-600 ${className}`} fill="none" aria-hidden="true">
    <path d="m6 9.5 6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);
