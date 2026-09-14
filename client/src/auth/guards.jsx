import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext.jsx';
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

/** Blocks a route until the session is known, then requires one. */
export const RequireAuth = () => {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

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

  if (destination !== '/') return <Navigate to={destination} replace />;

  return <Outlet />;
};
