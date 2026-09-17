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
export const Owl = ({ variant = 'default', className = 'size-24', alt }) => {
  const t = useT();
  return (
    <img
      src={`/brand/reanmate-owl-logo-${variant}.png`}
      alt={alt ?? t('common.owlAlt')}
      className={className}
    />
  );
};

/** Wordmark: bold "Rean" + regular "Mate", as drawn in the screenshots. */
export const Wordmark = ({ className = 'text-3xl', light = false }) => (
  <p className={`font-bold tracking-tight ${light ? 'text-white' : 'text-navy-800'} ${className}`}>
    Rean<span className={light ? 'font-normal text-white/85' : 'font-normal text-navy-600'}>Mate</span>
  </p>
);

/** Supplied ReanMate Learning Platform brand artwork — full logo, not cropped. */
export const BrandLogo = ({ className = 'h-12 max-w-[12rem]' }) => {
  const t = useT();
  return (
    <img
      src="/brand/reanmate-brand.png"
      alt={t('common.appName')}
      className={`w-auto object-contain object-left ${className}`}
    />
  );
};

/**
 * The header lockup: open-book mark, wordmark, tagline stacked under it.
 *
 * The wordmark and tagline are live text rather than part of the artwork so the
 * tagline can translate — the supplied lockup PNG bakes in English. The mark
 * ships alpha-keyed off its white studio background so it sits on the navy hero.
 */
export const BrandLockup = ({ className = '' }) => {
  const t = useT();
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/brand/reanmate-logo-open-book.png"
        alt=""
        aria-hidden="true"
        className="size-10 shrink-0 object-contain"
      />
      <div className="min-w-0">
        <p className="text-xl font-extrabold leading-none tracking-tight text-white">
          Rean<span className="text-gold-300">Mate</span>
        </p>
        <p className="mt-1 text-xs font-medium leading-tight text-white/80">
          {t('common.brandTagline')}
        </p>
      </div>
    </div>
  );
};
