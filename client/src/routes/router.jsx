import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RequireAuth, RequireGuest, RequireOnboarded } from '../auth/guards.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthPage } from '../pages/AuthPage.jsx';
import { RoleSelectionPage } from '../pages/RoleSelectionPage.jsx';
import { SurveyPage } from '../pages/SurveyPage.jsx';
import { PlanPage } from '../pages/PlanPage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { ScreenIndexPage } from '../pages/ScreenIndexPage.jsx';
import { PendingScreenPage } from '../pages/PendingScreenPage.jsx';
import { FLOWS } from '../screens.js';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

/**
 * Routes for registry entries that have a path but no page yet. Built screens
 * are declared explicitly in the tree below, which is matched first, so a
 * built screen always wins over its pending entry.
 */
const pendingRoutes = FLOWS.flatMap((flow) => flow.screens)
  .filter((screen) => !screen.built && screen.route)
  .map((screen) => ({ path: screen.route.split('?')[0], element: <PendingScreenPage /> }));

/**
 * Three zones, each behind its own guard:
 *
 *   RequireGuest     — signed-out only.
 *   RequireAuth      — signed in; onboarding may still be unfinished.
 *   RequireOnboarded — signed in AND finished; the app proper.
 *
 * In prototype mode every guard passes through, so all screens are reachable
 * by URL — see src/mock/mode.js and the index at /screens.
 *
 * The OTP and email-code screens from docs/screens/01-auth-onboarding/02 and 03
 * are deliberately absent: no SMS or email provider exists. The screenshots
 * stay in docs/.
 */
export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        element: <RequireGuest />,
        children: [{ path: '/auth', element: <AuthPage /> }],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/onboarding/role', element: <RoleSelectionPage /> },
          { path: '/onboarding/survey/:step', element: <SurveyPage /> },
          { path: '/onboarding/survey', element: <Navigate to="/onboarding/survey/1" replace /> },
          { path: '/onboarding/plan', element: <PlanPage /> },
        ],
      },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <RequireOnboarded />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { path: '/', element: <DashboardPage /> },
              // Every registered screen that is not built yet still resolves,
              // so the tab bar and the index never dead-end on a 404.
              ...pendingRoutes,
            ],
          },
        ],
      },
    ],
  },

  // Prototype-only review tool, outside every guard and layout.
  { path: '/screens', element: <ScreenIndexPage /> },

  { path: '*', element: <NotFoundPage /> },
]);
