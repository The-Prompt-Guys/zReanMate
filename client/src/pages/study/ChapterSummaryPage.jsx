import { Link, useParams, useSearchParams } from 'react-router-dom';

import { Markdown } from '../../components/Markdown.jsx';
import { TutorDrawer } from '../../components/TutorDrawer.jsx';
import { useLanguage, useT } from '../../i18n/index.js';
import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { useSourceSummaries, useStudySource } from './useSourceSummaries.js';

export const ChapterSummaryPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId, chapter } = useParams();
  const [params] = useSearchParams();
  const { kit, source } = useStudySource(kitId);
  const { chapterData, plusRequired } = useSourceSummaries(source, language);
  const current = chapterData?.chapters?.find((item) => String(item.index) === chapter);
  const title = language === 'km' ? (kit?.titleKm || kit?.title) : kit?.title;

  return <main>
    <NavyHeader><div className="flex items-start gap-3"><Link to={`/study/${kitId}/summary`} aria-label={t('common.back')} className="mt-1 shrink-0"><svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true"><path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></Link><h1 className="min-w-0 flex-1 text-2xl font-bold leading-tight">{title}</h1><span className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">{source?.name}</span></div></NavyHeader>
    <div className="px-5 pt-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-bold uppercase tracking-wide text-navy-600">{t('summary.label')}</p><h2 className="mt-1 text-3xl font-bold text-navy-900">{current?.title ?? t('summary.heading')}</h2></div><Owl variant="reading" className="size-20 shrink-0" /></div>
      {plusRequired ? <Link to="/onboarding/plan" className="mt-6 inline-block rounded-full bg-navy-800 px-5 py-2.5 font-bold text-white">{t('summary.plusRequired')}</Link> : <div className="mt-6 text-lg leading-relaxed text-navy-700">{current?.bodyMd ? <Markdown source={current.bodyMd} /> : t(current?.status === 'failed' ? 'summary.chapterStatusFailed' : 'summary.chapterStatusGenerating')}</div>}
    </div>
    <TutorDrawer defaultOpen={params.get('tutor') === '1'} subject={title} kitId={kitId} />
  </main>;
};
