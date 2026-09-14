import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.js';

/**
 * The bottom sheet used across docs/screens/03-study-kits/02, 04, 05 and 06 —
 * those screens are sheets over the Kits tab, not separate pages, so the route
 * behind them keeps rendering.
 *
 * Dismissing navigates back to `closeTo` rather than toggling local state, so
 * the sheet has a real URL and the back button behaves.
 */
export const BottomSheet = ({ children, closeTo = '/kits', labelledBy, transition = 'up' }) => {
  const t = useT();
  const navigate = useNavigate();
  const close = () => navigate(closeTo);

  // Escape closes, and the page behind must not scroll while the sheet is open.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeTo]);

  const sheetAnimation =
    transition === 'from-right'
      ? 'sheet-slide-from-right'
      : transition === 'to-left'
        ? 'sheet-slide-to-left'
        : 'sheet-slide-up';

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        type="button"
        aria-label={t('common.cancel')}
        onClick={close}
        className="sheet-backdrop-enter absolute inset-0 bg-navy-900/45"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`${sheetAnimation} relative w-full max-w-[26rem] rounded-t-[1.75rem] bg-white px-6 pb-8 pt-3 shadow-2xl`}
      >
        <span className="mx-auto block h-1.5 w-12 rounded-full bg-tint-200" aria-hidden="true" />

        <button
          type="button"
          onClick={close}
          aria-label={t('common.cancel')}
          className="absolute right-5 top-5 grid size-8 place-items-center rounded-full text-navy-700 hover:bg-tint-100"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
};

/** A tappable row inside a sheet — icon tile, title, subtitle, chevron. */
export const SheetOption = ({ to, onClick, tone = 'blue', icon, title, description }) => {
  const TONES = {
    blue: 'bg-tint-200 text-navy-800',
    violet: 'bg-violet-100 text-violet-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-emerald-100 text-emerald-700',
  };

  const content = (
    <>
      <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${TONES[tone]}`}>{icon}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-lg font-bold text-navy-900">{title}</span>
        <span className="block text-sm text-navy-600">{description}</span>
      </span>
      <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-navy-700" fill="none" aria-hidden="true">
        <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );

  const className =
    'flex w-full items-center gap-4 rounded-card bg-canvas/70 p-3.5 transition-colors hover:bg-tint-100';

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
