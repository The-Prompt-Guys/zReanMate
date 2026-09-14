import { createBrowserRouter, Navigate } from 'react-router-dom';

import { RequireAuth, RequireGuest, RequireOnboarded } from '../auth/guards.jsx';
import { AuthLayout } from '../layouts/AuthLayout.jsx';
import { AppLayout } from '../layouts/AppLayout.jsx';
import { AuthPage } from '../pages/AuthPage.jsx';
import { RoleSelectionPage } from '../pages/RoleSelectionPage.jsx';
import { SurveyPage } from '../pages/SurveyPage.jsx';
import { PlanPage } from '../pages/PlanPage.jsx';
import { DashboardPlaceholder } from '../pages/DashboardPlaceholder.jsx';
import { NotFoundPage } from '../pages/NotFoundPage.jsx';

/**
 * Three zones, each behind its own guard:
 *
 *   RequireGuest     — signed-out only; a signed-in user is bounced to wherever
 *                      they left off in onboarding.
 *   RequireAuth      — signed in; onboarding may still be unfinished.
 *   RequireOnboarded — signed in AND finished; the app proper.
 *
 * The OTP and email-code screens from docs/screens/01-auth-onboarding/02 and 03
 * are deliberately absent: no SMS or email provider exists, so registration
 * goes straight from signup to role selection. The screenshots stay in docs/.
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
            children: [{ path: '/', element: <DashboardPlaceholder /> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
