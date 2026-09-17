import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Button } from '../../components/ui.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { useStudySource } from '../study/useSourceSummaries.js';
import { useFlashcards } from './useFlashcards.js';

/**
 * One session summary per material, not per kit. The deck is drawn from a
 * single file, so a kit-wide key let the count from one file's session show up
 * on the completion screen of another's.
 *
 * Exported so the completion screen reads the same key.
 */
export const flashcardSummaryKey = (kitId, sourceId = null) =>
  `flashcard-session:${kitId}:${sourceId ?? 'kit'}`;
/** Both faces must be the same box, or the card changes shape mid-flip. */
const FACE = 'absolute inset-0 flex flex-col rounded-[1.5rem] bg-white p-6 shadow-sm ring-1 ring-tint-200/70';
const ratings = [
  { quality: 1, key: 'again' }, { quality: 3, key: 'hard' },
  { quality: 4, key: 'good' }, { quality: 5, key: 'easy' },
];

/** docs/screens/08-flashcards/01-flashcards-interface. */
export const FlashcardsPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { kitId } = useParams();
  const { kit, source, sourceId, status: sourceStatus, error: sourceError } = useStudySource(kitId);
  const { cards, setCards, status, error, review } = useFlashcards({ source, kitId, language, selectedSourceId: sourceId });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const total = cards.length;
  const card = cards[index];
  const kitTitle = language === 'km' && kit?.titleKm ? kit.titleKm : kit?.title;
  // The deck came from one file, so the header says which one.
  const title = sourceId ? (source?.name ?? t('common.loading')) : kitTitle;
  const visibleError = sourceError ?? error ?? reviewError;
  const key = flashcardSummaryKey(kitId, sourceId);
  const sourceQuery = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';

  useEffect(() => { sessionStorage.removeItem(key); }, [key]);

  const finish = (summary) => {
    sessionStorage.setItem(key, JSON.stringify(summary));
    navigate(`/flashcards/${kitId}/complete${sourceQuery}`);
  };

  const rate = async (quality) => {
    if (!card || saving) return;
    setSaving(true); setReviewError(null);
    try {
      const result = await review(card.id, quality);
      const previous = JSON.parse(sessionStorage.getItem(key) ?? '{"reviewed":0,"needAnotherLook":0,"nextDueAt":null}');
      const summary = {
        reviewed: previous.reviewed + 1,
        needAnotherLook: previous.needAnotherLook + (quality < 3 ? 1 : 0),
        nextDueAt: !previous.nextDueAt || new Date(result.dueAt) < new Date(previous.nextDueAt)
          ? result.dueAt : previous.nextDueAt,
      };
      const remaining = cards.filter((item) => item.id !== card.id);
      setCards(remaining);
      setIndex((current) => Math.min(current, Math.max(0, remaining.length - 1)));
      setRevealed(false);
      sessionStorage.setItem(key, JSON.stringify(summary));
      if (remaining.length === 0) finish(summary);
    } catch (err) {
      setReviewError({ message: err?.response?.data?.error?.message ?? 'Could not save this review.' });
    } finally { setSaving(false); }
  };

  const shuffle = () => {
    setCards((current) => [...current].sort(() => Math.random() - 0.5));
    setIndex(0); setRevealed(false);
  };

  if (sourceStatus !== 'loading' && !source) {
    return <main className="grid min-h-dvh place-items-center px-6 text-center"><div><p className="text-danger-600">{sourceError?.message ?? 'No ready source is available.'}</p><Link className="mt-4 inline-block font-semibold text-navy-800" to={`/kits/${kitId}`}>{t('quiz.backToKit')}</Link></div></main>;
  }
  if (sourceStatus === 'loading' || ['loading', 'pending', 'generating'].includes(status)) {
    return <main className="grid min-h-dvh place-items-center px-6 text-center text-navy-800"><div><Owl className="mx-auto size-24" /><p className="mt-3 font-semibold">{t('common.loading')}</p></div></main>;
  }
  if (visibleError) {
    return <main className="grid min-h-dvh place-items-center px-6 text-center"><div><p className="text-danger-600">{visibleError.message}</p><Link className="mt-4 inline-block font-semibold text-navy-800" to={`/kits/${kitId}`}>{t('quiz.backToKit')}</Link></div></main>;
  }
  if (!card) {
    return <main className="grid min-h-dvh place-items-center px-6 text-center"><div><Owl variant="waving" className="mx-auto size-24" /><p className="mt-3 font-semibold text-navy-800">{t('flashcards.dueToday', { count: 0 })}</p><Link className="mt-4 inline-block font-semibold text-navy-600" to={`/kits/${kitId}`}>{t('quiz.backToKit')}</Link></div></main>;
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0">
        <Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="inline-block"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
        <h1 className="mt-3 text-3xl font-bold">{t('flashcards.title')}</h1>
        <p className="mt-1 truncate text-base text-white/75">{title}</p>
      </NavyHeader>
      <div className="flex-1 px-5 pt-5">
        <p className="font-bold text-navy-900">{t('flashcards.cardProgress', { current: index + 1, total })}</p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100"><span className="block h-full rounded-full bg-navy-800 transition-[width]" style={{ width: `${((index + 1) / total) * 100}%` }} /></div>
        <button
          key={card.id}
          type="button"
          onClick={() => setRevealed((value) => !value)}
          aria-expanded={revealed}
          className="flashcard-scene flashcard-deal mt-5 block min-h-[19rem] w-full text-left transition-transform active:scale-[0.99]"
        >
          <span className={`flashcard-inner relative block min-h-[19rem] w-full ${revealed ? 'is-flipped' : ''}`}>
            <span aria-hidden={revealed} className={FACE + ' flashcard-face'}>
              <span className="flex items-start justify-between gap-3"><span className="text-sm font-bold uppercase tracking-wide text-navy-600/80">{t('flashcards.term')}</span><Owl variant="default" className="-mt-2 size-16 shrink-0" /></span>
              <span className="mt-3 flex-1 text-3xl font-bold leading-tight text-navy-900">{card.term}</span>
              <span className="mt-4 text-base text-navy-600">{t('flashcards.tapToReveal')}</span>
            </span>
            <span aria-hidden={!revealed} className={FACE + ' flashcard-face flashcard-face-back'}>
              <span className="flex items-start justify-between gap-3"><span className="text-sm font-bold uppercase tracking-wide text-navy-600/80">{t('flashcards.definition')}</span><Owl variant="default" className="-mt-2 size-16 shrink-0" /></span>
              <span className="mt-3 flex-1 overflow-y-auto text-3xl font-bold leading-tight text-navy-900">{card.definition}</span>
              {card.hint && <span className="mt-2 text-sm text-navy-500">{card.hint}</span>}
              <span className="mt-4 text-base text-navy-600">{t('flashcards.tapToHide')}</span>
            </span>
          </span>
        </button>
        {!revealed ? <div className="mt-5"><Button onClick={() => setRevealed(true)}>{t('flashcards.reveal')}</Button></div> : <div className="mt-5 grid grid-cols-4 gap-2">{ratings.map(({ quality, key }) => <button key={quality} type="button" disabled={saving} onClick={() => rate(quality)} className="rounded-xl border border-tint-200 bg-white px-2 py-3 text-sm font-bold text-navy-800 disabled:opacity-50">{t(`flashcards.${key}`)}</button>)}</div>}
        {reviewError && <p className="mt-2 text-center text-sm text-danger-600">{reviewError.message}</p>}
        <div className="mt-5 pb-4 text-center"><button type="button" onClick={shuffle} className="inline-flex items-center gap-2 font-semibold text-navy-800"><svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>{t('flashcards.shuffle')}</button></div>
      </div>
      <StudyTabBar kitId={kitId} sourceId={sourceId} active="flashcards" />
    </main>
  );
};
