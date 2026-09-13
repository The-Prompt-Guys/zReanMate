import { tokenService } from '../services/token.service.js';
import { ApiError } from './errors.js';

/**
 * Rejects anything without a valid access-token cookie.
 *
 * Reads claims straight off the JWT — no database round trip on the common
 * path. A revoked session stops working when its short-lived access token
 * expires and the refresh is refused.
 */
export const requireAuth = (req, res, next) => {
  const token = tokenService.readAccessToken(req);
  if (!token) {
    return next(ApiError.unauthorized('Sign in to continue'));
  }

  const claims = tokenService.verifyAccessToken(token);
  if (!claims?.sub) {
    return next(ApiError.unauthorized('That session has expired'));
  }

  req.auth = {
    userId: claims.sub,
    role: claims.role ?? null,
    plan: claims.plan ?? 'free',
    phoneVerified: Boolean(claims.pv),
    emailVerified: Boolean(claims.ev),
  };

  return next();
};

/**
 * Requires a specific role. Unused this session — teacher-only routes arrive
 * with classes — but it belongs beside requireAuth.
 */
export const requireRole = (...roles) => (req, res, next) => {
  if (!req.auth) return next(ApiError.unauthorized('Sign in to continue'));
  if (!roles.includes(req.auth.role)) {
    return next(ApiError.forbidden('Your account cannot do that'));
  }
  return next();
};
