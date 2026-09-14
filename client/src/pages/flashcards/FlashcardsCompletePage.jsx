import { Link, useNavigate, useParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui.jsx';
import { kits } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/08-flashcards/02-flashcards-complete. */
export const FlashcardsCompletePage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { kitId = 'kit-database' } = useParams();

  const kit = kits.find((k) => k.id === kitId) ?? kits[1];
  const total = kit.cardCount * 2;
  const needAnotherLook = 4;

  return (
    <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0">
        <Link to={`/flashcards/${kit.id}`} aria-label={t('common.back')} className="inline-block">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{t('flashcards.completeTitle')}</h1>
        <p className="mt-1 truncate text-base text-white/75">
          {language === 'km' ? kit.titleKm : kit.title}
        </p>
      </NavyHeader>

      <div className="flex-1 px-5 pt-6">
        <div className="flex flex-col items-center text-center">
          <Owl variant="waving" className="size-28" />
          <h2 className="mt-3 text-3xl font-bold text-navy-900">{t('flashcards.niceSession')}</h2>
          <p className="mt-1 text-base text-navy-600">
            {t('flashcards.reviewedAll', { count: total })}
          </p>
        </div>

        <div className="mt-5 rounded-card bg-tint-100 py-7 text-center">
          <p className="text-5xl font-bold text-navy-900">
            {total} / {total}
          </p>
          <p className="mt-1 text-base text-navy-600">{t('flashcards.cardsReviewed')}</p>
        </div>

        <section className="mt-4 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <h3 className="text-xl font-bold text-navy-900">{t('flashcards.reviewComplete')}</h3>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-tint-100">
            <span className="block h-full w-full rounded-full bg-navy-800" />
          </div>
        </section>

        <section className="mt-4 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <h3 className="text-xl font-bold text-navy-900">{t('flashcards.keepBuilding')}</h3>
          <ul className="mt-2 divide-y divide-tint-200">
            <li className="flex items-center gap-4 py-3">
              <span className="w-8 shrink-0 text-lg font-bold text-navy-900">{total}</span>
              <span className="text-base text-navy-600">{t('flashcards.cardsReviewedLabel')}</span>
            </li>
            <li className="flex items-center gap-4 py-3">
              <span className="w-8 shrink-0 text-lg font-bold text-navy-900">{needAnotherLook}</span>
              <span className="text-base text-navy-600">{t('flashcards.needAnotherLook')}</span>
            </li>
            <li className="flex items-center gap-4 py-3">
              <span className="grid w-8 shrink-0 place-items-center text-navy-700">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.9" />
                  <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                  <path d="M7.5 14h.01M11.5 14h.01M15.5 14h.01M7.5 17.5h.01M11.5 17.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-base text-navy-600">{t('flashcards.nextReview')}</span>
            </li>
          </ul>
        </section>

        <div className="mt-6 space-y-3 pb-4">
          <Button onClick={() => navigate(`/flashcards/${kit.id}`)}>
            {t('flashcards.reviewAgain')}
          </Button>
          <div className="text-center">
            <Link to={`/kits/${kit.id}`} className="font-semibold text-navy-600">
              {t('quiz.backToKit')}
            </Link>
          </div>
        </div>
      </div>

      <StudyTabBar kitId={kit.id} active="flashcards" />
    </main>
  );
};
