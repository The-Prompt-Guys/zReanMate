import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './db/pool.js';
import { getAI } from './ai/index.js';
import { getNotifier } from './notify/index.js';

const app = createApp();

// Build both providers at boot so their "falling back to the mock" warnings
// land once, here, rather than on the first request (CLAUDE.md: one warning at
// boot). Each layer owns its own fallback decision.
getAI();
getNotifier();

const server = app.listen(env.port, () => {
  console.log(`[server] ReanMate API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[server] CORS origins: ${env.corsOrigins.join(', ')}`);
});

const shutdown = (signal) => {
  console.log(`\n[server] ${signal} received, shutting down`);
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
