import { Link } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { classes } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/09-classes-assignments/01-classes-tab-no-upcoming. */
export const ClassesPage = () => {
  const t = useT();
  const { language } = useLanguage();

  return (
    <main>
      <NavyHeader className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{t('classes.title')}</h1>
          <p className="mt-1 text-base text-white/75">{t('classes.subtitle')}</p>
        </div>
        <Owl variant="default" className="size-20 shrink-0" />
      </NavyHeader>

      <div className="space-y-3 px-5 pt-5">
        <div className="flex items-center gap-3 rounded-card bg-tint-100 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl text-navy-800">
            <StackIcon />
          </span>
          <h2 className="text-xl font-bold text-navy-900">{t('classes.yourClasses')}</h2>
        </div>

        <ul className="space-y-3">
          {classes.map((klass) => (
            <li key={klass.id}>
              <Link
                to={`/classes/${klass.id}`}
                className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
                  <ClassIcon kind={klass.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-navy-900">
                    {language === 'km' ? klass.titleKm : klass.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-navy-600">{klass.teacher}</span>
                  <span className="mt-1.5 block text-sm text-navy-800">
                    {t('classes.lessonsCompleted', {
                      done: klass.lessonsDone,
                      total: klass.weeks,
                    })}
                  </span>
                  <span className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-tint-200">
                    <span
                      className="block h-full rounded-full bg-navy-800"
                      style={{ width: `${(klass.lessonsDone / klass.weeks) * 100}%` }}
                    />
                  </span>
                </span>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-3 rounded-full bg-navy-800 py-4 text-lg font-bold text-white"
        >
          <PeopleIcon />
          {t('classes.join')}
        </button>
      </div>
    </main>
  );
};

const StackIcon = () => (
  <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v5c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 13v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5" />
  </svg>
);

const PeopleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19a6 6 0 0 1 12 0" />
    <path d="M16 5.5a3.2 3.2 0 0 1 0 5M18 19a6 6 0 0 0-2-4.5" />
  </svg>
);

const ClassIcon = ({ kind }) => {
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
  if (kind === 'laptop') {
    return (
      <svg {...p}>
        <rect x="3" y="5" width="18" height="12" rx="2" />
        <path d="M2 20h20" />
      </svg>
    );
  }
  return (
    <svg {...p}>
      <path d="M12 7c-2-1.6-4.4-2-7-2v12c2.6 0 5 .4 7 2 2-1.6 4.4-2 7-2V5c-2.6 0-5 .4-7 2z" />
      <path d="M12 7v12" />
    </svg>
  );
};
