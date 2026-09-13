import { createApp } from './app.js';
import { env } from './config/env.js';
import { closePool } from './db/pool.js';

const app = createApp();

// One warning at boot when the AI layer will run on the mock provider
// (CLAUDE.md, AI layer). server/src/ai/index.js enforces the fallback itself.
if (!env.anthropicApiKey) {
  console.warn('[ai] ANTHROPIC_API_KEY is not set — using the mock provider');
}

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
