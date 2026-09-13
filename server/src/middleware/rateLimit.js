import { ApiError } from './errors.js';

/**
 * Fixed-window rate limiting, held in process memory.
 *
 * CLAUDE.md rules out Redis, and 001_init has no counter table, so this is
 * per-process state. That is correct for the dev server and for a single API
 * instance; behind more than one instance each process would keep its own
 * counts and the effective limit multiplies. Moving the buckets into Postgres
 * (a small table keyed by bucket + window start, swept like verification_codes)
 * is the fix when deployment needs it.
 */

const buckets = new Map();

// Bounded so a flood of unique keys cannot grow the map without limit.
const MAX_BUCKETS = 10_000;

const sweep = (now) => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

const hit = (key, windowMs, now) => {
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) sweep(now);
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  return bucket;
};

/**
 * @param {object}   options
 * @param {number}   options.windowMs
 * @param {number}   options.max        Attempts allowed per window.
 * @param {Function} options.keyFrom    req -> string | null. null skips the check.
 * @param {string}   options.scope      Namespaces the key so two limiters never collide.
 */
export const rateLimit = ({ windowMs, max, keyFrom, scope }) => (req, res, next) => {
  const raw = keyFrom(req);
  if (!raw) return next();

  const now = Date.now();
  const key = `${scope}:${raw}`;
  const bucket = hit(key, windowMs, now);

  const remaining = Math.max(0, max - bucket.count);
  res.set('RateLimit-Limit', String(max));
  res.set('RateLimit-Remaining', String(remaining));
  res.set('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

  if (bucket.count > max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.set('Retry-After', String(retryAfter));
    return next(
      ApiError.tooManyRequests(`Too many attempts. Try again in ${retryAfter} seconds.`),
    );
  }

  // Lets a controller undo the attempt it just counted — successful logins
  // should not push a legitimate user toward the limit.
  const priorReset = req.clearRateLimit;
  req.clearRateLimit = () => {
    priorReset?.();
    buckets.delete(key);
  };

  return next();
};

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Per identifier: stops someone grinding passwords against one account, even
 * from many addresses.
 */
export const loginRateLimitByIdentifier = rateLimit({
  scope: 'login:id',
  windowMs: FIFTEEN_MINUTES,
  max: 5,
  keyFrom: (req) => {
    const identifier = req.body?.identifier;
    return typeof identifier === 'string' ? identifier.trim().toLowerCase() : null;
  },
});

/**
 * Per IP, set higher: stops one host spraying many accounts, while leaving room
 * for a shared connection (a school or an internet cafe) where several students
 * legitimately sign in from one address.
 */
export const loginRateLimitByIp = rateLimit({
  scope: 'login:ip',
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  keyFrom: (req) => req.ip ?? null,
});

/** Registration is cheap to abuse too — bcrypt at 12 rounds is not free. */
export const registerRateLimitByIp = rateLimit({
  scope: 'register:ip',
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyFrom: (req) => req.ip ?? null,
});

/** Test seam. */
export const resetRateLimits = () => buckets.clear();
