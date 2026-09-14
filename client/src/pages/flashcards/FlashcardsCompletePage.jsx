import { Link, useNavigate, useParams } from 'react-router-dom';

import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Button } from '../../components/ui.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { useKits } from '../../kits/KitsContext.jsx';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';

/** docs/screens/08-flashcards/02-flashcards-complete. */
export const FlashcardsCompletePage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { kitId } = useParams();
  const { getKit } = useKits();
  const kit = getKit(kitId);
  const summary = JSON.parse(sessionStorage.getItem(`flashcard-session:${kitId}`) ?? '{"reviewed":0,"needAnotherLook":0,"nextDueAt":null}');
  const title = language === 'km' && kit?.titleKm ? kit.titleKm : kit?.title;
  const nextReview = summary.nextDueAt
    ? new Intl.DateTimeFormat(language === 'km' ? 'km-KH' : 'en', { dateStyle: 'medium' }).format(new Date(summary.nextDueAt))
    : null;

  const reviewAgain = () => {
    sessionStorage.removeItem(`flashcard-session:${kitId}`);
    navigate(`/flashcards/${kitId}`);
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0">
        <Link to={`/flashcards/${kitId}`} aria-label={t('common.back')} className="inline-block"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
        <h1 className="mt-3 text-3xl font-bold">{t('flashcards.completeTitle')}</h1>
        <p className="mt-1 truncate text-base text-white/75">{title}</p>
      </NavyHeader>
      <div className="flex-1 px-5 pt-6">
        <div className="flex flex-col items-center text-center"><Owl variant="waving" className="size-28" /><h2 className="mt-3 text-3xl font-bold text-navy-900">{t('flashcards.niceSession')}</h2><p className="mt-1 text-base text-navy-600">{t('flashcards.reviewedAll', { count: summary.reviewed })}</p></div>
        <div className="mt-5 rounded-card bg-tint-100 py-7 text-center"><p className="text-5xl font-bold text-navy-900">{summary.reviewed}</p><p className="mt-1 text-base text-navy-600">{t('flashcards.cardsReviewed')}</p></div>
        <section className="mt-4 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70"><h3 className="text-xl font-bold text-navy-900">{t('flashcards.reviewComplete')}</h3><div className="mt-3 h-3 overflow-hidden rounded-full bg-tint-100"><span className="block h-full w-full rounded-full bg-navy-800" /></div></section>
        <section className="mt-4 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
          <h3 className="text-xl font-bold text-navy-900">{t('flashcards.keepBuilding')}</h3>
          <ul className="mt-2 divide-y divide-tint-200">
            <li className="flex items-center gap-4 py-3"><span className="w-8 shrink-0 text-lg font-bold text-navy-900">{summary.reviewed}</span><span className="text-base text-navy-600">{t('flashcards.cardsReviewedLabel')}</span></li>
            <li className="flex items-center gap-4 py-3"><span className="w-8 shrink-0 text-lg font-bold text-navy-900">{summary.needAnotherLook}</span><span className="text-base text-navy-600">{t('flashcards.needAnotherLook')}</span></li>
            <li className="flex items-center gap-4 py-3"><span className="grid w-8 shrink-0 place-items-center text-navy-700"><svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.9" /><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg></span><span className="text-base text-navy-600">{nextReview ?? t('flashcards.nextReview')}</span></li>
          </ul>
        </section>
        <div className="mt-6 space-y-3 pb-4"><Button onClick={reviewAgain}>{t('flashcards.reviewAgain')}</Button><div className="text-center"><Link to={`/kits/${kitId}`} className="font-semibold text-navy-600">{t('quiz.backToKit')}</Link></div></div>
      </div>
      <StudyTabBar kitId={kitId} active="flashcards" />
    </main>
  );
};
