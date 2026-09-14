import { Outlet } from 'react-router-dom';

import { LanguageSwitcher, useT } from '../i18n/index.js';

/**
 * Shell for every unauthenticated and onboarding screen.
 *
 * The screenshots are phone mockups, so the column is capped near a phone width
 * and centred; on a desktop browser that reads as a centred card rather than a
 * stretched form.
 */
export const AuthLayout = () => (
  <div className="min-h-dvh bg-canvas">
    <div className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col px-6 pb-10 pt-6">
      <div className="flex justify-end">
        <LanguageSwitcher className="rounded-full border border-tint-200 bg-white px-3 py-1.5 text-sm font-semibold text-navy-700 hover:bg-tint-100" />
      </div>
      <Outlet />
    </div>
  </div>
);

/** Owl mascot. `variant` maps to the files in public/brand/. */
export const Owl = ({ variant = 'default', className = 'size-24' }) => {
  const t = useT();
  return (
    <img
      src={`/brand/reanmate-owl-logo-${variant}.png`}
      alt={t('common.owlAlt')}
      className={className}
    />
  );
};

/** Wordmark: bold "Rean" + regular "Mate", as drawn in the screenshots. */
export const Wordmark = ({ className = 'text-3xl' }) => (
  <p className={`font-bold tracking-tight text-navy-800 ${className}`}>
    Rean<span className="font-normal text-navy-600">Mate</span>
  </p>
);
