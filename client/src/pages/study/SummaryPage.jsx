import { Link, useParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { chapters, kits, summary } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** Formats seconds as m:ss or h:mm:ss, as the design shows chapter ranges. */
const clock = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

/** docs/screens/04-study-mode-summaries/02-five-hour-summary. */
export const SummaryPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId = 'kit-database' } = useParams();

  const kit = kits.find((k) => k.id === kitId) ?? kits[1];
  const title = language === 'km' ? kit.titleKm : kit.title;
  const ready = chapters.filter((c) => c.status === 'ready').length;
  const percent = Math.round((ready / chapters.length) * 100);

  const STATUS_KEY = {
    ready: 'summary.chapterStatusReady',
    generating: 'summary.chapterStatusGenerating',
    pending: 'summary.chapterStatusPending',
  };

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start gap-3">
          <Link to={`/kits/${kit.id}`} aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="min-w-0 flex-1 text-2xl font-bold leading-tight">{title}</h1>
          <span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
            {summary.durationLabel} · {summary.sourceLabel}
          </span>
        </div>
      </NavyHeader>

      <div className="px-5 pt-5">
        <p className="text-sm font-bold uppercase tracking-wide text-navy-600">
          {t('summary.label')}
        </p>
        <h2 className="mt-1 text-3xl font-bold text-navy-900">
          {language === 'km' ? summary.titleKm : summary.title}
        </h2>
        <p className="mt-2 text-base leading-relaxed text-navy-600">
          {language === 'km' ? summary.bodyMdKm : summary.bodyMd}
        </p>

        <p className="mt-5 text-base text-navy-700">
          {t('summary.ready', { done: ready, total: chapters.length })}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-tint-100">
            <span className="block h-full rounded-full bg-navy-600" style={{ width: `${percent}%` }} />
          </div>
          <span className="text-base font-bold text-navy-900">{percent}%</span>
        </div>

        <ul className="mt-5 divide-y divide-tint-200">
          {chapters.slice(0, 5).map((chapter) => {
            const chapterTitle = language === 'km' ? chapter.titleKm : chapter.title;
            const isReady = chapter.status === 'ready';
            return (
              <li key={chapter.index}>
                <Link
                  to={isReady ? `/study/${kit.id}/summary/${chapter.index}` : '#'}
                  aria-disabled={!isReady}
                  onClick={(event) => !isReady && event.preventDefault()}
                  className={`flex items-center gap-3 py-4 ${isReady ? '' : 'cursor-default'}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-navy-900">
                      {String(chapter.index).padStart(2, '0')} · {chapterTitle}
                    </span>
                    <span className="mt-0.5 block text-sm text-navy-600">
                      {clock(chapter.start)}–{clock(chapter.end)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-sm font-semibold ${
                      isReady ? 'text-navy-700' : 'text-ink-400'
                    }`}
                  >
                    {t(STATUS_KEY[chapter.status])}
                  </span>
                  <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                    <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>

        <button type="button" className="mt-4 text-base font-semibold text-navy-700 underline">
          {t('summary.showAllChapters')}
        </button>
      </div>
    </main>
  );
};
