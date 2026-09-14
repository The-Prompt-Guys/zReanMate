import { Link } from 'react-router-dom';

import { FLOWS, screenCounts } from '../screens.js';
import { Wordmark } from '../layouts/AuthLayout.jsx';

/**
 * Prototype-only index of every screen in docs/screens/, so the whole design
 * can be walked in one pass without guessing URLs.
 *
 * Not part of the product: it is not in the tab bar and it carries no i18n,
 * because it is a development tool, not a user-facing screen.
 */
export const ScreenIndexPage = () => {
  const { total, built, skipped } = screenCounts();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Wordmark className="text-3xl" />
      <h1 className="mt-2 text-2xl font-bold text-navy-900">Screen index</h1>
      <p className="mt-1 text-sm text-ink-500">
        {built} of {total} built · {skipped} intentionally skipped (no provider configured)
      </p>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-tint-200">
        <span className="block h-full rounded-full bg-navy-800" style={{ width: `${(built / total) * 100}%` }} />
      </div>

      <div className="mt-8 space-y-8">
        {FLOWS.map((flow) => (
          <section key={flow.id}>
            <h2 className="text-lg font-bold text-navy-900">{flow.label}</h2>
            <p className="text-xs text-ink-400">docs/screens/{flow.id}/</p>

            <ul className="mt-3 divide-y divide-tint-200 overflow-hidden rounded-card bg-white ring-1 ring-tint-200">
              {flow.screens.map((screen) => (
                <li key={screen.shot}>
                  {screen.built && screen.route ? (
                    <Link
                      to={screen.route}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-tint-100"
                    >
                      <Dot tone="built" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-navy-900">{screen.name}</span>
                        <span className="block truncate text-xs text-ink-400">{screen.route}</span>
                      </span>
                      <span className="text-xs font-semibold text-navy-700">Open</span>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3 opacity-70">
                      <Dot tone={screen.skipped ? 'skipped' : 'pending'} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-navy-900">{screen.name}</span>
                        <span className="block truncate text-xs text-ink-400">
                          {screen.skipped ?? 'not built yet'}
                        </span>
                      </span>
                      <span className="text-xs text-ink-400">
                        {screen.skipped ? 'Skipped' : 'Pending'}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
};

const TONES = {
  built: 'bg-navy-800',
  pending: 'bg-ink-400',
  skipped: 'bg-gold-500',
};

const Dot = ({ tone }) => (
  <span className={`size-2.5 shrink-0 rounded-full ${TONES[tone]}`} aria-hidden="true" />
);
