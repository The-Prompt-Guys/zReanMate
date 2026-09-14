import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext.jsx';
import { isDemo } from '../mock/mode.js';
import { FullPageSpinner } from '../components/FullPageSpinner.jsx';

/**
 * Where a signed-in user belongs, given how far through onboarding they are.
 * One function so the guards and the post-signup redirect cannot disagree.
 */
export const onboardingDestination = ({ onboarding }) => {
  if (!onboarding.roleChosen) return '/onboarding/role';
  if (!onboarding.completedAt) return '/onboarding/survey/1';
  return '/';
};

/**
 * Resolved once: the auth flow either runs against the real session or it does
 * not, and that cannot change while the app is running.
 *
 * When the auth flow is live these guards enforce real redirects, which means
 * the flows still on fixtures need a real signed-in session to reach. Set
 * VITE_PROTOTYPE_AUTH=true to get URL-reachable screens back for design review.
 */
const DEMO = isDemo();

/**
 * Hooks run before any branch so the call order is identical on every render —
 * AUTH_PROTOTYPE is a build-time constant, but an early return above a hook is
 * still a rules-of-hooks violation and would break the moment it became dynamic.
 */

/** Blocks a route until the session is known, then requires one. */
export const RequireAuth = () => {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Prototype mode: every screen stays reachable by URL for review.
  if (DEMO) return <Outlet />;
  if (isLoading) return <FullPageSpinner />;

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
};

/** Keeps a signed-in user off the auth screens. */
export const RequireGuest = () => {
  const { isLoading, isAuthenticated, onboarding } = useAuth();

  if (DEMO) return <Outlet />;
  if (isLoading) return <FullPageSpinner />;
  if (isAuthenticated) return <Navigate to={onboardingDestination({ onboarding })} replace />;

  return <Outlet />;
};

/**
 * Guards the app proper: signed in AND finished onboarding. Someone who
 * abandoned onboarding lands back where they stopped rather than on a
 * dashboard with no role.
 */
export const RequireOnboarded = () => {
  const { onboarding } = useAuth();
  const destination = onboardingDestination({ onboarding });

  if (DEMO) return <Outlet />;
  if (destination !== '/') return <Navigate to={destination} replace />;

  return <Outlet />;
};
