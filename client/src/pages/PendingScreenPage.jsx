import { Link, useLocation } from 'react-router-dom';

import { FLOWS } from '../screens.js';
import { Owl } from '../layouts/AuthLayout.jsx';

/**
 * Stands in for a screen that has a route but is not built yet.
 *
 * It names the exact screenshot it will implement, so the prototype never
 * pretends a screen exists — an empty page that looks finished is the thing to
 * avoid when the whole point is reviewing what is and is not done.
 */
export const PendingScreenPage = () => {
  const { pathname } = useLocation();

  const match = FLOWS.flatMap((flow) =>
    flow.screens.map((screen) => ({ ...screen, flowId: flow.id, flowLabel: flow.label })),
  ).find((screen) => screen.route?.split('?')[0] === pathname);

  return (
    <main className="flex min-h-[70dvh] flex-col items-center justify-center gap-4 px-8 text-center">
      <Owl variant="reading" className="size-24 opacity-90" />
      <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
        {match?.flowLabel ?? 'Screen'}
      </p>
      <h1 className="text-xl font-bold text-navy-900">{match?.name ?? pathname}</h1>
      <p className="text-sm text-ink-500">Not built yet.</p>
      {match && (
        <code className="rounded-field bg-white px-3 py-2 text-xs text-ink-500 ring-1 ring-tint-200">
          docs/screens/{match.flowId}/{match.shot}.png
        </code>
      )}
      <Link to="/screens" className="mt-2 text-sm font-semibold text-navy-700 underline">
        Back to screen index
      </Link>
    </main>
  );
};
