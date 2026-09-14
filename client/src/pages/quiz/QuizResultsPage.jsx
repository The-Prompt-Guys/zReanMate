import { Link, useParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button, CheckIcon } from '../../components/ui.jsx';
import { useAuth } from '../../auth/AuthContext.jsx';
import { kits, quizResult } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/06-quiz/03-quiz-completed-results. */
export const QuizResultsPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { kitId = 'kit-database' } = useParams();

  const kit = kits.find((k) => k.id === kitId) ?? kits[1];
  const takeaways = language === 'km' ? quizResult.takeawaysKm : quizResult.takeaways;

  return (
    <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0">
        <div className="flex items-start gap-3">
          <Link to={`/kits/${kit.id}`} aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight">{t('quiz.completeTitle')}</h1>
            <p className="mt-0.5 truncate text-base text-white/75">
              {language === 'km' ? kit.titleKm : kit.title}
            </p>
          </div>
        </div>
      </NavyHeader>

      <div className="flex-1 px-5 pt-6">
        <div className="flex flex-col items-center text-center">
          <Owl variant="waving" className="size-28" />
          <h2 className="mt-3 text-3xl font-bold text-navy-900">
            {t('quiz.niceWork', { name: user?.full_name ?? '' })}
          </h2>
          <p className="mt-1 text-base text-navy-600">{t('quiz.completeSubtitle')}</p>

          <div className="mt-5 grid size-40 place-items-center rounded-full bg-navy-800 text-white">
            <span className="text-4xl font-bold">
              {quizResult.correct} / {quizResult.total}
            </span>
          </div>
          <p className="mt-3 text-base text-navy-600">{t('quiz.correctAnswers')}</p>
        </div>

        <section className="mt-6 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <h3 className="text-xl font-bold text-navy-900">{t('quiz.takeaways')}</h3>
          <ul className="mt-3 divide-y divide-tint-200">
            {takeaways.map((takeaway) => (
              <li key={takeaway} className="flex items-center gap-3 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-navy-800">
                  <CheckIcon />
                </span>
                <span className="text-base text-navy-700">{takeaway}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 flex items-center gap-4 rounded-card bg-tint-100 p-5">
          <MasteryRing percent={quizResult.mastery} />
          <div className="min-w-0">
            <p className="text-xl font-bold text-navy-900">
              {t('quiz.mastery', { percent: quizResult.mastery })}
            </p>
            <p className="mt-0.5 text-sm text-navy-600">{t('quiz.masteryHint')}</p>
          </div>
        </section>

        <div className="mt-6 space-y-3 pb-4">
          <Button onClick={() => {}}>{t('quiz.reviewMissed')}</Button>
          <div className="text-center">
            <Link to={`/kits/${kit.id}`} className="font-semibold text-navy-800">
              {t('quiz.backToKit')}
            </Link>
          </div>
        </div>
      </div>

      <StudyTabBar kitId={kit.id} active="practice" />
    </main>
  );
};

/** The percentage ring on the results screen. */
const MasteryRing = ({ percent }) => {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <span className="relative grid size-[4.5rem] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#DCE9FB" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#0C3C85"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <span className="absolute text-sm font-bold text-navy-900">{percent}%</span>
    </span>
  );
};
