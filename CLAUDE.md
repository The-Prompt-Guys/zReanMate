# ReanMate

Bilingual (Khmer/English) study app. Students upload PDFs or YouTube links and get
summaries, quizzes, flashcards, and an AI tutor. Teachers create classes, lessons,
and assignments.

## Build state

**The build is complete.** Every flow — kits, ingest, summaries, tutor chat, quiz,
practice, flashcards, classes, assignments, plan limits — has a migration, a service,
a route, and a wired React page. 39 of 41 screens are built; the two skipped are the
phone-OTP and email-code screens, which need a provider that does not exist yet.

Prototype mode is retired. `client/src/mock/` is kept for backend-free design review
behind a single `VITE_DEMO` flag, default off. The shipped default is the live API.

**The mock AI and notify providers remain in place** — see the two sections below.
They are not placeholders to be removed; they are the automatic fallback whenever a
real key is absent, and every feature was built and tested against them.

What is left before real users:

1. **OpenAI key** — the token logging is built and only the key is missing. Every
   provider method takes an `onUsage` callback (`server/src/ai/types.js`), services
   wrap their calls in `trackGeneration` (`server/src/services/aiUsage.service.js`),
   and each call lands in `ai_generations` with prompt / completion / reasoning /
   cached token counts, the language, and the source character count. Set
   `OPENAI_API_KEY` and real numbers start accruing with no code change.
   Then read `ai_token_ratios` for the Khmer-versus-English cost multiplier —
   it excludes mock rows, so it stays empty until a real key is in use.
   `npm run verify:ai-usage` from `server/` exercises the whole path.
   A week of real data beats every cost estimate.
2. **SMS/email provider** — wire `notify`, add `requireVerified`, build the two
   skipped screens in `docs/screens/01-auth-onboarding/`.
3. **Storage** — off local disk to S3 or equivalent.
4. **Rate limiting** — `server/src/middleware/rateLimit.js` is in-memory; move it to
   Postgres before running more than one instance.
5. **Deploy** — client to Vercel, server to Railway, database to Neon.

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

### Running Postgres

pgvector is not bundled with a stock Postgres install, so use the pgvector image:

```bash
docker run -d --name reanmate-pg -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=reanmate \
  pgvector/pgvector:pg16
```

Then `DATABASE_URL=postgres://postgres:postgres@localhost:5432/reanmate`.

A native Postgres service listening on 5432 will stop the container binding that
port, and connecting to it instead fails at `CREATE EXTENSION vector`. Either stop
the native service or map the container elsewhere (`-p 5433:5432`) and update
`DATABASE_URL` to match. Confirm which server answered before trusting a run:

```bash
psql "$DATABASE_URL" -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"
```

### Migrations are never stubbed

**Never edit, comment out, or skip a statement to make a migration apply.** If an
extension or prerequisite is missing, STOP and report it. Do not:

- strip `CREATE EXTENSION` and run the rest,
- swap a real type for a stand-in (`vector(1536)` → `real[]`),
- drop an index the environment cannot build,
- or record a version in `schema_migrations` that does not match what actually ran.

A partial apply recorded as complete is worse than a failed migration: the ledger
says the schema is current while the column types, extensions, and indexes are not,
and every later migration builds on a database nobody has actually verified. The
runner checksums each file for this reason — a checksum that matches a file whose
statements were bypassed makes the ledger lie.

If a migration cannot run in the current environment, fix the environment.

## AI layer

The OpenAI API key is NOT set up yet. The mock provider serves every AI feature.

- All AI calls go through `server/src/ai/index.js`. Never call the API from a
  controller or route directly.
- If `OPENAI_API_KEY` is missing, fall back to the mock provider automatically and
  log one warning at boot.
- Build and test every AI feature against the mock. Do not block UI work on the real API.
- Mock responses must return realistic shapes in both `km` and `en`.

### Provider details
- SDK: `openai` npm package.
- Chat/generation: `gpt-4o-mini` by default, model name read from env so it can change.
- Embeddings: `text-embedding-3-small`, 1536 dimensions — matches the
  `document_chunks.embedding` column exactly. Do not change the model without a migration.
- Structured output: use `response_format: { type: "json_schema", strict: true }`
  for summaries, quizzes, and flashcards. Do not prompt for JSON and parse loosely.
- Streaming: `stream: true`, relayed to the client over SSE from Express.
- The provider interface in `server/src/ai/types.js` stays provider-agnostic. Adding
  an Anthropic provider later must require no changes outside `server/src/ai/`.

## OTP and email delivery

No SMS or email provider is configured yet. The mock notifier serves every code.

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

The vertical slices are done. New work is now change to a built flow, so the order
still holds — write the migration first, keep logic in services, wire the existing
screen rather than rebuilding it — but the slice is usually smaller than a session.

Run `npm run migrate` from `server/` after pulling. The runner checksums each file
and refuses a migration whose contents changed after it was applied.
