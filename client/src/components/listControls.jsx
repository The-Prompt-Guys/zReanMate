import { useId } from 'react';

/** Shared search + filter controls for the Kits and Classes lists. */

export const SearchField = ({ value, onChange, placeholder, label }) => {
  const id = useId();
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <span className="pointer-events-none absolute inset-y-0 left-4 grid place-items-center text-navy-700">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m16.5 16.5 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </span>
      <input
        id={id}
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-full bg-tint-100 py-3.5 pl-12 pr-4 text-base text-navy-900 placeholder:text-navy-600/60 focus:outline-none focus:ring-2 focus:ring-navy-700/25"
      />
    </div>
  );
};

/** Underlined tab row — All / In progress / Completed. */
export const FilterTabs = ({ value, onChange, options }) => (
  <div role="tablist" className="flex gap-5 border-b border-tint-200">
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          role="tab"
          type="button"
          aria-selected={active}
          onClick={() => onChange(option.value)}
          className={`-mb-px border-b-2 pb-2.5 text-base font-semibold transition-colors ${
            active ? 'border-navy-800 text-navy-900' : 'border-transparent text-navy-600/70'
          }`}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);

/** Pill-shaped dropdown trigger used on the kit file list. */
export const PillSelect = ({ label, active = false }) => (
  <button
    type="button"
    className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-base font-semibold ${
      active ? 'bg-tint-200 text-navy-900' : 'bg-tint-100 text-navy-700'
    }`}
  >
    {label}
    <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
);
