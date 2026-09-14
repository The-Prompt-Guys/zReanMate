import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { CheckIcon } from '../../components/ui.jsx';
import { classes, classQuizzes, lessonsByWeek, materialsByWeek } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * docs/screens/09-classes-assignments/02 and 03.
 *
 * Those two screenshots are different iterations of the same screen — 02 has
 * Lessons / Materials / Quizzes with a week accordion, 03 has Overview /
 * Materials / Practice with "Quizzes by week" and "Upcoming". Both sets of
 * content are kept here under 02's tab names, so nothing from either is lost.
 */
export const ClassDetailPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { classId = 'class-eng' } = useParams();
  const [params] = useSearchParams();

  const klass = classes.find((c) => c.id === classId) ?? classes[0];
  const [tab, setTab] = useState(params.get('tab') === 'quizzes' ? 'quizzes' : 'lessons');
  const [openWeek, setOpenWeek] = useState(1);

  const title = language === 'km' ? klass.titleKm : klass.title;

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link to="/classes" aria-label={t('common.back')} className="mt-1 shrink-0">
              <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
                <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight">{title}</h1>
              <p className="mt-2 flex items-center gap-2 text-base text-white/80">
                <span className="grid size-8 place-items-center rounded-full bg-white/20 text-sm font-bold">
                  {klass.teacher.replace('Prof. ', '').charAt(0)}
                </span>
                {klass.teacher}
              </p>
            </div>
          </div>
          <Owl variant="reading" className="size-20 shrink-0" />
        </div>
      </NavyHeader>

      <div className="px-5 pt-4">
        {/* Course information / progress */}
        <section className="rounded-card bg-tint-100 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-navy-800 text-white">
              <ChartIcon />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-navy-900">{t('classes.yourProgress')}</h2>
              <p className="text-sm text-navy-600">
                {t('classes.lessonsCompleted', { done: klass.lessonsDone, total: klass.weeks })}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
            <span
              className="block h-full rounded-full bg-navy-800"
              style={{ width: `${(klass.lessonsDone / klass.weeks) * 100}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Fact label={t('classes.weeks', { count: klass.weeks })} />
            <Fact label={t('classes.lessons', { count: klass.lessonCount })} />
            <Fact label={t('classes.completedShort', { done: klass.lessonsDone })} />
          </dl>
        </section>

        {/* Tabs */}
        <div role="tablist" className="mt-4 flex gap-1 rounded-full bg-tint-100 p-1">
          {[
            ['lessons', 'classes.tabLessons'],
            ['materials', 'classes.tabMaterials'],
            ['quizzes', 'classes.tabQuizzes'],
          ].map(([value, key]) => (
            <button
              key={value}
              role="tab"
              type="button"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`flex-1 rounded-full py-2.5 text-base font-semibold transition-colors ${
                tab === value ? 'bg-navy-800 text-white' : 'text-navy-800'
              }`}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {tab === 'lessons' && (
          <section className="mt-4">
            <h3 className="text-xl font-bold text-navy-900">{t('classes.lessonsByWeek')}</h3>
            <div className="mt-3 space-y-3">
              {lessonsByWeek.map((week) => (
                <div key={week.week} className="overflow-hidden rounded-card bg-tint-100/60">
                  <button
                    type="button"
                    onClick={() => setOpenWeek(openWeek === week.week ? null : week.week)}
                    aria-expanded={openWeek === week.week}
                    className="flex w-full items-center gap-3 px-4 py-3.5"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`size-5 shrink-0 text-navy-800 transition-transform ${openWeek === week.week ? '' : 'rotate-180'}`}
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="flex-1 text-left text-lg font-bold text-navy-900">
                      {t('classes.week', { number: week.week })}
                    </span>
                    <span className="text-sm text-navy-600">
                      {t('classes.lessonCount', { count: week.lessons.length })}
                    </span>
                  </button>

                  {openWeek === week.week && (
                    <ul className="divide-y divide-tint-200 bg-white/70">
                      {week.lessons.map((lesson) => (
                        <li key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
                            <LessonKindIcon kind={lesson.kind} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-bold text-navy-900">
                              {language === 'km' ? lesson.titleKm : lesson.title}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-sm">
                              <StatusDot status={lesson.status} />
                              <span className={lesson.status === 'completed' ? 'text-navy-700' : 'text-navy-600'}>
                                {lesson.status === 'in_progress'
                                  ? t('classes.partial', { done: lesson.done, total: lesson.total })
                                  : t(lesson.status === 'completed' ? 'classes.completed' : 'classes.notStarted')}
                              </span>
                            </span>
                          </span>
                          {lesson.status === 'in_progress' && (
                            <span className="shrink-0 rounded-full bg-navy-800 px-4 py-2 text-sm font-bold text-white">
                              {t('classes.continueLesson')}
                            </span>
                          )}
                          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                            <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'materials' && (
          <section className="mt-4">
            <h3 className="text-xl font-bold text-navy-900">{t('classes.materialsByWeek')}</h3>
            <ul className="mt-3 space-y-3">
              {materialsByWeek.map((week) => (
                <li
                  key={week.week}
                  className="flex items-center gap-3 rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
                    <FolderIcon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-navy-900">
                      {t('classes.week', { number: week.week })}
                    </span>
                    <span className="block text-sm text-navy-600">
                      {t('classes.fileCount', { count: week.files })}
                    </span>
                  </span>
                  <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'quizzes' && (
          <section className="mt-4">
            <h3 className="text-xl font-bold text-navy-900">{t('classes.quizzesByWeek')}</h3>
            <ul className="mt-3 space-y-3">
              {classQuizzes.map((week) => (
                <li key={week.week} className="overflow-hidden rounded-card bg-white shadow-sm ring-1 ring-tint-200/70">
                  <div className="flex items-center gap-3 p-3.5">
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${week.tone}`}>
                      <QuizTickIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-navy-900">
                        {t('classes.week', { number: week.week })}
                      </span>
                      <span className="block text-sm text-navy-600">
                        {t('classes.quizAvailable', { count: 1 })}
                      </span>
                    </span>
                    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>

                  {week.week === 1 && (
                    <div className="flex items-center gap-3 bg-tint-100/70 p-3.5">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-navy-800">
                        <DocIcon />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-navy-900">
                          {language === 'km' ? week.quizTitleKm : week.quizTitle}
                        </span>
                        <span className="block text-sm text-navy-600">
                          {t('classes.quizMeta', { count: 10 })}
                        </span>
                      </span>
                      <Link
                        to="/quiz/kit-database"
                        className="shrink-0 rounded-full bg-navy-800 px-4 py-2.5 text-sm font-bold text-white"
                      >
                        {t('classes.startQuiz')}
                      </Link>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-xl font-bold text-navy-900">{t('classes.upcoming')}</h3>
            <Link
              to="/assignments/a1"
              className="mt-3 flex items-center gap-3 rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
                <CalendarIcon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-navy-900">ER Diagram Exercises</span>
                <span className="block text-sm text-navy-600">Sep 14</span>
              </span>
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <Link
              to="/tutor"
              className="mt-3 flex items-center gap-3 rounded-card bg-tint-100 p-3.5"
            >
              <BotIcon />
              <span className="min-w-0 flex-1 font-semibold text-navy-800">
                {t('classes.askAiClass')}
              </span>
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </section>
        )}
      </div>
    </main>
  );
};

const Fact = ({ label }) => (
  <div className="rounded-xl bg-white py-2 text-sm font-semibold text-navy-800">{label}</div>
);

const StatusDot = ({ status }) => {
  if (status === 'completed') {
    return (
      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-navy-800">
        <CheckIcon className="size-2.5 text-white" />
      </span>
    );
  }
  if (status === 'in_progress') {
    return <span className="size-4 shrink-0 rounded-full border-2 border-navy-700 border-r-transparent" />;
  }
  return <span className="size-4 shrink-0 rounded-full border-2 border-ink-400" />;
};

const iconProps = {
  viewBox: '0 0 24 24',
  className: 'size-5',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const LessonKindIcon = ({ kind }) =>
  kind === 'reading' ? (
    <svg {...iconProps}>
      <path d="M12 7c-2-1.6-4.4-2-7-2v12c2.6 0 5 .4 7 2 2-1.6 4.4-2 7-2V5c-2.6 0-5 .4-7 2z" />
      <path d="M12 7v12" />
    </svg>
  ) : (
    <svg {...iconProps}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );

const ChartIcon = () => (
  <svg {...iconProps} className="size-6">
    <path d="M7 17v-5M12 17V8M17 17v-3" />
  </svg>
);

const FolderIcon = () => (
  <svg {...iconProps} className="size-6">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const QuizTickIcon = () => (
  <svg {...iconProps} className="size-6">
    <rect x="4" y="4" width="16" height="16" rx="3.5" />
    <path d="m8.5 12 2.4 2.4L16 9.5" />
  </svg>
);

const DocIcon = () => (
  <svg {...iconProps}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

const CalendarIcon = () => (
  <svg {...iconProps} className="size-6">
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const BotIcon = () => (
  <svg viewBox="0 0 24 24" className="size-9 shrink-0 text-navy-800" fill="none" aria-hidden="true">
    <rect x="4" y="7" width="16" height="12" rx="4" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="9.5" cy="13" r="1.6" fill="currentColor" />
    <circle cx="14.5" cy="13" r="1.6" fill="currentColor" />
    <path d="M12 7V4M9.5 4h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
