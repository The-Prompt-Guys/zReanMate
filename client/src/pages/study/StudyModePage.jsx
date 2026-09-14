import { Link, useParams } from 'react-router-dom';

import { CenterModal } from '../../components/CenterModal.jsx';
import { useT } from '../../i18n/index.js';

/**
 * docs/screens/04-study-mode-summaries/01-study-mode-centered-final.
 * A 2×2 grid of ways into the kit, shown as a centered dialog.
 */
export const StudyModePage = () => {
  const t = useT();
  const { kitId = 'kit-database' } = useParams();

  const actions = [
    { to: `/study/${kitId}/summary`, tone: 'blue', Icon: DocIcon, title: t('study.summarize'), hint: t('study.summarizeHint') },
    { to: `/quiz/${kitId}`, tone: 'violet', Icon: QuizIcon, title: t('study.quizMe'), hint: t('study.quizMeHint') },
    { to: '/practice', tone: 'amber', Icon: TargetIcon, title: t('study.practice'), hint: t('study.practiceHint') },
    { to: `/flashcards/${kitId}`, tone: 'teal', Icon: CardsIcon, title: t('study.flashcards'), hint: t('study.flashcardsHint') },
  ];

  const TONES = {
    blue: 'bg-tint-200 text-navy-800',
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
    teal: 'bg-teal-100 text-teal-700',
  };

  return (
    <CenterModal closeTo={`/kits/${kitId}`} labelledBy="study-mode-title">
      <h2 id="study-mode-title" className="pr-8 text-2xl font-bold leading-tight text-navy-900">
        {t('study.howTitle')}
      </h2>
      <p className="mt-1.5 text-base text-navy-600">{t('study.howSubtitle')}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {actions.map(({ to, tone, Icon, title, hint }) => (
          <Link key={to} to={to} className="rounded-card bg-canvas/80 p-3.5 hover:bg-tint-100">
            <span className="flex items-start justify-between">
              <span className={`grid size-11 place-items-center rounded-xl ${TONES[tone]}`}>
                <Icon />
              </span>
              <svg viewBox="0 0 24 24" className="size-5 text-navy-800" fill="none" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="mt-3 block font-bold text-navy-900">{title}</span>
            <span className="mt-0.5 block text-sm leading-snug text-navy-600">{hint}</span>
          </Link>
        ))}
      </div>
    </CenterModal>
  );
};

const props = {
  viewBox: '0 0 24 24',
  className: 'size-6',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

export const DocIcon = () => (
  <svg {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

export const QuizIcon = () => (
  <svg {...props}>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
    <path d="M10 9.5a2 2 0 1 1 2 2v1M12 15v.4" />
  </svg>
);

export const TargetIcon = () => (
  <svg {...props}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="m15 9 5-5m0 0h-3.5M20 4v3.5" />
  </svg>
);

export const CardsIcon = () => (
  <svg {...props}>
    <rect x="3" y="7" width="13" height="13" rx="2.5" />
    <path d="M8 4h10a2 2 0 0 1 2 2v10" />
  </svg>
);
