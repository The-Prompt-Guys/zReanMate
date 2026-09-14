import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, CheckIcon, SegmentedProgress, TextButton } from '../components/ui.jsx';
import { Owl, Wordmark } from '../layouts/AuthLayout.jsx';
import { useT } from '../i18n/index.js';
import { LIMIT_LABELS, useProfile } from '../profile/useProfile.js';

/**
 * docs/screens/01-auth-onboarding/08-free-vs-plus-comparison.
 *
 * No billing provider is configured, so neither button charges anything. Both
 * finish onboarding and land on the dashboard; the trial CTA is marked as not
 * yet available rather than pretending to start a subscription.
 */
const FREE_FEATURES = ['plan.freeKits', 'plan.freeSummaries', 'plan.freePractice', 'plan.freeProgress'];
const PLUS_FEATURES = [
  'plan.plusKits',
  'plan.plusAi',
  'plan.plusWeakTopics',
  'plan.plusAdaptive',
  'plan.plusGenerate',
];

export const PlanPage = () => {
  const t = useT();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(null);
  const { limits } = useProfile();
  // The free kit count is a plan_limits row, not copy — reading it here keeps
  // the feature list from drifting from what the server actually enforces.
  const freeKitLimit = limits?.plans?.free?.limits?.max_kits;

  const finish = () => navigate('/', { replace: true });

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex items-start justify-between pt-2">
        <div className="flex-1">
          <SegmentedProgress current={3} total={3} label={t('onboarding.step', { current: 3, total: 3 })} />
        </div>
        <TextButton onClick={finish} className="ml-4 shrink-0">
          {t('common.maybeLater')}
        </TextButton>
      </div>

      <header className="mt-5 flex flex-col items-center text-center">
        <Owl variant="default" className="size-24" />
        <Wordmark className="mt-1 text-3xl" />
        <h1 className="mt-3 text-2xl font-bold leading-tight text-navy-900">
          {t('plan.chooseTitle')}
        </h1>
        <p className="mt-2 text-base text-ink-500">{t('plan.chooseSubtitle')}</p>
      </header>

      {/* Free */}
      <section className="mt-6 rounded-card border border-tint-200 bg-tint-100/60 p-5">
        <h2 className="text-xl font-bold text-navy-900">{t('plan.free')}</h2>
        <p className="text-base text-ink-500">{t('plan.freePrice')}</p>
        <ul className="mt-4 space-y-3">
          {FREE_FEATURES.map((key) => (
            <FeatureRow
              key={key}
              label={key === 'plan.freeKits' ? t(key, { count: freeKitLimit ?? 3 }) : t(key)}
            />
          ))}
          {limits?.plans?.free && <PlanNumbers plan={limits.plans.free} />}
        </ul>
      </section>

      {/* Plus */}
      <section className="mt-5 overflow-hidden rounded-card border border-navy-800">
        <div className="flex items-start justify-between gap-3 bg-navy-800 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-white">{t('plan.plus')}</h2>
            <p className="text-base text-white/80">{t('plan.plusPrice')}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold-400 px-3 py-1.5 text-xs font-bold text-navy-900">
            <StarIcon />
            {t('plan.plusTrialBadge')}
          </span>
        </div>
        <ul className="space-y-3 bg-white px-5 py-5">
          {PLUS_FEATURES.map((key) => (
            <FeatureRow key={key} label={t(key)} />
          ))}
          {limits?.plans?.plus && <PlanNumbers plan={limits.plans.plus} />}
        </ul>
      </section>

      <div className="mt-6 space-y-3 pb-2">
        {notice && (
          <p role="status" className="rounded-field bg-tint-100 px-4 py-3 text-center text-sm text-navy-800">
            {notice}
          </p>
        )}
        <Button onClick={() => setNotice(t('plan.billingUnavailable'))}>
          {t('plan.startTrial')}
        </Button>
        <div className="text-center">
          <TextButton onClick={finish}>{t('plan.continueFree')}</TextButton>
        </div>
        <p className="text-center text-xs text-ink-400">{t('plan.trialFootnote')}</p>
      </div>
    </main>
  );
};

const PlanNumbers = ({ plan }) => {
  const t = useT();
  const rows = Object.entries(plan.limits).filter(([key]) => LIMIT_LABELS[key]);
  if (rows.length === 0) return null;

  return (
    <li className="mt-3 rounded-xl bg-tint-100 px-3 py-2 text-sm text-navy-700">
      {rows.map(([key, value]) => (
        <span key={key} className="mr-3 inline-block">
          {t(LIMIT_LABELS[key])}: <strong>{value ?? t('plan.unlimited')}</strong>
        </span>
      ))}
    </li>
  );
};

const FeatureRow = ({ label }) => (
  <li className="flex items-center gap-3">
    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-tint-200 text-navy-800">
      <CheckIcon className="size-4 text-navy-800" />
    </span>
    <span className="text-base text-navy-900">{label}</span>
  </li>
);

const StarIcon = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
    <path d="m10 1.8 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L2.2 7.5l5.4-.8L10 1.8Z" />
  </svg>
);
