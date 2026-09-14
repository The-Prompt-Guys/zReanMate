import { Link, useSearchParams } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { Owl } from '../../layouts/AuthLayout.jsx';
import { Button } from '../../components/ui.jsx';
import { assignment } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * docs/screens/09-classes-assignments/04-assignment-detail, and 05 when
 * `?upload=1` reveals the "Your submission" upload panel.
 */
export const AssignmentDetailPage = () => {
  const t = useT();
  const { language } = useLanguage();
  const [params] = useSearchParams();
  const showUpload = params.get('upload') === '1';

  const instructions = language === 'km' ? assignment.instructionsKm : assignment.instructions;

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link to="/classes/class-eng?tab=quizzes" aria-label={t('common.back')} className="mt-1 shrink-0">
              <svg viewBox="0 0 24 24" className="size-7" fill="none" aria-hidden="true">
                <path d="M19 12H5m6-6-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold leading-tight">
                {language === 'km' ? assignment.titleKm : assignment.title}
              </h1>
              <p className="mt-0.5 truncate text-base text-white/75">{assignment.className}</p>
            </div>
          </div>
          <Owl variant="waving" className="size-16 shrink-0" />
        </div>
      </NavyHeader>

      <div className="space-y-4 px-5 pt-4">
        <span className="inline-flex items-center gap-2 rounded-full bg-gold-400/35 px-4 py-2 text-base font-bold text-navy-900">
          <CalendarIcon />
          <span className="size-2 rounded-full bg-gold-500" aria-hidden="true" />
          {t('assignments.due', { date: assignment.dueLabel })}
        </span>

        <Card icon={<DocIcon />} title={t('assignments.overview')}>
          <p className="text-base leading-relaxed text-navy-600">
            {language === 'km' ? assignment.overviewKm : assignment.overview}
          </p>
        </Card>

        <Card icon={<ListIcon />} title={t('assignments.instructions')}>
          <ol className="space-y-3">
            {instructions.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tint-200 text-sm font-bold text-navy-800">
                  {i + 1}
                </span>
                <span className="text-base text-navy-800">{step}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card icon={<ClipIcon />} title={t('assignments.attached')}>
          <ul className="divide-y divide-tint-200">
            {assignment.materials.map((material) => (
              <li key={material.id} className="flex items-center gap-3 py-3">
                <PdfMark />
                <span className="min-w-0 flex-1 truncate text-base text-navy-900">{material.name}</span>
                <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-600" fill="none" aria-hidden="true">
                  <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </li>
            ))}
          </ul>
        </Card>

        {showUpload && (
          <Card icon={<UploadIcon />} title={t('assignments.yourSubmission')}>
            <div className="rounded-card border-2 border-dashed border-navy-600/30 px-5 py-7 text-center">
              <CloudIcon />
              <p className="mt-3 text-lg font-bold text-navy-900">{t('assignments.uploadWork')}</p>
              <p className="mt-1 text-sm text-navy-600">{t('assignments.uploadFormats')}</p>
              <button
                type="button"
                className="mt-4 rounded-full bg-navy-800 px-6 py-3 text-base font-bold text-white"
              >
                {t('assignments.chooseFile')}
              </button>
            </div>
            <p className="mt-3 text-center text-sm text-navy-600">{t('assignments.orCompleteInApp')}</p>
          </Card>
        )}

        <div className="flex items-center gap-3 rounded-card bg-tint-100 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-navy-800 text-navy-800">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
              <path d="m7 12 3.5 3.5L17 9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-navy-900">{t('classes.notStarted')}</span>
            <span className="block text-sm text-navy-600">
              {t('assignments.progress', {
                done: assignment.completed,
                total: assignment.questionCount,
              })}
            </span>
          </span>
        </div>

        <div className="space-y-3 pb-4">
          <Link
            to="/assignments/a1/work"
            className="flex w-full items-center justify-center rounded-full bg-navy-800 py-4 text-lg font-bold text-white"
          >
            {t('assignments.start')}
          </Link>
          <div className="text-center">
            <Link to="/tutor" className="font-semibold text-navy-700">
              {t('assignments.askAi')}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
};

const Card = ({ icon, title, children }) => (
  <section className="rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70">
    <div className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-tint-100 text-navy-800">
        {icon}
      </span>
      <h2 className="text-xl font-bold text-navy-900">{title}</h2>
    </div>
    <div className="mt-3">{children}</div>
  </section>
);

const p = {
  viewBox: '0 0 24 24',
  className: 'size-6',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const DocIcon = () => (
  <svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
);

const ListIcon = () => (
  <svg {...p}>
    <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
  </svg>
);

const ClipIcon = () => (
  <svg {...p}>
    <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7.5-7.5" />
  </svg>
);

const UploadIcon = () => (
  <svg {...p}>
    <path d="M12 16V5m0 0L8 9m4-4 4 4M5 19h14" />
  </svg>
);

const CalendarIcon = () => (
  <svg {...p} className="size-5">
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const CloudIcon = () => (
  <svg viewBox="0 0 48 48" className="mx-auto size-12 text-navy-800" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 33a8 8 0 0 1 .8-16 11 11 0 0 1 20.6 3A7.5 7.5 0 0 1 34 33" />
    <path d="M24 40V24m0 0-5 5m5-5 5 5" />
  </svg>
);

const PdfMark = () => (
  <svg viewBox="0 0 24 24" className="size-8 shrink-0" fill="none" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2.5" fill="#E2574C" />
    <path d="M7.5 15.5c2-3 2.7-5.4 2-5.8-.8-.5-1.2 2.2 1 4 .9.7 2 1 2.7.8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
    <text x="12" y="19.5" textAnchor="middle" fill="#fff" fontSize="5" fontWeight="bold">
      PDF
    </text>
  </svg>
);
