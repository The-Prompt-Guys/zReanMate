import { Link, useParams } from 'react-router-dom';

import { Markdown } from '../../components/Markdown.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { useSourceSummaries, useStudySource } from './useSourceSummaries.js';

const clock = (seconds = 0) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

export const SummaryPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId } = useParams();
  const { kit, source, status: sourceStatus } = useStudySource(kitId);
  const { summary: summaryData, chapterData, error, plusRequired } = useSourceSummaries(source, language);
  const summary = summaryData?.summary;
  const chapters = chapterData?.chapters ?? [];
  const ready = chapters.filter((item) => item.status === 'ready').length;
  const percent = chapters.length ? Math.round((ready / chapters.length) * 100) : 0;
  const title = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;
  const statusKey = { ready: 'summary.chapterStatusReady', generating: 'summary.chapterStatusGenerating', pending: 'summary.chapterStatusPending', failed: 'summary.chapterStatusFailed' };

  return <main>
    <NavyHeader><div className="flex items-start gap-3">
      <Link to={`/kits/${kitId}`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link>
      <h1 className="min-w-0 flex-1 text-2xl font-bold leading-tight">{title}</h1>
      {source && <span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">{source.name}</span>}
    </div></NavyHeader>
    <div className="px-5 pt-5">
      <p className="text-sm font-bold uppercase tracking-wide text-navy-600">{t('summary.label')}</p>
      <h2 className="mt-1 text-3xl font-bold text-navy-900">{summary?.title ?? t('summary.heading')}</h2>
      <div className="mt-2 text-base leading-relaxed text-navy-600">
        {summary?.bodyMd
          ? <Markdown source={summary.bodyMd} />
          : (sourceStatus === 'loading' ? t('common.loading') : t('summary.generatingSummary'))}
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{t('summary.loadFailed')}</p>}
      {plusRequired ? <Link to="/onboarding/plan" className="mt-5 inline-block rounded-full bg-navy-800 px-5 py-2.5 font-bold text-white">{t('summary.plusRequired')}</Link> : <>
        <p className="mt-5 text-base text-navy-700">{t('summary.ready', { done: ready, total: chapters.length })}</p>
        <div className="mt-2 flex items-center gap-3"><div className="h-2.5 flex-1 overflow-hidden rounded-full bg-tint-100"><span className="block h-full rounded-full bg-navy-600" style={{ width: `${percent}%` }} /></div><span className="text-base font-bold text-navy-900">{percent}%</span></div>
        <ul className="mt-5 divide-y divide-tint-200">{chapters.map((item) => {
          const isReady = item.status === 'ready';
          return <li key={item.index}><Link to={isReady ? `/study/${kitId}/summary/${item.index}` : '#'} aria-disabled={!isReady} onClick={(event) => !isReady && event.preventDefault()} className={`flex items-center gap-3 py-4 ${isReady ? '' : 'cursor-default'}`}><span className="min-w-0 flex-1"><span className="block font-bold text-navy-900">{String(item.index).padStart(2, '0')} · {item.title}</span><span className="mt-0.5 block text-sm text-navy-600">{clock(item.startSeconds)}–{clock(item.endSeconds)}</span></span><span className={`shrink-0 text-sm font-semibold ${isReady ? 'text-navy-700' : 'text-ink-400'}`}>{t(statusKey[item.status] ?? 'summary.chapterStatusPending')}</span><svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link></li>;
        })}</ul>
      </>}
    </div>
  </main>;
};
