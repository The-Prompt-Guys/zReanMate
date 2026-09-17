import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { BottomSheet } from '../../components/BottomSheet.jsx';
import { CardsIcon, DocIcon, QuizIcon, TargetIcon } from './StudyModePage.jsx';
import { api } from '../../lib/api.js';
import { formatBytes } from '../../lib/format.js';
import { useT } from '../../i18n/index.js';
import { useStudySource } from './useSourceSummaries.js';

/**
 * docs/screens/04-study-mode-summaries/04-pdf-viewer-with-chat, and 05 when
 * `?actions=1` opens the "Study this file" sheet over it.
 */
export const PdfViewerPage = () => {
  const t = useT();
  const { kitId = 'kit-database' } = useParams();
  const [params] = useSearchParams();
  const showActions = params.get('actions') === '1';
  const { source } = useStudySource(kitId);
  const [sourceDetail, setSourceDetail] = useState(null);

  useEffect(() => {
    if (!source?.id) return;
    let cancelled = false;
    api.get(`/kits/${kitId}/sources/${source.id}`).then(({ data }) => {
      if (!cancelled) setSourceDetail(data.source);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [kitId, source?.id]);

  const content = sourceDetail?.extractedText ?? '';
  const sections = content.split(/\n\s*\n/).filter(Boolean).slice(0, 30);
  const documentName = source?.name ?? t('summary.heading');

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start gap-3">
          <Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold leading-tight">{documentName}</h1>
            <p className="mt-0.5 text-base text-white/75">{source?.kind?.toUpperCase()} · {formatBytes(source?.byteSize ?? 0)}</p>
          </div>
          <Link
            to={`/study/${kitId}/pdf?actions=1&sourceId=${encodeURIComponent(source?.id ?? '')}`}
            className="flex shrink-0 items-center gap-2 rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold"
          >
            <OwlMark />
            {t('study.askAi')}
          </Link>
        </div>
      </NavyHeader>

      {/* Page controls */}
      <div className="flex items-center justify-between px-5 pt-4">
        <span className="rounded-full bg-tint-100 px-4 py-2 text-base font-semibold text-navy-800">
          {t('study.pageOf', { current: 1, total: source?.pageCount ?? 1 })}
        </span>
        <div className="flex items-center gap-2">
          <IconButton label={t('common.search')}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </IconButton>
          <IconButton label={t('study.zoomOut')}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path d="M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </IconButton>
          <span className="text-base font-semibold text-navy-800">100%</span>
          <IconButton label={t('study.zoomIn')}>
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path d="M12 6v12M6 12h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Rendered page */}
      <article className="mx-5 mt-3 rounded-card bg-white p-5 shadow-sm ring-1 ring-tint-200/70">
        <h2 className="border-b border-tint-200 pb-3 text-2xl font-bold text-navy-900">
          {documentName}
        </h2>
        {sections.map((section, index) => <p key={`${index}-${section.slice(0, 20)}`} className="mt-4 whitespace-pre-wrap leading-relaxed text-navy-700">{section}</p>)}
      </article>

      {/* Chat drawer */}
      <section className="mt-4 rounded-t-[1.5rem] bg-tint-100/70 px-5 pb-6 pt-3">
        <span className="mx-auto block h-1.5 w-12 rounded-full bg-tint-200" aria-hidden="true" />
        <div className="mt-3 flex items-center gap-3">
          <OwlAvatar />
          <h2 className="text-xl font-bold text-navy-900">{t('study.chatAboutPdf')}</h2>
        </div>

        <ul className="mt-4 space-y-3">
        </ul>

        <form
          className="mt-4 flex items-center gap-2 rounded-full bg-white p-2 ring-1 ring-tint-200"
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            className="min-w-0 flex-1 bg-transparent px-3 text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none"
            placeholder={t('study.askAboutPdf')}
            aria-label={t('study.askAboutPdf')}
          />
          <button type="button" aria-label={t('assignments.uploadFile')} className="grid size-10 place-items-center rounded-full text-navy-700">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="submit" aria-label={t('tutor.send')} className="grid size-11 shrink-0 place-items-center rounded-full bg-navy-800 text-white">
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
              <path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z" />
            </svg>
          </button>
        </form>
      </section>

      {showActions && <StudyActionsSheet kitId={kitId} sourceName={documentName} sourceId={source?.id} sourceReady={source?.status === 'ready'} />}
    </main>
  );
};

/** docs/screens/04-study-mode-summaries/05-pdf-study-actions. */
const StudyActionsSheet = ({ kitId, sourceName, sourceId, sourceReady = false }) => {
  const t = useT();
  const sourceQuery = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
  const rows = [
    { to: `/study/${kitId}/summary${sourceQuery}`, tone: 'bg-tint-100', tile: 'bg-tint-200 text-navy-800', Icon: DocIcon, title: t('study.summarize'), hint: t('study.summarizeRead') },
    { to: `/quiz/${kitId}${sourceQuery}`, tone: 'bg-violet-50', tile: 'bg-violet-100 text-violet-700', Icon: QuizIcon, title: t('study.quizMe'), hint: t('study.quizMeHint') },
    { to: '/practice', tone: 'bg-amber-50', tile: 'bg-amber-100 text-amber-700', Icon: TargetIcon, title: t('study.practice'), hint: t('study.practiceApply') },
    { to: `/flashcards/${kitId}${sourceQuery}`, tone: 'bg-emerald-50', tile: 'bg-emerald-100 text-emerald-700', Icon: CardsIcon, title: t('study.flashcards'), hint: t('study.flashcardsReview') },
    { to: `/tutor?kitId=${encodeURIComponent(kitId)}${sourceId ? `&sourceId=${encodeURIComponent(sourceId)}` : ''}`, tone: 'bg-tint-100', tile: 'bg-tint-200 text-navy-800', Icon: OwlMark, title: t('study.chatAboutPdf'), hint: t('study.chatHint') },
  ];

  return (
    <BottomSheet closeTo={`/study/${kitId}/pdf`} labelledBy="study-file-title">
      <h2 id="study-file-title" className="text-2xl font-bold text-navy-900">
        {t('study.studyThisFile')}
      </h2>
      <p className="mt-1 text-base text-navy-600">
        {t('study.studyThisFileHint', { name: sourceName })}
      </p>

      <div className="mt-5 space-y-3">
        {rows.map(({ to, tone, tile, Icon, title, hint }) => {
          const disabled = !!sourceId && !sourceReady;
          return (
            <Link
              key={title}
              to={disabled ? '#' : to}
              onClick={(event) => {
                if (disabled) event.preventDefault();
              }}
              aria-disabled={disabled}
              className={`flex items-center gap-4 rounded-card p-3.5 ${tone} ${disabled ? 'pointer-events-none opacity-45' : ''}`}
            >
              <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${tile}`}>
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
          );
        })}
      </div>

      <p className="mt-5 flex items-start gap-2 text-sm text-navy-600">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 11v5m0-8.2v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {t('study.contextNote', { name: sourceName })}
      </p>
    </BottomSheet>
  );
};

const IconButton = ({ label, children }) => (
  <button
    type="button"
    aria-label={label}
    className="grid size-10 place-items-center rounded-full bg-tint-100 text-navy-800"
  >
    {children}
  </button>
);

const OwlAvatar = () => (
  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-tint-200">
    <OwlMark />
  </span>
);

export const OwlMark = () => (
  <svg viewBox="0 0 24 24" className="size-5 text-navy-800" fill="none" aria-hidden="true">
    <path d="M4 9a8 8 0 0 1 16 0v5a8 8 0 0 1-16 0z" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="9" cy="11" r="2.4" fill="currentColor" />
    <circle cx="15" cy="11" r="2.4" fill="currentColor" />
    <path d="m12 14 1.4 1.4h-2.8z" fill="currentColor" />
    <path d="m5 4 2.5 2M19 4l-2.5 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
