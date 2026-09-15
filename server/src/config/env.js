import 'dotenv/config';

const required = (name, fallback) => {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toInt(process.env.PORT, 4000),

  databaseUrl: required('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/reanmate'),

  // Vite dev server. Comma-separated so staging can add its own origin.
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? '1mb',

  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
  refreshTokenTtlDays: toInt(process.env.REFRESH_TOKEN_TTL_DAYS, 30),

  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  maxUploadBytes: toInt(process.env.MAX_UPLOAD_BYTES, 25 * 1024 * 1024),

  // Absent on purpose for now — server/src/ai/index.js falls back to the mock
  // provider and logs a single warning at boot. See CLAUDE.md, AI layer.
  openaiApiKey: process.env.OPENAI_API_KEY ?? null,
  // Any OpenAI-compatible endpoint (a gateway, proxy, or self-hosted server).
  // Null means api.openai.com, the SDK's own default. Logged at boot, because
  // silently sending study material to a different host is not a detail.
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? null,
  openaiModel: process.env.OPENAI_MODEL ?? 'gpt-5.6-luna',
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',

  // Likewise absent — server/src/notify/index.js falls back to the mock
  // notifier, which prints OTP codes and keeps a readable outbox.
  smsProvider: process.env.SMS_PROVIDER ?? null,
  emailProvider: process.env.EMAIL_PROVIDER ?? null,

  otpTtlMinutes: toInt(process.env.OTP_TTL_MINUTES, 10),
};

export const isProduction = env.nodeEnv === 'production';
export const isDevelopment = !isProduction;
