import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.js';

/**
 * The bottom sheet used across the add-material flow — those screens are sheets
 * over the Kits tab, not separate pages, so the route behind them keeps
 * rendering.
 *
 * Dismissing navigates back to `closeTo` rather than toggling local state, so
 * the sheet has a real URL and the back button behaves.
 *
 * `dismissible={false}` drops the close button and the backdrop click for the
 * analyzing sheet, which the reference draws without either — there is nothing
 * to go back to mid-upload, and the sheet leaves on its own when work finishes.
 */
export const BottomSheet = ({
  children,
  closeTo = '/kits',
  labelledBy,
  transition = 'up',
  dismissible = true,
}) => {
  const t = useT();
  const navigate = useNavigate();
  const close = () => navigate(closeTo);

  // Escape closes, and the page behind must not scroll while the sheet is open.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape' && dismissible) close();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeTo, dismissible]);

  const sheetAnimation =
    transition === 'from-right'
      ? 'sheet-slide-from-right'
      : transition === 'to-left'
        ? 'sheet-slide-to-left'
        : 'sheet-slide-up';

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      {dismissible ? (
        <button
          type="button"
          aria-label={t('common.cancel')}
          onClick={close}
          className="sheet-backdrop-enter absolute inset-0 bg-navy-900/45"
        />
      ) : (
        <span aria-hidden="true" className="sheet-backdrop-enter absolute inset-0 bg-navy-900/45" />
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`${sheetAnimation} relative w-full max-w-[26rem] rounded-t-[1.75rem] bg-white px-5 pb-8 pt-3 shadow-2xl`}
      >
        <span className="mx-auto block h-1.5 w-12 rounded-full bg-mist-400" aria-hidden="true" />

        {dismissible && (
          <button
            type="button"
            onClick={close}
            aria-label={t('common.cancel')}
            className="absolute right-4 top-5 grid size-9 place-items-center rounded-full text-brand-600 transition-colors hover:bg-canvas"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        <div className="pt-6">{children}</div>
      </div>
    </div>
  );
};

/**
 * Sheet typography, on the same ramp as the dashboard: headings near-black,
 * secondary copy a true grey. Blue is left to carry the actions and the icons
 * rather than the words.
 */
/** `pe-10` keeps a long title clear of the close button in the same corner. */
export const SheetTitle = ({ id, children }) => (
  <h2 id={id} className="pe-10 text-2xl font-extrabold tracking-tight text-ink-900">
    {children}
  </h2>
);

export const SheetSubtitle = ({ children }) => (
  <p className="mt-1 text-lg font-medium leading-snug text-ink-600">{children}</p>
);

/** Centred small print under a sheet's action. */
export const SheetFootnote = ({ children, className = '' }) => (
  <p className={`mt-4 text-center text-base font-medium text-ink-600 ${className}`}>{children}</p>
);

/**
 * The header some sheets lead with instead of a plain title: the material
 * type's tile on the left, title and subtitle stacked beside it.
 */
export const SheetHeading = ({ id, tone = 'blue', icon, title, subtitle, trailing }) => (
  <div className="flex items-center gap-3.5">
    {icon && <SheetTile tone={tone}>{icon}</SheetTile>}
    <div className="min-w-0 flex-1">
      <SheetTitle id={id}>{title}</SheetTitle>
      {subtitle && <p className="mt-0.5 text-lg font-medium text-ink-600">{subtitle}</p>}
    </div>
    {trailing}
  </div>
);

const TONES = {
  blue: 'bg-tile-blue',
  violet: 'bg-tile-lilac',
  amber: 'bg-tile-peach',
  green: 'bg-tile-mint',
  grey: 'bg-tint-100',
};

/** The tinted rounded square that carries a material type's icon. */
export const SheetTile = ({ tone = 'blue', className = '', children }) => (
  <span
    className={`grid size-14 shrink-0 place-items-center rounded-2xl text-brand-600 ${TONES[tone] ?? TONES.blue} ${className}`}
  >
    {children}
  </span>
);

/** A tappable row inside a sheet — icon tile, title, subtitle, chevron. */
export const SheetOption = ({ to, onClick, tone = 'blue', icon, title, description }) => {
  const content = (
    <>
      <SheetTile tone={tone}>{icon}</SheetTile>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-lg font-extrabold text-ink-900">{title}</span>
        {description && (
          <span className="block text-base font-medium text-ink-600">{description}</span>
        )}
      </span>
      <svg viewBox="0 0 24 24" className="size-6 shrink-0 text-brand-600" fill="none" aria-hidden="true">
        <path d="m9.5 5 7 7-7 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );

  // White on the sheet's own white, told apart by its ring rather than a tint —
  // the same card treatment the dashboard uses.
  const className =
    'flex w-full items-center gap-4 rounded-2xl bg-white p-3.5 shadow-sm ring-1 ring-tint-200/70 transition-colors hover:bg-canvas';

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
};

/**
 * A sheet's text input: tinted fill, no visible border until focus, with room
 * for a leading icon. The label is visually hidden — every one of these sits
 * directly under a heading that already names it — but present for a reader.
 */
export const SheetField = ({ id, label, icon, className = '', ...props }) => (
  <div className={`relative ${className}`}>
    <label htmlFor={id} className="sr-only">
      {label}
    </label>
    {icon && (
      <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-brand-600">
        {icon}
      </span>
    )}
    <input
      id={id}
      className={`w-full rounded-2xl bg-white py-4 text-lg font-medium text-ink-900 ring-1 ring-tint-200 transition
        placeholder:font-medium placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-brand-600
        ${icon ? 'pl-14 pr-4' : 'px-4'}`}
      {...props}
    />
  </div>
);

/**
 * The full-width blue pill every sheet ends on.
 *
 * brand-600, not sky-600: the reference's buttons measure around #0255b8, a
 * step deeper than the #0177fd it uses for progress fills. Actions and progress
 * are deliberately different blues there, so they are here too.
 */
export const SheetButton = ({ className = '', children, ...props }) => (
  <button
    type="button"
    className={`w-full rounded-full bg-brand-600 px-6 py-4 text-lg font-extrabold text-white transition-colors
      hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-mist-400 ${className}`}
    {...props}
  >
    {children}
  </button>
);
