import { Link } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext.jsx';
import { NavyHeader } from '../layouts/AppLayout.jsx';
import { Owl } from '../layouts/AuthLayout.jsx';
import { KitCard } from '../components/KitCard.jsx';
import { ArrowRightIcon } from '../components/ui.jsx';
import { kits } from '../mock/fixtures.js';
import { useT } from '../i18n/index.js';

/** docs/screens/02-dashboard/01-dashboard-populated-navy-no-quote. */
export const DashboardPage = () => {
  const t = useT();
  const { user } = useAuth();

  return (
    <main>
      <NavyHeader>
        <div className="flex items-start justify-between">
          <p className="text-lg font-bold">{t('common.appName')}</p>
          <Link
            to="/profile"
            aria-label={t('profile.title')}
            className="grid size-10 place-items-center overflow-hidden rounded-full bg-white/20 text-sm font-bold"
          >
            {(user?.full_name ?? 'S').charAt(0)}
          </Link>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.7rem] font-bold leading-[1.15]">
              {t('dashboard.welcome', { name: user?.full_name ?? '' })}
            </h1>
            <Link
              to="/kits"
              className="mt-5 inline-flex rounded-full bg-white px-7 py-3.5 text-base font-bold text-navy-900"
            >
              {t('dashboard.startStudying')}
            </Link>
          </div>
          <Owl variant="waving" className="-mb-2 size-28 shrink-0" />
        </div>
      </NavyHeader>

      <div className="space-y-6 px-5 pt-5">
        {/* Add your material */}
        <Link
          to="/kits/new"
          className="flex items-center gap-4 rounded-card bg-white p-4 shadow-sm ring-1 ring-tint-200/70"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white">
            <PlusIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-bold text-navy-900">{t('dashboard.addMaterial')}</span>
            <span className="block text-sm text-navy-600">{t('dashboard.addMaterialHint')}</span>
          </span>
          <ArrowRightIcon className="size-5 shrink-0 text-navy-800" />
        </Link>

        {/* Study kits */}
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">{t('dashboard.studyKits')}</h2>
            <Link to="/kits" className="flex items-center gap-1 text-sm font-semibold text-navy-700">
              {t('common.seeAll')}
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {kits.slice(0, 4).map((kit) => (
              <KitCard key={kit.id} kit={kit} compact />
            ))}
          </div>
        </section>

        {/* Feature carousel */}
        <section className="rounded-card bg-tint-100 p-5">
          <span className="inline-block rounded-full bg-white/70 px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy-700">
            {t('dashboard.featureBadge')}
          </span>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-xl font-bold text-navy-900">{t('dashboard.featureTitle')}</h3>
              <p className="mt-1.5 text-sm text-navy-600">{t('dashboard.featureBody')}</p>
              <Link
                to="/tutor"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy-800 px-5 py-3 text-sm font-bold text-white"
              >
                {t('dashboard.featureAction')}
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
            <TutorArt />
          </div>
          <div className="mt-4 flex justify-center gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={`size-2 rounded-full ${i === 0 ? 'bg-navy-800' : 'bg-navy-800/25'}`}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

/** The chat-bot + flashcards illustration on the feature card. */
const TutorArt = () => (
  <svg viewBox="0 0 96 80" className="size-24 shrink-0" fill="none" aria-hidden="true">
    <g stroke="#0C3C85" strokeWidth="2.2" strokeLinejoin="round">
      <rect x="8" y="10" width="40" height="30" rx="9" fill="#fff" />
      <path d="M20 40l-2 8 10-8" fill="#fff" />
      <circle cx="22" cy="25" r="3.2" fill="#0C3C85" stroke="none" />
      <circle cx="34" cy="25" r="3.2" fill="#0C3C85" stroke="none" />
      <path d="M28 10V4M24 4h8" strokeLinecap="round" />
      <rect x="34" y="44" width="30" height="30" rx="4" fill="#fff" />
      <rect x="54" y="38" width="30" height="34" rx="4" fill="#fff" />
      <path d="M40 52h16M40 59h12M40 66h9" strokeLinecap="round" />
    </g>
    <path
      d="m69 46 2.6 5.2 5.8.9-4.2 4 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4 5.8-.9z"
      fill="#FDC96A"
    />
    <path d="M60 8l3 5M70 4v6M78 9l-4 4" stroke="#0C3C85" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
