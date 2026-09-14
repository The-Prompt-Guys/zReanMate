import { useId, useState } from 'react';

import { useT } from '../i18n/index.js';

/**
 * Shared primitives for the auth and onboarding flow. Sizes and radii come from
 * docs/screens/01-auth-onboarding/ — pill buttons, 16px-radius cards, generous
 * vertical rhythm.
 */

const cx = (...parts) => parts.filter(Boolean).join(' ');

/** Full-width pill button, navy fill by default. */
export const Button = ({ variant = 'primary', className, children, ...props }) => {
  const variants = {
    primary:
      'bg-navy-800 text-white hover:bg-navy-900 active:bg-navy-900 disabled:bg-ink-400 disabled:cursor-not-allowed',
    secondary: 'bg-white text-navy-800 border border-tint-200 hover:bg-tint-100',
    ghost: 'bg-transparent text-navy-700 hover:bg-tint-100',
  };

  return (
    <button
      className={cx(
        'inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-4',
        'text-base font-semibold transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
};

/** Text button used for "Skip" and "I'll choose later". */
export const TextButton = ({ className, children, ...props }) => (
  <button
    type="button"
    className={cx('font-semibold text-navy-700 hover:text-navy-900', className)}
    {...props}
  >
    {children}
  </button>
);

/**
 * Labelled input. `error` renders the message and wires aria-describedby, so a
 * 422 from the server is announced rather than silently styling the border red.
 */
export const TextField = ({ label, error, hint, type = 'text', className, ...props }) => {
  const id = useId();
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);
  const t = useT();

  const isPassword = type === 'password';
  const inputType = isPassword && revealed ? 'text' : type;

  return (
    <div className={cx('space-y-2', className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={inputType}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cx(
            'w-full rounded-field border bg-white px-4 py-3.5 text-base text-navy-900',
            'placeholder:text-ink-400 focus:outline-none focus:ring-2',
            isPassword && 'pr-12',
            error
              ? 'border-danger-600 focus:ring-danger-600/30'
              : 'border-tint-200 focus:border-navy-700 focus:ring-navy-700/20',
          )}
          {...props}
        />

        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={t(revealed ? 'auth.hidePassword' : 'auth.showPassword')}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-500 hover:text-navy-700"
          >
            <EyeIcon open={revealed} />
          </button>
        )}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="text-sm font-medium text-danger-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
};

/**
 * A selectable card — the survey options and the Student/Teacher choice.
 * Rendered as a radio so arrow keys work and screen readers announce the group.
 */
export const OptionCard = ({ name, value, checked, onChange, icon, title, description }) => (
  <label
    className={cx(
      'flex cursor-pointer items-center gap-4 rounded-card border p-4 transition-colors',
      checked
        ? 'border-navy-700 bg-tint-100'
        : 'border-tint-200 bg-white hover:border-navy-600/40',
    )}
  >
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={() => onChange(value)}
      className="sr-only"
    />

    {icon && <span className="shrink-0 text-navy-800">{icon}</span>}

    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-navy-900">{title}</span>
      {description && <span className="mt-0.5 block text-sm text-ink-500">{description}</span>}
    </span>

    <span
      aria-hidden="true"
      className={cx(
        'grid size-6 shrink-0 place-items-center rounded-full border-2',
        checked ? 'border-navy-800 bg-navy-800' : 'border-ink-400',
      )}
    >
      {checked && <CheckIcon />}
    </span>
  </label>
);

/** Numbered 1—2—3 progress used across the survey steps. */
export const StepIndicator = ({ current, total }) => {
  const t = useT();
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-center" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const step = i + 1;
          return (
            <div key={step} className="flex items-center">
              <span
                className={cx(
                  'grid size-8 place-items-center rounded-full text-sm font-bold',
                  step <= current ? 'bg-navy-800 text-white' : 'bg-tint-200 text-white',
                )}
              >
                {step}
              </span>
              {step < total && <span className="h-px w-14 bg-tint-200 sm:w-20" />}
            </div>
          );
        })}
      </div>
      <p className="text-center text-sm text-ink-500">
        {t('onboarding.step', { current, total })}
      </p>
    </div>
  );
};

/** Segmented bar variant used on the role and plan screens. */
export const SegmentedProgress = ({ current, total, label }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-center gap-2" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cx('h-1.5 w-10 rounded-full', i < current ? 'bg-navy-800' : 'bg-tint-200')}
        />
      ))}
    </div>
    {label && <p className="text-center text-sm text-ink-500">{label}</p>}
  </div>
);

/** Server-level failure that is not tied to one field. */
export const FormAlert = ({ children }) =>
  children ? (
    <p role="alert" className="rounded-field bg-danger-50 px-4 py-3 text-sm font-medium text-danger-600">
      {children}
    </p>
  ) : null;

export const CheckIcon = ({ className = 'size-3.5 text-white' }) => (
  <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
    <path d="M4 10.5 8 14.5 16 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const EyeIcon = ({ open }) => (
  <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
    <path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    {!open && <path d="M4 20 20 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
  </svg>
);

export const ArrowRightIcon = ({ className = 'size-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
