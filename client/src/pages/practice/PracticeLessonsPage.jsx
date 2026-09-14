import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { SearchField } from '../../components/listControls.jsx';
import { Button } from '../../components/ui.jsx';
import { practiceLessons } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/07-practice/02-practice-lesson-selection. */
export const PracticeLessonsPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('pl4');

  const visible = practiceLessons.filter((lesson) =>
    query.trim()
      ? `${lesson.title} ${lesson.titleKm}`.toLowerCase().includes(query.trim().toLowerCase())
      : true,
  );

  return (
    <main>
      <NavyHeader className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Link to="/practice/setup" aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{t('practice.chooseLesson')}</h1>
            <p className="mt-0.5 text-base text-white/75">{t('practice.chooseLessonHint')}</p>
          </div>
        </div>
        <Owl variant="default" className="size-16 shrink-0" />
      </NavyHeader>

      <div className="space-y-4 px-5 pt-4">
        <div className="flex items-center gap-3 rounded-card bg-tint-100 p-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-navy-800">
            <ModeIcon />
          </span>
          <p className="min-w-0 flex-1 font-bold text-navy-900">
            {t('practice.modeLabel', { mode: t('study.quizMe') })}
          </p>
          <Link to="/practice/setup" className="shrink-0 font-semibold text-navy-700">
            {t('practice.change')}
          </Link>
        </div>

        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t('practice.searchLessons')}
          label={t('practice.searchLessons')}
        />

        <h2 className="text-xl font-bold text-navy-900">{t('practice.yourLessons')}</h2>

        <ul className="space-y-3" role="radiogroup" aria-label={t('practice.yourLessons')}>
          {visible.map((lesson) => {
            const isSelected = selected === lesson.id;
            return (
              <li key={lesson.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70">
                  <input
                    type="radio"
                    name="lesson"
                    className="sr-only"
                    checked={isSelected}
                    onChange={() => setSelected(lesson.id)}
                  />
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full border-2 ${
                      isSelected ? 'border-navy-800' : 'border-ink-400'
                    }`}
                  >
                    {isSelected && <span className="size-3 rounded-full bg-navy-800" />}
                  </span>

                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-tint-100 text-navy-800">
                    <LessonIcon kind={lesson.kind} />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-navy-900">
                        {language === 'km' ? lesson.titleKm : lesson.title}
                      </span>
                      {lesson.recommended && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/35 px-2.5 py-0.5 text-xs font-bold text-gold-500">
                          <StarIcon />
                          {t('practice.recommended')}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-sm text-navy-600">
                      {t('practice.weekMastery', {
                        week: lesson.week,
                        detail: lesson.needsPractice
                          ? t('practice.needsPractice')
                          : t('practice.masteryPercent', { percent: lesson.mastery }),
                      })}
                    </span>
                    <span className="mt-2 block h-1.5 w-full overflow-hidden rounded-full bg-tint-200">
                      <span
                        className="block h-full rounded-full bg-navy-800"
                        style={{ width: `${lesson.mastery}%` }}
                      />
                    </span>
                  </span>

                  <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="pb-4">
          <Button onClick={() => navigate('/practice/session')}>{t('common.continue')}</Button>
        </div>
      </div>
    </main>
  );
};

const ModeIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
    <path d="m8 12 1.2 1.2L11.4 11M13.5 12.5h3M8 17l1.2 1.2 2.2-2.2M13.5 17.5h3" />
  </svg>
);

const LessonIcon = ({ kind }) => {
  const shared = {
    viewBox: '0 0 24 24',
    className: 'size-6',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };
  if (kind === 'database') {
    return (
      <svg {...shared}>
        <ellipse cx="12" cy="6" rx="7" ry="3" />
        <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
      </svg>
    );
  }
  if (kind === 'book') {
    return (
      <svg {...shared}>
        <path d="M12 7c-2-1.6-4.4-2-7-2v12c2.6 0 5 .4 7 2 2-1.6 4.4-2 7-2V5c-2.6 0-5 .4-7 2z" />
        <path d="M12 7v12" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
};

const StarIcon = () => (
  <svg viewBox="0 0 20 20" className="size-3" fill="currentColor" aria-hidden="true">
    <path d="m10 1.8 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.5l5.4-.8z" />
  </svg>
);
