import { Link } from 'react-router-dom';

import { KitsHeader } from '../../layouts/AppLayout.jsx';
import { ChevronRightIcon, Fab } from '../../components/ui.jsx';
import { useKits } from '../../kits/KitsContext.jsx';
import { useLanguage, useT } from '../../i18n/index.js';

/**
 * "1 material" / "3 materials".
 *
 * The dictionaries interpolate but do not inflect, so the singular is its own
 * key rather than a rule. Khmer does not mark plurals at all and points both
 * keys at the same string.
 */
export const materialCount = (t, count) =>
  count === 1 ? t('kits.materialCountOne') : t('kits.materialCount', { count });

/**
 * The Kits tab.
 *
 * The reference lays kits out as full-width rows rather than the two-column
 * grid this screen used to show, and carries no search field or filter tabs —
 * the list is meant to stay short, and the floating button is the only control.
 */
export const KitsPage = () => {
  const t = useT();
  const { kits, status, error, refresh } = useKits();

  return (
    <main>
      <KitsHeader to="/" title={t('kits.title')} />

      <div className="space-y-3 px-5 pt-4">
        {status === 'loading' && <KitListSkeleton />}

        {status === 'error' && (
          <div className="rounded-2xl bg-white px-6 py-8 text-center shadow-sm ring-1 ring-tint-200/70">
            <p className="text-base font-bold text-deep-950">{t('kits.loadFailed')}</p>
            {error?.message && <p className="mt-1 text-sm text-mist-500">{error.message}</p>}
            <button
              type="button"
              onClick={refresh}
              className="mt-4 rounded-full bg-link-700 px-6 py-3 text-base font-bold text-white"
            >
              {t('common.retry')}
            </button>
          </div>
        )}

        {/* An account with no kits gets a bare canvas and the button, as the
            reference does — the empty state that explains itself lives one
            level down, inside a kit. */}
        {status === 'ready' && kits.map((kit) => <KitRow key={kit.id} kit={kit} />)}
      </div>

      <Fab to="/kits/folders/new" label={t('kits.createTitle')} />
    </main>
  );
};

/**
 * The tile fill for each accent the server stores on a kit.
 *
 * A kit whose accent is missing or unrecognised still gets a stable colour,
 * picked from its id rather than its position — so it does not change when a
 * kit above it is deleted, and matches on every device.
 */
const ACCENT_TILES = {
  blue: 'bg-kit-blue',
  violet: 'bg-kit-violet',
  amber: 'bg-kit-amber',
  teal: 'bg-kit-teal',
};

const ACCENT_ORDER = ['blue', 'violet', 'amber', 'teal'];

export const accentFor = (kit) => {
  if (ACCENT_TILES[kit?.accent]) return kit.accent;
  const id = String(kit?.id ?? '');
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENT_ORDER[hash % ACCENT_ORDER.length];
};

/**
 * One kit: folder tile, title, and how many materials are in it.
 *
 * Exported because the dashboard lists kits the same way — one component so the
 * two screens cannot drift apart. `to` overrides where the row leads for the
 * screens that pick a kit rather than open one (the add-material picker).
 */
export const KitRow = ({ kit, to }) => {
  const t = useT();
  const { language } = useLanguage();
  const title = language === 'km' ? (kit.titleKm ?? kit.title) : kit.title;

  return (
    <Link
      to={to ?? `/kits/${kit.id}`}
      className="flex items-center gap-3.5 rounded-card bg-white p-3 shadow-sm ring-1 ring-tint-200/70 transition-colors hover:bg-wash-50"
    >
      <span
        className={`grid size-14 shrink-0 place-items-center rounded-2xl text-white ${ACCENT_TILES[accentFor(kit)]}`}
      >
        <FolderIcon />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-extrabold text-deep-950">{title}</span>
        <span className="block text-base font-semibold text-sky-600">
          {materialCount(t, kit.fileCount ?? 0)}
        </span>
      </span>
      <ChevronRightIcon className="size-6 shrink-0 text-sky-600" />
    </Link>
  );
};

const FolderIcon = () => (
  <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden="true">
    <path
      d="M3 7a2 2 0 0 1 2-2h4.6l2 2.4H19a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
      fill="currentColor"
      fillOpacity="0.35"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Three rows in the real shape, so the page does not reflow when the kits land.
 * aria-busy lets a screen reader announce loading rather than read empty boxes.
 */
const KitListSkeleton = () => {
  const t = useT();
  return (
    <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex animate-pulse items-center gap-3.5 rounded-card bg-white p-3 shadow-sm ring-1 ring-tint-200/70">
          <span className="size-14 shrink-0 rounded-2xl bg-tile-blue" />
          <span className="min-w-0 flex-1">
            <span className="block h-4 w-3/5 rounded bg-tile-blue" />
            <span className="mt-2 block h-3 w-1/4 rounded bg-tile-blue/70" />
          </span>
        </div>
      ))}
    </div>
  );
};
