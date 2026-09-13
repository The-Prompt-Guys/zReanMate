import { createHash, randomBytes } from 'node:crypto';

import jwt from 'jsonwebtoken';

import { env, isProduction } from '../config/env.js';

/**
 * Two-token scheme, both delivered as httpOnly cookies:
 *
 *   access  — short-lived signed JWT. Carries the claims requireAuth needs, so
 *             the common path costs no database round trip.
 *   refresh — opaque random string. Only its SHA-256 hash is stored, in
 *             auth_sessions, which is what makes a session revocable.
 *
 * The refresh token is high-entropy random, so SHA-256 is the right hash here;
 * bcrypt exists to slow down guessing of low-entropy human passwords and would
 * only add latency to every refresh.
 */

export const ACCESS_COOKIE = 'rm_at';
export const REFRESH_COOKIE = 'rm_rt';

const REFRESH_BYTES = 32;

const baseCookie = {
  httpOnly: true,
  // 'lax' lets the cookie ride normal top-level navigations while still
  // blocking cross-site POSTs. The client and API share a site in production.
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
};

export const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export const tokenService = {
  signAccessToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        role: user.role ?? null,
        plan: user.plan_tier,
        // Carried so a later requireVerified can read it straight off the token.
        pv: Boolean(user.phone_verified_at),
        ev: Boolean(user.email_verified_at),
      },
      env.jwtSecret,
      { expiresIn: env.accessTokenTtl },
    );
  },

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, env.jwtSecret);
    } catch {
      return null;
    }
  },

  createRefreshToken() {
    const token = randomBytes(REFRESH_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    return { token, tokenHash: hashToken(token), expiresAt };
  },

  setAuthCookies(res, { accessToken, refreshToken, refreshExpiresAt }) {
    res.cookie(ACCESS_COOKIE, accessToken, {
      ...baseCookie,
      // Deliberately shorter than the JWT's own exp so a browser-held cookie
      // never outlives the token inside it.
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(REFRESH_COOKIE, refreshToken, {
      ...baseCookie,
      expires: refreshExpiresAt,
    });
  },

  clearAuthCookies(res) {
    // Options must match those used to set them or the browser keeps the cookie.
    res.clearCookie(ACCESS_COOKIE, baseCookie);
    res.clearCookie(REFRESH_COOKIE, baseCookie);
  },

  readAccessToken(req) {
    return req.cookies?.[ACCESS_COOKIE] ?? null;
  },

  readRefreshToken(req) {
    return req.cookies?.[REFRESH_COOKIE] ?? null;
  },
};
