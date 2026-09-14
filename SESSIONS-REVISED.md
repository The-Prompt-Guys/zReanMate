# ReanMate — Remaining session prompts

The client is built (39 of 41 screens, fixture-backed). The schema is complete.
What's missing is the server between them.

Every session below is: build the backend slice, then wire the existing screens to it.
**Never rebuild a screen.** If a screen looks wrong, fix the endpoint or file it as a
separate task — do not regenerate UI that already matches the design.

Paste one prompt per session. Commit between them.

---

## Session A — API contract from the fixtures (do this first)

```
Read client/src/mock/fixtures.js and client/src/screens.js. For every fixture, work
out which endpoint would serve it and what shape the screen actually consumes.

Produce docs/API-CONTRACT.md: one section per endpoint with method, path, request
body, response shape, and which screens depend on it. Note every place a fixture
shape contradicts what 001_init.sql could return — camelCase vs snake_case,
computed fields, joins the schema doesn't make cheap.

The fixtures are the contract. They were written from the screens, so they encode
real UI requirements. Where fixture and schema disagree, the fixture wins unless
serving it would be expensive — flag those cases for me rather than deciding alone.

Do not write any endpoints. This is a contract document and it needs to be right
before it's implemented.
```

---

## Session B — Per-flow prototype switch

```
client/src/mock/mode.js currently has one global VITE_PROTOTYPE flag. Flipping it
would move all 39 screens to live endpoints at once, which makes shape mismatches
impossible to debug.

Replace it with a per-flow switch: kits, study, chat, quiz, practice, flashcards,
classes, assignments, profile. Each reads VITE_PROTOTYPE_<FLOW>, falling back to the
global VITE_PROTOTYPE when unset, defaulting to prototype mode.

Auth and onboarding are already live — set those to false now and confirm login,
register, and onboarding still work end to end against the real server.

Also: client/src/kits/KitsContext.jsx is untracked. Commit it.

Show me the flag resolution logic before changing any screen.
```

---

## Session C — Study kits: CRUD + upload

```
Server:
- CRUD for kits and folders, per docs/API-CONTRACT.md
- POST /api/kits/:id/files — multer to local disk under server/uploads/, path in the
  DB. Validate mime and size. PDF and images only.
- File status: uploaded | processing | ready | failed. Nothing parses yet.
- Free-plan kit cap of 3: count existing rows so deleting frees a slot. Return
  403 { error: 'quota_exceeded', used, limit }.
- Deleting a kit removes its files from disk, not just the rows.
- Mount the kits router in routes/index.js, replacing the placeholder comment.

Client — wire, do not rebuild:
- Set VITE_PROTOTYPE_KITS=false
- Point the existing docs/screens/03-study-kits/ screens at the real endpoints
- KitsContext switches from in-memory to server-backed
- Keep the existing loading and error states; add quota-exceeded handling
- Upload progress must reflect the real request, not a simulated timer

Show me the endpoint list against API-CONTRACT.md before wiring.
```

---

## Session D — PDF parsing, YouTube ingest, embeddings

```
Pure backend session. No screens to wire except the YouTube processing states.

Server:
- PDF text extraction with page numbers preserved per chunk (Citation.pageNumber)
- YouTube transcript fetch with timestamps preserved per chunk (Citation.startSeconds)
- Chunker: ~500 tokens with overlap, writes document_chunks
- Embedding through the AI layer's embed(), batched, order-preserving
- Job runner: uploaded -> processing -> ready | failed, error message stored on
  failure. In-process queue is fine; make it swappable.
- Free-plan limits enforced before any tokens are spent: 50-page PDF, 30-minute video

YouTube transcripts fail constantly — no captions, age gate, region block, rate
limit, deleted video. Each needs a distinct user-facing message. Do not collapse
them into one generic error.

Client — wire only:
- The YouTube URL entry and processing screens in docs/screens/03-study-kits/
- Real status polling instead of the fixture's fake progression

Show me the chunking strategy and the failure taxonomy before implementing.
```

---

## Session E — Summaries + chapters

```
Server:
- POST /api/sources/:id/summarize — whole-source summary via the AI layer
- POST /api/sources/:id/chapters — outline first, then bodies, resumable per the
  summarizeChapters contract. Insert all chapter rows at status='pending' up front,
  flip each to generating -> ready independently.
- Chapter summaries are Plus-only: 403 { error: 'feature_unavailable', requiredPlan: 'plus' }
- Cache on (source_id, method, params) — generate once per source, never per user.
  A second student on the same source reads the existing row.
- Use the batch service tier wherever the UI shows a generating state.

Client — wire, do not rebuild:
- VITE_PROTOTYPE_STUDY=false
- docs/screens/04-study-mode-summaries/ — all five screens to real endpoints
- Per-chapter Ready/Generating state driven by real status, not fixture timing

Show me the cache key and the resume path before wiring.
```

---

## Session F — AI tutor chat (SSE)

```
The trickiest session. Take the server slowly.

Server:
- GET /api/chat/:sessionId/stream — SSE relaying tutorReply deltas
- Exactly one terminal event per stream: done (citations, suggestedFollowups) or
  error. The client must never be left hanging.
- Retrieval: embed the query, cosine search document_chunks scoped to the kit, top 3.
  Last 4 turns of history only. max_output_tokens 400.
- Persist messages and citations
- Tutor quota: 20/month free, 300 Plus. Consume AFTER the stream completes
  successfully — a failed call must not burn a message.
- SSE with cookie auth needs credentials on both ends and no buffering in between.
  Verify it actually streams rather than arriving in one chunk.

Client — wire, do not rebuild:
- VITE_PROTOTYPE_CHAT=false
- docs/screens/05-ai-tutor-chat/ both screens on the real stream
- Incremental rendering, citation chips, retry on the error event
- Remaining message count shown before the cap is reached

Show me the SSE event contract and reconnect behaviour before wiring.
```

---

## Session G — Quiz

```
Server:
- POST /api/sources/:id/quiz — generateQuiz, effort medium. Validate every question
  in JS after parsing: correct index in range, no duplicate options, non-empty
  explanation. Throw rather than persist a broken question.
- Cache per source, same as summaries.
- Attempt lifecycle: start, answer, submit. Answers persisted as they go so a
  refresh doesn't lose progress.
- On submit: mastery computed as round(correct/total*100). Call summarizeAttempt for
  the takeaways text only — never ask the model for the number.
- Free plan: 10 questions per quiz. Plus: 25.

Client — wire, do not rebuild:
- VITE_PROTOTYPE_QUIZ=false
- docs/screens/06-quiz/ all three screens

Show me the validation rules before wiring.
```

---

## Session H — Practice + progress

```
Server:
- Practice setup persists the three controls verbatim: question_count,
  answer_format, timer_seconds
- Session lifecycle: create, serve batch, submit, results
- Question selection weighted by user_topic_mastery — weaker topics appear more often
- Update user_topic_mastery on submit
- Progress aggregates: accuracy over time, per-topic mastery, activity streak
- Free plan: 3 sessions per week, no mock exams

Client — wire, do not rebuild:
- VITE_PROTOTYPE_PRACTICE=false
- docs/screens/07-practice/ all seven screens, including the no-activity empty state

Verify the empty state against a genuinely new user, not a reset fixture.
Show me the topic weighting formula before wiring.
```

---

## Session I — Flashcards + SM-2

```
Server:
- generateFlashcards, effort none, cached per source
- Review state lives in flashcard_reviews keyed on (user_id, flashcard_id) — never
  on the card, since kits can be shared to a class
- SM-2: quality 0-5 updates ease_factor, interval_days, repetitions, lapses, due_at
- GET /api/flashcards/due — due_at <= now(), ordered by due_at, limited
- POST /api/flashcards/:id/review — one review, returns the next due_at
- Free plan: 20 cards per source

Unit tests for SM-2 covering the first three reviews, a lapse, and the ease floor.

Client — wire, do not rebuild:
- VITE_PROTOTYPE_FLASHCARDS=false
- docs/screens/08-flashcards/ both screens

Show me the SM-2 tests before wiring.
```

---

## Session J — Classes + lessons

```
Server:
- Teacher creates a class; students join by code
- Role guards: only teachers create classes and lessons
- Lessons grouped by week, each with ordered lesson_items
- lesson_item_progress per student, lesson_progress as a rollup so "6 of 12 lessons
  completed" stays one cheap count
- Ship the lesson_progress recompute query from docs/SCHEMA.md as a runnable script
- Kits shared into a class do NOT count against a student's 3-kit cap

Client — wire, do not rebuild:
- VITE_PROTOTYPE_CLASSES=false
- docs/screens/09-classes-assignments/ screens 01, 02, 03

Show me the role guard and the kit-cap exemption before wiring.
```

---

## Session K — Assignments + submissions

```
Server:
- Teacher creates assignments against a lesson, with due dates
- Student submits: file upload or quiz completion, by assignment type
- States: not started, in progress, submitted, graded, late
- Late is determined server-side from the due date. Never trust a client timestamp.
- Teacher views submissions for an assignment

Client — wire, do not rebuild:
- VITE_PROTOTYPE_ASSIGNMENTS=false
- docs/screens/09-classes-assignments/ screens 04, 05, 06

Show me the state machine before wiring.
```

---

## Session L — Plan limits + profile

```
Server:
- Profile read and update
- plan_limits and plan_features tables. Three limits only: max_kits (3 free),
  tutor_messages_per_month (20 free / 300 plus), and feature flags for
  chapter_summaries and mock_exams. NULL means unlimited. A missing row denies.
- usage_counters keyed on (user_id, counter_key, period_start), period_start being
  the first of the calendar month UTC
- consumeQuota is a single INSERT ... ON CONFLICT DO UPDATE ... RETURNING with the
  limit enforced in SQL. Read-then-write lets two concurrent requests both pass at
  the boundary.
- GET /api/me/limits — every limit and feature with current usage
- Audit every endpoint from sessions C through K: each must enforce its limit through
  this service, not an inline check. Replace any inline checks you find.

Client — wire, do not rebuild:
- VITE_PROTOTYPE_PROFILE=false
- docs/screens/10-profile/ and the free-vs-plus screen
- Upgrade prompts wherever quota_exceeded or feature_unavailable comes back
- Remaining-usage indicators before walls, not at them

Tests: quota boundary, concurrent consume at the boundary, month rollover, deleting
a kit freeing a slot, a failed handler not consuming quota.

Show me the migration and the consumeQuota SQL before the middleware.
```

---

## Session M — Retire prototype mode

```
Every flow is now live. Final pass:

- Confirm each VITE_PROTOTYPE_<FLOW> flag is false and the app works end to end
  with no fixture reads on any happy path
- Keep client/src/mock/ — a backend-free UI is useful for design review and demos.
  Move it behind a single VITE_DEMO flag, default off.
- Update docs/API-CONTRACT.md to match what shipped, noting any divergence
- client/src/screens.js: verify every built flag is honest
- npm run check passes in client/; all server tests pass
- Update CLAUDE.md: the build is complete, mock AI and notify providers remain

Then list what's left before real users: OpenAI key, SMS/email provider, storage off
local disk, rate limiting moved to Postgres, deployment.
```

---

## After M

1. **OpenAI key** — swap from mock, measure Khmer token ratios against English, log
   `usage.prompt_tokens` / `completion_tokens` / `reasoning_tokens` per call into
   `ai_generations`. A week of real data beats every cost estimate.
2. **SMS/email provider** — wire notify, add requireVerified, build the two skipped
   screens in docs/screens/01-auth-onboarding/
3. **Storage** — off local disk to S3 or equivalent
4. **Deploy** — rate limiting to Postgres, client to Vercel, server to Railway,
   database to Neon
