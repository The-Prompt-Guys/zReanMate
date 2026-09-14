import { Link } from 'react-router-dom';

import { useLanguage, useT } from '../i18n/index.js';

/**
 * The study-kit card used on the dashboard grid and the Kits tab
 * (docs/screens/02-dashboard/01 and 03-study-kits/01).
 *
 * `compact` is the dashboard variant: no overflow menu, tighter padding.
 */

const ACCENTS = {
  blue: 'bg-tint-200 text-navy-800',
  violet: 'bg-violet-100 text-violet-700',
  amber: 'bg-amber-100 text-amber-700',
  teal: 'bg-teal-100 text-teal-700',
};

export const KitCard = ({ kit, compact = false }) => {
  const t = useT();
  const { language } = useLanguage();
  const Icon = ICONS[kit.icon] ?? ICONS.document;
  // The dashboard grid is two narrow columns, so it uses the short title the
  // design shows there ("Database Systems"); the Kits tab uses the full one.
  const full = language === 'km' ? kit.titleKm : kit.title;
  const short = language === 'km' ? (kit.shortTitleKm ?? full) : (kit.shortTitle ?? full);
  const title = compact ? short : full;

  return (
    <Link
      to={`/kits/${kit.id}`}
      className="flex flex-col rounded-card bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70"
    >
      <div className="flex items-start justify-between">
        <span className={`grid size-11 place-items-center rounded-xl ${ACCENTS[kit.accent] ?? ACCENTS.blue}`}>
          <Icon />
        </span>
        {kit.sourceKind === 'youtube' && <YouTubeBadge />}
        {!compact && kit.sourceKind !== 'youtube' && <MoreDots />}
      </div>

      <p className="mt-2.5 line-clamp-2 font-bold leading-snug text-navy-900">{title}</p>
      <p className="mt-0.5 text-sm text-navy-600">{t('kits.cardCount', { count: kit.cardCount })}</p>

      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-tint-200"
        role="progressbar"
        aria-valuenow={kit.progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="block h-full rounded-full bg-navy-800" style={{ width: `${kit.progress}%` }} />
      </div>
    </Link>
  );
};

const YouTubeBadge = () => (
  <span className="grid size-6 place-items-center rounded-md bg-red-500 text-white" aria-hidden="true">
    <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  </span>
);

const MoreDots = () => (
  <span className="text-navy-600/50" aria-hidden="true">
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
    </svg>
  </span>
);

const iconProps = {
  viewBox: '0 0 24 24',
  className: 'size-6',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
};

const ICONS = {
  document: () => (
    <svg {...iconProps}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </svg>
  ),
  database: () => (
    <svg {...iconProps}>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </svg>
  ),
  code: () => (
    <svg {...iconProps}>
      <path d="m9 8-5 4 5 4M15 8l5 4-5 4" />
    </svg>
  ),
  share: () => (
    <svg {...iconProps}>
      <circle cx="17" cy="6" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="17" cy="18" r="2.6" />
      <path d="m8.4 10.8 6.2-3.4M8.4 13.2l6.2 3.4" />
    </svg>
  ),
};
