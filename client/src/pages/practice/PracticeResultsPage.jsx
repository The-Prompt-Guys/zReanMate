import { Link } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button, CheckIcon } from '../../components/ui.jsx';
import { kits, practiceResult } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/07-practice/04-practice-results. */
export const PracticeResultsPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const kit = kits[1];
  const weak = language === 'km' ? practiceResult.weakTopicsKm : practiceResult.weakTopics;

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start gap-3">
          <Link to="/practice" aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{t('practice.completeTitle')}</h1>
            <p className="mt-0.5 truncate text-base text-white/75">
              {language === 'km' ? kit.titleKm : kit.title}
            </p>
          </div>
        </div>
      </NavyHeader>

      <div className="px-5 pt-6">
        <div className="flex flex-col items-center text-center">
          <Owl variant="waving" className="size-24" />
          <h2 className="mt-3 text-2xl font-bold text-navy-900">{t('practice.completeTitle')}</h2>
          <p className="mt-1 text-base text-navy-600">
            {t('practice.completeSubtitle', { count: practiceResult.total })}
          </p>
        </div>

        <div className="mt-5 rounded-card bg-tint-100 py-7 text-center">
          <p className="text-5xl font-bold text-navy-900">
            {practiceResult.correct} / {practiceResult.total}
          </p>
          <p className="mt-1 text-base text-navy-600">{t('quiz.correctAnswers')}</p>
        </div>

        <section className="mt-4 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <p className="text-xl font-bold text-navy-900">
            {t('quiz.mastery', { percent: practiceResult.mastery })}
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100">
            <span
              className="block h-full rounded-full bg-navy-800"
              style={{ width: `${practiceResult.mastery}%` }}
            />
          </div>
        </section>

        <ul className="mt-4 divide-y divide-tint-200 rounded-card bg-white px-5 shadow-sm ring-1 ring-tint-200/70">
          <Stat
            icon={<span className="grid size-7 place-items-center rounded-full bg-navy-800"><CheckIcon /></span>}
            label={t('practice.correctCount', { count: practiceResult.correct })}
          />
          <Stat
            icon={<span className="size-7 rounded-full bg-gold-400" />}
            label={t('practice.toReview', { count: practiceResult.toReview })}
          />
          <Stat
            icon={
              <span className="grid size-7 place-items-center rounded-full bg-tint-200 text-navy-800">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                  <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                </svg>
              </span>
            }
            label={t('practice.answered', { count: practiceResult.answered })}
          />
        </ul>

        <section className="mt-4 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <h3 className="text-xl font-bold text-navy-900">{t('practice.whatToReview')}</h3>
          <ul className="mt-2 divide-y divide-tint-200">
            {weak.map((topic) => (
              <li key={topic}>
                <Link to="/practice/setup" className="flex items-center justify-between py-3">
                  <span className="text-base font-semibold text-navy-800">{topic}</span>
                  <svg viewBox="0 0 24 24" className="size-5 text-navy-600" fill="none" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 space-y-3 pb-4">
          <Button onClick={() => {}}>{t('practice.reviewExplanations')}</Button>
          <div className="text-center">
            <Link to={`/kits/${kit.id}`} className="font-semibold text-navy-800">
              {t('quiz.backToKit')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

const Stat = ({ icon, label }) => (
  <li className="flex items-center gap-3 py-3.5">
    <span className="shrink-0">{icon}</span>
    <span className="text-base text-navy-800">{label}</span>
  </li>
);
