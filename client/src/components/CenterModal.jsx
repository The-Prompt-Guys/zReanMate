import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { useT } from '../i18n/index.js';

/**
 * Centered dialog, as used by docs/screens/04-study-mode-summaries/01 — the
 * study-mode chooser sits in the middle of the screen rather than rising from
 * the bottom like the sheets in 03-study-kits.
 */
export const CenterModal = ({ children, closeTo = '/', labelledBy }) => {
  const t = useT();
  const navigate = useNavigate();
  const close = () => navigate(closeTo);

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

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-5">
      <button
        type="button"
        aria-label={t('common.cancel')}
        onClick={close}
        className="absolute inset-0 bg-navy-900/45"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="relative w-full max-w-[23rem] rounded-[1.5rem] bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t('common.cancel')}
          className="absolute right-4 top-4 grid size-9 place-items-center rounded-full text-navy-700 hover:bg-tint-100"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  );
};
