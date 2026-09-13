import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

export const createApp = () => {
  const app = express();

  // Behind a proxy in production so secure cookies and req.ip behave.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // credentials:true is required — the JWT rides in an httpOnly cookie, so the
  // Vite dev origin must be allowlisted explicitly (no wildcard with cookies).
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and non-browser callers (curl, health checks) send no Origin.
        if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin not allowed by CORS: ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(express.json({ limit: env.jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));
  app.use(cookieParser());

  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
