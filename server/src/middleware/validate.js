/**
 * Runs a zod schema against the request before the controller sees it
 * (CLAUDE.md: every endpoint validates its body with zod before doing anything
 * else). The parsed — and therefore coerced and trimmed — result replaces the
 * raw input, so controllers never read req.body directly.
 *
 * A ZodError thrown here is rendered as a 422 by the central error handler.
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  return next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) return next(result.error);
  req.validatedQuery = result.data;
  return next();
};

export const validateParams = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) return next(result.error);
  req.validatedParams = result.data;
  return next();
};
