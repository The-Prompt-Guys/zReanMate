import bcrypt from 'bcrypt';

import { usersDb } from '../db/users.db.js';
import { authSessionsDb } from '../db/authSessions.db.js';
import { onboardingDb } from '../db/onboarding.db.js';
import { ApiError } from '../middleware/errors.js';
import { tokenService, hashToken } from './token.service.js';

const BCRYPT_ROUNDS = 12;

/**
 * Verification is deferred, not removed.
 *
 * No SMS or email provider is configured, so registration stamps
 * phone_verified_at / email_verified_at with the account's own creation time —
 * AUTO-VERIFIED PENDING PROVIDER SETUP. The columns, the verification_codes
 * table, and server/src/notify/ are all left in place; switching verification
 * on means stopping this stamp and adding requireVerified to the guard chain in
 * middleware/guards.js, with no schema change and no route rewrite.
 */
const autoVerifiedAt = () => new Date();

/** Digits and a leading +, spaces and dashes removed. Stored normalized so lookup is exact. */
const normalizePhone = (phone) => {
  if (!phone) return null;
  const trimmed = String(phone).replace(/[\s-().]/g, '');
  return trimmed.length ? trimmed : null;
};

const normalizeEmail = (email) => (email ? String(email).trim().toLowerCase() : null);

/** Strips password_hash before anything reaches a response body. */
const toPublicUser = (row) => {
  if (!row) return null;
  const { password_hash: _ignored, ...rest } = row;
  return rest;
};

const issueSession = async (user, { req, res }) => {
  const accessToken = tokenService.signAccessToken(user);
  const { token, tokenHash, expiresAt } = tokenService.createRefreshToken();

  await authSessionsDb.create({
    userId: user.id,
    tokenHash,
    userAgent: req.get('user-agent'),
    ipAddress: req.ip,
    expiresAt,
  });

  tokenService.setAuthCookies(res, {
    accessToken,
    refreshToken: token,
    refreshExpiresAt: expiresAt,
  });

  return toPublicUser(user);
};

export const authService = {
  async register({ fullName, email, phone, password, locale, role }, { req, res }) {
    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    // Enforced in the database too (users_needs_identifier, migration 002);
    // checked here so the caller gets a field-level message instead of a 500.
    if (!normalizedEmail && !normalizedPhone) {
      throw ApiError.badRequest('Provide an email address or a phone number', {
        fields: ['email', 'phone'],
      });
    }

    const taken = await usersDb.identifierTaken({
      email: normalizedEmail,
      phone: normalizedPhone,
    });
    if (taken.email) throw ApiError.conflict('That email is already registered', { field: 'email' });
    if (taken.phone) throw ApiError.conflict('That phone number is already registered', { field: 'phone' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let user;
    try {
      user = await usersDb.create({
        fullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        passwordHash,
        locale,
        role,
        verifiedAt: autoVerifiedAt(),
      });
    } catch (err) {
      // Two signups racing past the pre-check land here.
      if (err.code === '23505') {
        throw ApiError.conflict('That account already exists');
      }
      throw err;
    }

    return issueSession(user, { req, res });
  },

  async login({ identifier, password }, { req, res }) {
    const lookup = identifier.includes('@')
      ? normalizeEmail(identifier)
      : normalizePhone(identifier);

    const user = await usersDb.findForLogin(lookup);

    // Compare against a dummy hash when no user matched, so a missing account
    // and a wrong password take the same time and cannot be told apart.
    const hash = user?.password_hash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) {
      throw ApiError.unauthorized('Those credentials are not correct');
    }

    await usersDb.touchLastSeen(user.id);
    return issueSession(user, { req, res });
  },

  async logout({ req, res }) {
    const refreshToken = tokenService.readRefreshToken(req);
    if (refreshToken) {
      await authSessionsDb.revoke(hashToken(refreshToken));
    }
    tokenService.clearAuthCookies(res);
  },

  /** Rotates the refresh token on every use, so a stolen one is single-use. */
  async refresh({ req, res }) {
    const refreshToken = tokenService.readRefreshToken(req);
    if (!refreshToken) throw ApiError.unauthorized('No refresh token');

    const oldHash = hashToken(refreshToken);
    const session = await authSessionsDb.findActive(oldHash);
    if (!session) {
      tokenService.clearAuthCookies(res);
      throw ApiError.unauthorized('That session has expired');
    }

    const user = await usersDb.findById(session.user_id);
    if (!user || user.status !== 'active') {
      tokenService.clearAuthCookies(res);
      throw ApiError.unauthorized('That account is no longer active');
    }

    const next = tokenService.createRefreshToken();
    await authSessionsDb.rotate({
      oldTokenHash: oldHash,
      userId: user.id,
      tokenHash: next.tokenHash,
      userAgent: req.get('user-agent'),
      ipAddress: req.ip,
      expiresAt: next.expiresAt,
    });

    tokenService.setAuthCookies(res, {
      accessToken: tokenService.signAccessToken(user),
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    });

    return toPublicUser(user);
  },

  /** GET /api/me — the user plus whatever onboarding state the client needs to route on. */
  async me(userId) {
    const user = await usersDb.findById(userId);
    if (!user) throw ApiError.unauthorized('That account no longer exists');

    const survey = await onboardingDb.findByUserId(userId);

    return {
      user: toPublicUser(user),
      onboarding: {
        roleChosen: Boolean(user.role),
        surveyAnswers: survey?.answers ?? {},
        surveySkipped: survey?.skipped ?? false,
        completedAt: user.onboarding_completed_at,
      },
    };
  },
};
