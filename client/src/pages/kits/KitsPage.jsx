import { useState } from 'react';
import { Link } from 'react-router-dom';

import { NavyHeader } from '../../layouts/AppLayout.jsx';
import { KitCard } from '../../components/KitCard.jsx';
import { SearchField, FilterTabs } from '../../components/listControls.jsx';
import { kits } from '../../mock/fixtures.js';
import { useLanguage, useT } from '../../i18n/index.js';

/** docs/screens/03-study-kits/01-kits-tab. */
export const KitsPage = () => {
  const t = useT();
  const { language } = useLanguage();
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
      <NavyHeader className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('kits.title')}</h1>
          <p className="mt-1 text-base text-white/75">{t('kits.subtitle')}</p>
        </div>
        <Link
          to="/kits/new"
          aria-label={t('kits.createTitle')}
          className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-navy-800"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </Link>
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

        {visible.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {visible.map((kit) => (
              <KitCard key={kit.id} kit={kit} />
            ))}
          </div>
        ) : (
          <p className="py-10 text-center text-base text-ink-500">
            {t('kits.noResults', { query })}
          </p>
        )}

        {/* Create a new study kit */}
        <Link
          to="/kits/new"
          className="flex items-center gap-4 rounded-card border border-dashed border-navy-600/35 bg-tint-100/60 p-4"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white">
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
