# ReanMate

Bilingual (Khmer/English) study app. Students upload PDFs or YouTube links and get
summaries, quizzes, flashcards, and an AI tutor. Teachers create classes, lessons,
and assignments.

## Architecture

Monorepo, two apps, no shared build tooling.

- `client/` — React 19 + Vite + React Router + Tailwind. Talks to the API over HTTP only.
- `server/` — Node + Express REST API. Owns all database and AI access.
- `docs/` — PRD, schema docs, and UI screenshots.

The client NEVER touches the database or the Anthropic API directly. Everything goes
through `server/` endpoints under `/api`.

## Stack

- React 19, Vite, React Router v7, Tailwind CSS, axios
- Node 20+, Express 5, PostgreSQL 16 via `pg` (raw SQL, no ORM)
- JWT in httpOnly cookies, bcrypt for passwords, zod for validation
- multer + local disk for uploads in dev
- Anthropic API (not configured yet — see AI layer)

## Hard rules

- **JavaScript only.** No `.ts` or `.tsx`, no type annotations. If a generator emits
  TypeScript, convert it to plain JS before committing.
- **npm only.** Never pnpm, yarn, or bun. Lockfiles are `package-lock.json`.
  Delete `pnpm-lock.yaml` or `yarn.lock` on sight.
- **ESM everywhere.** `"type": "module"` in both package.json files. Use `import`/`export`,
  never `require()`.
- Server structure: `routes/` → `controllers/` → `services/` → `db/`.
  Routes only wire things up. Business logic lives in services. SQL lives in db.
- No SQL string interpolation. Parameterized queries only (`$1`, `$2`).
- Every endpoint validates its body with zod before doing anything else.
- Every user-facing string in the client comes from `client/src/i18n` (km + en).
  No hardcoded text, ever.
- Write the SQL migration before building the endpoint that uses it.

## Database

PostgreSQL 16 via `pg`. Raw parameterized SQL, no ORM.

- Extensions: `uuid-ossp`, `pg_trgm`, `vector` (pgvector).
- UUID primary keys. All timestamps `timestamptz`.
- JSONB for onboarding survey answers, quiz question options, and AI payloads.
  GIN index them.
- Embeddings live in a `vector(1536)` column on a `document_chunks` table.
- **Khmer text: NEVER use `to_tsvector` for search.** There is no Khmer dictionary
  and Khmer has no word spaces — the default tokenizer treats a whole sentence as one
  token and search silently returns nothing. Use `pg_trgm` similarity or vector search.
- Every foreign key gets an index.
- No Redis. OTP codes live in Postgres with an `expires_at` column and a cleanup job.

## AI layer

The Anthropic API key is NOT set up yet.

- All AI calls go through `server/src/ai/index.js`. Never call the API from a
  controller or route directly.
- If `ANTHROPIC_API_KEY` is missing, fall back to the mock provider automatically and
  log one warning at boot.
- Build and test every AI feature against the mock. Do not block UI work on the real API.
- Mock responses must return realistic shapes in both `km` and `en`.

## OTP and email delivery

No SMS or email provider is configured yet.

- Delivery goes through `server/src/notify/index.js` with the same mock-fallback pattern.
- In dev, the mock provider logs the code to the console and returns success.
  Never stub this in a way that can't be tested end to end.

## Design

Reference screenshots are in `docs/screens/`, grouped by flow — read
`docs/screens/INDEX.md` for the map. Match layout, spacing, and color from the
screenshots. Navy primary, owl mascot. Do not invent a visual style.

## Workflow

One feature per session, as a vertical slice: migration → service → route → React page.
Commit after each working step.
