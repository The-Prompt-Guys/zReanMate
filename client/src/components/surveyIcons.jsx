/**
 * Line icons for the survey options, traced from
 * docs/screens/01-auth-onboarding/05, 06 and 07. Inline SVG so there is no
 * sprite to load and they inherit the navy from the option card.
 */
const base = {
  viewBox: '0 0 44 44',
  fill: 'none',
  className: 'size-10',
  'aria-hidden': 'true',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const BrainIcon = () => (
  <svg {...base}>
    <path d="M18 10a5 5 0 0 0-5 5 4 4 0 0 0-2 7 4.5 4.5 0 0 0 3 7 5 5 0 0 0 9 1V12a4 4 0 0 0-5-2Z" />
    <path d="M26 10a5 5 0 0 1 5 5 4 4 0 0 1 2 7 4.5 4.5 0 0 1-3 7 5 5 0 0 1-9 1" />
    <path d="M8 8 6 6M36 8l2-2M6 22H3M41 22h-3" />
  </svg>
);

export const RecallIcon = () => (
  <svg {...base}>
    <path d="M26 36H14a3 3 0 0 1-3-3v-6a12 12 0 1 1 21-8" />
    <path d="M23 20a4 4 0 1 1 4 4v3" />
    <path d="M27 32v.5" />
  </svg>
);

export const ExamIcon = () => (
  <svg {...base}>
    <path d="M12 5h13l8 8v26H12z" />
    <path d="M25 5v8h8" />
    <path d="M17 22h10M17 28h7" />
  </svg>
);

export const CalendarClockIcon = () => (
  <svg {...base}>
    <rect x="6" y="9" width="32" height="29" rx="3" />
    <path d="M6 17h32M14 5v8M30 5v8" />
    <circle cx="29" cy="29" r="6" />
    <path d="M29 26v3l2 2" />
  </svg>
);

export const CalendarWeekIcon = () => (
  <svg {...base}>
    <rect x="6" y="9" width="32" height="29" rx="3" />
    <path d="M6 17h32M14 5v8M30 5v8" />
    <path d="m13 24 2 2 4-4M13 31l2 2 4-4M25 25h6M25 32h6" />
  </svg>
);

export const CalendarCheckIcon = () => (
  <svg {...base}>
    <rect x="6" y="9" width="32" height="29" rx="3" />
    <path d="M6 17h32M14 5v8M30 5v8" />
    <path d="m16 27 4 4 9-9" />
  </svg>
);

export const StopwatchIcon = () => (
  <svg {...base}>
    <circle cx="24" cy="25" r="13" />
    <path d="M24 18v7l5 3M20 6h8M24 6v6" />
    <path d="M7 20H3M8 27H4" />
  </svg>
);

export const OpenBookIcon = () => (
  <svg {...base}>
    <path d="M22 14v22M22 14c-3-3-8-4-14-4v22c6 0 11 1 14 4 3-3 8-4 14-4V10c-6 0-11 1-14 4Z" />
    <path d="M20 4v3M24 4v3" />
  </svg>
);

export const MixedIcon = () => (
  <svg {...base}>
    <circle cx="24" cy="24" r="11" strokeDasharray="4 4" />
    <path d="M24 18v6l4 2" />
    <path d="M16 8a16 16 0 0 1 16 0M32 40a16 16 0 0 1-16 0" />
  </svg>
);

export const UnsureIcon = () => (
  <svg {...base}>
    <path d="M26 36H14a3 3 0 0 1-3-3v-6a12 12 0 1 1 21-8" />
    <path d="M20 20a4 4 0 1 1 4 4v2" />
    <path d="M24 31v.5" />
  </svg>
);
