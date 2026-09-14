/**
 * Prototype mode.
 *
 * The backend is on hold, so the client runs standalone: no /api calls, a
 * fixture user, and guards that never redirect — every screen is directly
 * reachable by URL so the whole design can be reviewed in one pass.
 *
 * This is a switch, not a rewrite. The axios instance, AuthContext actions and
 * route guards are all still here and still correct; prototype mode short-
 * circuits them. Set VITE_PROTOTYPE=false to run against a live API again.
 */
export const PROTOTYPE = import.meta.env.VITE_PROTOTYPE !== 'false';

/** Simulates network latency so loading states are visible in the prototype. */
export const settle = (value, ms = 220) =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));
