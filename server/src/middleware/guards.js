import { requireAuth } from './requireAuth.js';

/**
 * The guard chain every authenticated route spreads, instead of naming
 * requireAuth directly:
 *
 *   router.get('/me', ...authenticated, meController.show);
 *
 * That indirection is the whole point. Verification is deferred, not removed —
 * when an SMS/email provider is configured, `requireVerified` gets written and
 * added to this one array, and every protected route picks it up with no route
 * file touched. requireAuth already puts `phoneVerified` / `emailVerified` on
 * req.auth, so that middleware needs no new plumbing either.
 *
 *   export const authenticated = [requireAuth, requireVerified];
 */
export const authenticated = [requireAuth];
