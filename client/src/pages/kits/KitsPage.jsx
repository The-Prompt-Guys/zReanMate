import { useState } from 'react';
import { Link } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { BrandLogo, Owl } from '../../layouts/AuthLayout.jsx';
import { KitCard } from '../../components/KitCard.jsx';
import { SearchField, FilterTabs } from '../../components/listControls.jsx';
import { useKits } from '../../kits/KitsContext.jsx';
import { useT } from '../../i18n/index.js';

/** docs/screens/03-study-kits/01-kits-tab. */
export const KitsPage = () => {
  const t = useT();
  const { kits, status, error, refresh } = useKits();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const visible = kits
    .filter((kit) => (filter === 'all' ? true : kit.status === filter))
    .filter((kit) => {
      if (!query.trim()) return true;
      const haystack = `${kit.title} ${kit.titleKm}`.toLowerCase();
      return haystack.includes(query.trim().toLowerCase());
    });

  return (
    <main>
      <NavyHeader className="relative overflow-hidden">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-white/10 blur-2xl"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-14 -left-8 size-36 rounded-full bg-navy-600/45 blur-2xl"
        />

        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/"
              aria-label={t('nav.home')}
              className="inline-flex rounded-md transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
            >
              <BrandLogo className="h-8 max-w-[10rem]" />
            </Link>
            <h1 className="mt-2 text-[1.7rem] font-bold leading-[1.15] tracking-tight">
              {t('kits.title')}
            </h1>
          </div>
          <Owl
            variant="transparent"
            className="-mb-1 size-[4.5rem] shrink-0 origin-bottom transition-transform duration-300 ease-out hover:scale-105"
          />
        </div>
      </NavyHeader>

      <div className="space-y-4 px-5 pt-4">
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder={t('kits.searchPlaceholder')}
          label={t('kits.searchPlaceholder')}
        />

        <FilterTabs
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('kits.filterAll') },
            { value: 'in_progress', label: t('kits.filterInProgress') },
            { value: 'completed', label: t('kits.filterCompleted') },
          ]}
        />

        {status === 'loading' && <KitGridSkeleton />}

        {status === 'error' && (
          <div className="rounded-card bg-white px-6 py-8 text-center shadow-sm ring-1 ring-tint-200/70">
            <p className="text-base font-bold text-navy-900">{t('kits.loadFailed')}</p>
            {error?.message && <p className="mt-1 text-sm text-navy-600">{error.message}</p>}
            <button
              type="button"
              onClick={refresh}
              className="mt-4 rounded-full bg-navy-800 px-6 py-3 text-base font-bold text-white"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {status === 'ready' &&
          (visible.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {visible.map((kit) => (
                <KitCard key={kit.id} kit={kit} />
              ))}
            </div>
          ) : query.trim() || filter !== 'all' ? (
            <p className="py-10 text-center text-base text-ink-500">
              {t('kits.noResults', { query: query.trim() })}
            </p>
          ) : (
            // No kits at all is a different screen from no search results — the
            // first needs a way forward, the second needs a way back.
            <div className="rounded-card bg-white px-6 py-8 text-center shadow-sm ring-1 ring-tint-200/70">
              <h3 className="text-xl font-bold text-navy-900">{t('dashboard.emptyTitle')}</h3>
              <p className="mt-1.5 text-base text-navy-600">{t('dashboard.emptyBody')}</p>
            </div>
          ))}

        <Link
          to="/kits/folders/new"
          className="flex items-center gap-4 rounded-card border border-dashed border-navy-600/30 bg-tint-100/70 p-4 transition-colors hover:border-navy-600/50 hover:bg-tint-100"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white shadow-sm shadow-navy-900/20">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-lg font-bold text-navy-900">{t('kits.createTitle')}</span>
            <span className="block text-sm text-navy-600">{t('kits.createHint')}</span>
          </span>
        </Link>
      </div>
    </main>
  );
};

/**
 * Four cards in the real grid shape, so the page does not reflow when the kits
 * land. aria-busy lets a screen reader announce loading rather than read out
 * four empty boxes.
 */
const KitGridSkeleton = () => {
  const t = useT();
  return (
    <div className="grid grid-cols-2 gap-3" aria-busy="true" aria-label={t('common.loading')}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
        >
          <span className="block size-11 rounded-xl bg-tint-200" />
          <span className="mt-2.5 block h-4 w-4/5 rounded bg-tint-200" />
          <span className="mt-2 block h-3 w-1/2 rounded bg-tint-100" />
          <span className="mt-3 block h-1.5 w-full rounded-full bg-tint-100" />
        </div>
      ))}
    </div>
  );
};
