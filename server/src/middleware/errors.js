import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';

/**
 * Error with an HTTP status attached. Services and controllers throw these;
 * the handler below turns them into a JSON response.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, 'bad_request', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'unauthorized', message);
  }

  static forbidden(message = 'Not allowed') {
    return new ApiError(403, 'forbidden', message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'not_found', message);
  }

  static conflict(message, details) {
    return new ApiError(409, 'conflict', message, details);
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, 'too_many_requests', message);
  }
}

export const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
};

/**
 * Centralized error handler. Must stay last in the middleware chain, and must
 * keep all four arguments — Express detects error handlers by arity.
 *
 * Response shape is always { error: { code, message, details? } } so the client
 * can map `code` to an i18n key rather than showing a server string.
 */
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: {
        code: 'validation_failed',
        message: 'Request validation failed',
        details: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
          message: issue.message,
        })),
      },
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details && { details: err.details }) },
    });
  }

  // Body-parser rejects oversized or malformed JSON with a status already set.
  if (err.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'payload_too_large', message: 'Request body is too large' } });
  }
  if (err.type === 'entity.parse.failed') {
    return res
      .status(400)
      .json({ error: { code: 'invalid_json', message: 'Request body is not valid JSON' } });
  }

  console.error('[error]', err);

  return res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong',
      ...(isProduction ? {} : { details: err.message }),
    },
  });
};

/**
 * Express 5 already forwards rejected promises from async handlers to the
 * error handler, so this is only for routes that hand work to a callback API.
 */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
