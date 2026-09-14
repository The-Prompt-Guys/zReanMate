import { Link, useParams, useSearchParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { TutorDrawer } from '../../components/TutorDrawer.jsx';
import { chapters, kits, summarySections } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/04-study-mode-summaries/03-summary-small-owl. */
export const ChapterSummaryPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const { kitId = 'kit-database', chapter } = useParams();
  const [params] = useSearchParams();
  // The drawer is part of this screen in the design; ?tutor=1 opens it
  // expanded so docs/screens/05-ai-tutor-chat/02 is directly reviewable.
  const tutorOpen = params.get('tutor') === '1';

  const kit = kits.find((k) => k.id === kitId) ?? kits[1];
  const title = language === 'km' ? kit.titleKm : kit.title;
  const current = chapters.find((c) => String(c.index) === chapter);

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start gap-3">
          <Link to={`/study/${kit.id}/summary`} aria-label={t('common.back')} className="mt-1 shrink-0">
            <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
              <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="min-w-0 flex-1 text-2xl font-bold leading-tight">{title}</h1>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <rect x="2" y="5" width="20" height="14" rx="3.5" fill="#E2574C" />
              <path d="m10 9 5 3-5 3z" fill="#fff" />
            </svg>
            {t('summary.youtubeVideo')}
          </span>
        </div>
      </NavyHeader>

      <div className="px-5 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-navy-600">
              {t('summary.label')}
            </p>
            <h2 className="mt-1 text-3xl font-bold text-navy-900">
              {current ? (language === 'km' ? current.titleKm : current.title) : t('summary.heading')}
            </h2>
          </div>
          <Owl variant="reading" className="size-20 shrink-0" />
        </div>

        <div className="mt-6 space-y-6">
          {summarySections.map((section) => (
            <section key={section.id}>
              <h3 className="text-xl font-bold text-navy-900">
                {language === 'km' ? section.headingKm : section.heading}
              </h3>
              <p className="mt-2 text-lg leading-relaxed text-navy-700">
                {language === 'km' ? section.bodyKm : section.body}
              </p>
            </section>
          ))}
        </div>
      </div>

      <TutorDrawer defaultOpen={tutorOpen} subject={title} />
    </main>
  );
};
