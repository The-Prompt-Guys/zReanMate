import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { StudyTabBar } from '../../components/StudyTabBar.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui.jsx';
import { flashcards, kits } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/08-flashcards/01-flashcards-interface. */
export const FlashcardsPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { kitId = 'kit-database' } = useParams();

  const kit = kits.find((k) => k.id === kitId) ?? kits[1];
  const total = kit.cardCount * 2;

  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const card = flashcards[index % flashcards.length];
  const term = language === 'km' ? card.termKm : card.term;
  const definition = language === 'km' ? card.definitionKm : card.definition;

  const go = (delta) => {
    const next = index + delta;
    if (next >= total) {
      navigate(`/flashcards/${kit.id}/complete`);
      return;
    }
    setIndex(Math.max(0, next));
    setRevealed(false);
  };

  return (
    <main className="flex min-h-dvh flex-col">
      <NavyHeader className="shrink-0">
        <Link to={`/kits/${kit.id}`} aria-label={t('common.back')} className="inline-block">
          <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
            <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{t('flashcards.title')}</h1>
        <p className="mt-1 truncate text-base text-white/75">
          {language === 'km' ? kit.titleKm : kit.title}
        </p>
      </NavyHeader>

      <div className="flex-1 px-5 pt-5">
        <p className="font-bold text-navy-900">
          {t('flashcards.cardProgress', { current: index + 1, total })}
        </p>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-tint-100">
          <span
            className="block h-full rounded-full bg-navy-800 transition-[width]"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>

        {/* The card. Tapping it reveals the definition, per the design. */}
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-expanded={revealed}
          className="mt-5 flex min-h-[19rem] w-full flex-col rounded-[1.5rem] bg-white p-6 text-left shadow-sm ring-1 ring-tint-200/70"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="text-sm font-bold uppercase tracking-wide text-navy-600/80">
              {t(revealed ? 'flashcards.definition' : 'flashcards.term')}
            </span>
            <Owl variant="default" className="-mt-2 size-16 shrink-0" />
          </span>

          <span className="mt-3 flex-1 text-3xl font-bold leading-tight text-navy-900">
            {revealed ? definition : term}
          </span>

          <span className="mt-4 text-base text-navy-600">
            {t(revealed ? 'flashcards.tapToHide' : 'flashcards.tapToReveal')}
          </span>
        </button>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            className="text-base font-semibold text-navy-800 disabled:opacity-40"
          >
            {t('flashcards.previous')}
          </button>

          <div className="min-w-0 flex-1">
            <Button onClick={() => setRevealed((v) => !v)}>
              {t(revealed ? 'flashcards.hide' : 'flashcards.reveal')}
            </Button>
          </div>

          <button type="button" onClick={() => go(1)} className="text-base font-semibold text-navy-800">
            {t('common.next')}
          </button>
        </div>

        <div className="mt-5 pb-4 text-center">
          <button type="button" className="inline-flex items-center gap-2 font-semibold text-navy-800">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('flashcards.shuffle')}
          </button>
        </div>
      </div>

      <StudyTabBar kitId={kit.id} active="flashcards" />
    </main>
  );
};
