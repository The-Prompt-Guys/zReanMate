import { Link } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { kits, practiceResult } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * docs/screens/07-practice/05-practice-with-mock-exam — the Practice tab
 * landing: a "continue" card plus the four practice modes.
 */
export const PracticeHomePage = () => {
  const t = useT();
  const { language } = useLanguage();
  const kit = kits[1];

  const modes = [
    { to: '/practice/setup', Icon: QuizIcon, title: t('study.quizMe'), hint: t('study.quizMeHint') },
    { to: '/practice/setup', Icon: PencilIcon, title: t('practice.writeAnswer'), hint: t('practice.writeAnswerHint') },
    { to: `/flashcards/${kit.id}`, Icon: CardsIcon, title: t('practice.flashcards'), hint: t('practice.flashcardsHint') },
    { to: '/practice/setup?mock=1', Icon: ClipboardIcon, title: t('practice.mockExam'), hint: t('practice.mockExamHint') },
  ];

  return (
    <main>
      <NavyHeader className="flex items-start justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold">{t('practice.title')}</h1>
          <p className="mt-1 text-base text-white/75">{t('practice.subtitle')}</p>
        </div>
        <Owl variant="default" className="size-20 shrink-0" />
      </NavyHeader>

      <div className="space-y-6 px-5 pt-5">
        <section className="rounded-card bg-tint-100 p-5">
          <h2 className="text-xl font-bold text-navy-900">{t('practice.continueTitle')}</h2>
          <p className="mt-1 font-bold text-navy-900">
            {language === 'km' ? kit.titleKm : kit.title}
          </p>
          <p className="mt-0.5 text-base text-navy-600">
            {t('practice.answeredOf', { done: practiceResult.correct, total: practiceResult.total })}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white">
              <span
                className="block h-full rounded-full bg-navy-800"
                style={{ width: `${(practiceResult.correct / practiceResult.total) * 100}%` }}
              />
            </div>
            <Link
              to="/practice/session"
              className="shrink-0 rounded-full bg-navy-800 px-6 py-3 text-base font-bold text-white"
            >
              {t('common.continue')}
            </Link>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold text-navy-900">{t('practice.chooseMode')}</h2>
          <ul className="mt-3 space-y-3">
            {modes.map(({ to, Icon, title, hint }) => (
              <li key={title}>
                <Link
                  to={to}
                  className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70"
                >
                  <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-tint-200 text-navy-800">
                    <Icon />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-bold text-navy-900">{title}</span>
                    <span className="block text-sm text-navy-600">{hint}</span>
                  </span>
                  <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-700" fill="none" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
};

const p = {
  viewBox: '0 0 32 32',
  className: 'size-7',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const QuizIcon = () => (
  <svg {...p}>
    <path d="M19 4H9a2 2 0 0 0-2 2v20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10z" />
    <path d="M19 4v6h6" />
    <path d="m11 15 1.6 1.6L15 14M18 16h4M11 21l1.6 1.6L15 20M18 22h4" />
  </svg>
);

const PencilIcon = () => (
  <svg {...p}>
    <path d="M6 26.5 7.8 20 22 5.8a2.9 2.9 0 0 1 4.2 4.2L12 24.2z" />
    <path d="m19.5 8.5 4 4" />
  </svg>
);

const CardsIcon = () => (
  <svg {...p}>
    <rect x="4" y="9" width="17" height="18" rx="2.5" />
    <path d="M10 5h13a2.5 2.5 0 0 1 2.5 2.5v14" />
    <path d="M9 15h7M9 20h5" />
  </svg>
);

const ClipboardIcon = () => (
  <svg {...p}>
    <rect x="7" y="6" width="18" height="22" rx="2.5" />
    <rect x="12" y="3" width="8" height="5" rx="1.6" />
    <path d="M12 14h8M12 19h8M12 24h5" />
  </svg>
);
