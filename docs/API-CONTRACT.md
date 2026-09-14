# ReanMate — API Contract

Derived from `client/src/mock/fixtures.js` (the shapes the screens actually read),
`client/src/screens.js` (which screens exist), and the pages under
`client/src/pages/` (how each field is consumed). Checked against
`server/migrations/001_init.sql` and `002_optional_phone.sql`.

**The fixtures are the contract.** They were written from the screenshots, so where
a fixture and the schema disagree the fixture describes a real UI requirement. This
document records every disagreement. Where honouring the fixture would be expensive
or would need a migration, it is flagged as an open decision (**D1**–**D13**) rather
than resolved here.

Nothing in this document is implemented yet except the auth and onboarding section,
which is already live and is documented as-built.

---

## How to read a section

Each endpoint gives: method and path, request body, response shape, the screens that
depend on it, the fixture it replaces, and any schema notes. Response shapes are
written as the client would destructure them, not as SQL rows.

`→ Dn` marks a field or shape that is part of an open decision at the end.

---

## Conventions

These are read off the code that already exists (`server/src/db/users.db.js`,
`server/src/controllers/onboarding.controller.js`, `server/src/ai/types.js`), not
invented here.

| Rule | Applies to |
|---|---|
| **snake_case** for anything that is a database row served more or less as-is | `user`, and any row-shaped object |
| **camelCase** for envelope keys and anything the API computes or the AI layer produced | `onboarding.completedAt`, `bodyMd`, `keyPoints`, `sourceTitle` |
| Errors are always `{ error: { code, message, details? } }` | every endpoint (`middleware/errors.js`) |
| Validation failures are `422` with `code: "validation_failed"` | every endpoint with a body |
| Every endpoint validates with zod before anything else | CLAUDE.md hard rule |
| Auth is the httpOnly cookie; no `Authorization` header | every authenticated endpoint |
| All paths are under `/api` (`client/src/lib/api.js` sets `baseURL`) | everything |

The fixtures already follow this split: `mockUser` is snake_case because it is a
`users` row; `mockOnboarding` is camelCase because the server assembles it. That is
consistent and should be preserved, not normalised away.

### Bilingual fields

Almost every fixture carries both languages inline — `title` + `titleKm`, `options` +
`optionsKm`, `content` + `contentKm`. This is not decoration. `client/src/i18n/index.js`
keeps the language in `localStorage` and swaps it **client-side with no refetch**;
`LanguageSwitcher` on the profile screen re-renders every visible string instantly.
Serving one language per request would break that.

The schema does the opposite: `summaries`, `quizzes`, `flashcards` and
`chat_conversations` each carry a `language text CHECK (language IN ('km','en'))`
column, one language per row, and `study_kits.title`, `classes.title`, `lessons.title`,
`kit_sources.title`, `topics.name` and `assignments.title` are single `text` columns
with no `_km` sibling.

This is the single largest fixture/schema disagreement and it touches nearly every
endpoint below. See **D1** (authored text) and **D2** (AI-generated text) — they have
different answers and should be decided separately.

### Pre-formatted strings

Fixtures contain `size: '2.4 MB'`, `'5h 02m'`, `dueLabel: 'Sep 14'`, `at: '9:42 AM'`,
`month: 'Sep'`, `label: 'September 2026'`. The schema stores `byte_size bigint`,
`duration_seconds integer`, `due_at timestamptz`, `created_at timestamptz`.

Formatting these server-side has a specific cost in this app: `t()` converts
**numbers** to Khmer digits (`formatNumber` in `i18n/index.js`) but passes **strings**
through untouched. A server-formatted `"Sep 14"` therefore renders as Western digits
and an English month inside otherwise-Khmer UI. See **D3**.

---

## Open decisions — read these first

| | Decision | Why it cannot be settled from the fixtures alone |
|---|---|---|
| **D1** | Bilingual **authored** text (kit/class/lesson/assignment titles, instructions) | Needs a migration (`title_km`, `description_km`, …) or a translations table. Cheap either way, but it is a schema change and a product question: who types the Khmer? |
| **D2** | Bilingual **AI-generated** text (summaries, quiz prompts, flashcards, tutor replies, takeaways) | The fixture wants both languages for the same object. The AI layer generates **one** language per call (`SummarizeInput.language`). Honouring the fixture means two generations per artefact — double latency and double cost on every summary, quiz, deck and chat turn. |
| **D3** | Who formats sizes, durations, dates and times | Server-formatted strings bypass Khmer digit conversion and month names. Recommend raw values + client formatting, but that changes fixture field names. |
| **D4** | `septemberCalendar` — server-built grid vs. client-built | Leading blanks depend on week-start convention (differs km/en) and `today` depends on the viewer's timezone. |
| **D5** | `learningWeek` — no table records daily study activity | Would be a UNION across `flashcard_reviews`, `quiz_attempts`, `practice_sessions`, `chat_messages` per day, per week. Wants a rollup table. |
| **D6** | `practiceLessons[].mastery` and `.kind` | `topics` links to `study_kit_id` / `class_id`, never to `lesson_id`. There is no path from a lesson to its topics, so lesson mastery is not computable today. And the fixture's `kind` vocabulary is not `lessons.kind`. |
| **D7** | `pdfDocument` — structured PDF page content | Nothing in the schema stores headings/paragraphs/bullets for a PDF. `document_chunks` holds chunk text and a page number for retrieval, not a renderable document tree. |
| **D8** | Shipping `correct` and `explanation` to the client before answering | The quiz screen grades client-side (a real requirement). The **assignment** workspace uses the same shape, and that submission is graded by a teacher. |
| **D9** | `classQuizzes[].tone` is a literal Tailwind class string in the payload | Presentation in the contract. `kits[].accent` shows the better pattern (semantic token, mapped client-side). |
| **D10** | Week bucketing for class materials and quizzes | `class_materials` and `quizzes` have no `week_number`; week is reachable only via a nullable `lesson_id`. A material with no lesson cannot be bucketed. |
| **D11** | `kits[].sourceKind` from a kit with mixed sources | `kit-database` is marked `youtube` but holds PDFs, an image and a video. Needs a stated precedence rule. |
| **D12** | Per-row aggregates in list responses | `cardCount`, `lessonsDone`, `profileSummary` — each an indexed count, together N+1 shaped. Decide once whether list endpoints carry counts. |
| **D13** | `kind: 'document'` is not a legal `kit_sources.kind` | The CHECK constraint rejects a value the fixture, both i18n dictionaries and the file-tile component all use. A `.docx` upload has nowhere legal to go. |

Full detail on each is at the bottom, under [Open decisions in full](#open-decisions-in-full).

---

# 1. Auth and onboarding

**Built.** Documented as-implemented; listed because `mockUser` and `mockOnboarding`
are fixtures like any other and the rest of the document assumes this envelope.

## POST /api/auth/register

```jsonc
// request
{ "fullName": "Sokchea", "email": "sokchea@example.com", "phone": null,
  "password": "…", "locale": "km" }
// 201
{ "user": { /* users row, see /api/auth/me */ } }
```

At least one of `email` / `phone` is required — `002_optional_phone.sql` enforces this
as `users_needs_identifier`. Duplicate identifier is `409`.

**Screens:** `/auth` (01-auth-signup-phone).

## POST /api/auth/login · POST /api/auth/refresh · POST /api/auth/logout

`login` and `refresh` return `{ user }`; `logout` returns `204`. Both cookies are set
server-side. `refresh` and `logout` are deliberately unauthenticated — the access
token is usually already expired by the time they are called.

## GET /api/auth/me · GET /api/me

Serves `mockUser` + `mockOnboarding` together.

```jsonc
{
  "user": {
    "id": "uuid", "full_name": "Sokchea", "email": "…", "phone": null,
    "avatar_url": null, "role": "student", "locale": "km",
    "plan_tier": "free", "plan_status": "active",
    "trial_started_at": null, "trial_ends_at": null, "plan_period_end": null,
    "phone_verified_at": "…", "email_verified_at": "…",
    "onboarding_completed_at": "2026-09-01T09:00:00Z",
    "status": "active", "last_seen_at": "…",
    "created_at": "…", "updated_at": "…"
  },
  "onboarding": {
    "roleChosen": true,
    "surveyAnswers": { "improveFirst": "understand_topics",
                       "studyStyle": "mix", "studyFrequency": "few_times_week" },
    "surveySkipped": false,
    "completedAt": "2026-09-01T09:00:00Z"
  }
}
```

**Screens:** every authenticated screen. `full_name` is read directly on the dashboard
header, profile header and quiz results (`user?.full_name`).

**Fixture fidelity:** `mockUser` is a strict subset of what the endpoint returns — the
fixture omits the verification and audit timestamps the client does not read. No
contradiction; the fixture is just shorter.

`user.locale` is **not** the display language. The client's language lives in
`localStorage` and is switched without a request. `locale` is the account default and
the language the AI layer should generate in.

## POST /api/onboarding/role

`{ "role": "student" | "teacher" }` → `{ "user": {…} }`. **Screens:** `/onboarding/role`.

## POST /api/onboarding/survey · GET /api/onboarding/survey

```jsonc
// POST request — partial answers merge; each survey step submits on its own
{ "answers": { "studyStyle": "mix" }, "skipped": false, "complete": false }
// response
{ "survey": { "answers": {…}, "skipped": false, "completedAt": null },
  "user": {…} /* only when complete or skipped */ }
```

Answer vocabulary is fixed in `SURVEY_QUESTIONS` (`onboarding.service.js`); unknown
keys are `400`. **Screens:** `/onboarding/survey/1..3`.

`/onboarding/plan` (08-free-vs-plus) reads nothing but `user.plan_tier`.

---

# 2. Dashboard

## GET /api/dashboard

One request for the home screen, which today reads four fixtures at once.

```jsonc
{
  "kits": [ /* first 4, same shape as GET /api/kits */ ],
  "kitCount": 4,
  "classes": [ { "id": "uuid", "title": "…", "titleKm": "…",     // → D1
                 "teacher": "Prof. Chanthou", "icon": "book",     // → D1 (no icon column)
                 "nextDueAt": "2026-09-14T00:00:00Z" } ],         // → D3
  "agenda": [ { "assignmentId": "uuid", "dueAt": "2026-09-14T00:00:00Z",
                "title": "ER Diagram Exercises", "titleKm": "…",
                "className": "English for Academic Success",
                "classNameKm": "…" } ]
}
```

**Screens:** `/` (01-dashboard-populated), `/?empty=1`, `/?header=calendar`.

**Fixtures replaced:** `kits` (first four), `classes`, `assignmentDates`.

### Contradictions

- `assignmentDates` is `{ month: 'Sep', day: 14, title, course }` — a **pre-split,
  pre-formatted** date. `assignments.due_at` is a `timestamptz`. Splitting server-side
  produces an English month abbreviation that `t()` will not translate and Western
  digits inside Khmer UI. → **D3**
- `assignmentDates[].course` holds `'Academic Paragraphs'` and `'Computer Networks'`.
  `'Academic Paragraphs'` is a **study kit** title, not a class title (the classes
  fixture has `'English for Academic Success'`). The `assignment` fixture's `className`
  for that same assignment says `'English for Academic Success'`. The fixtures
  contradict each other; `assignments.class_id → classes.title` is the schema path and
  should win here.
- `classes[].icon` (`'book'` / `'laptop'`) has **no column**. `classes` has
  `cover_color` but no `icon`. → **D1**
- The dashboard's class card renders a hardcoded due date per class id
  (`klass.id === 'class-eng' ? 'Sep 14' : 'Sep 17'` in `DashboardPage.jsx`). That is
  prototype scaffolding; `nextDueAt` above is the real field it needs.

## GET /api/me/agenda?month=2026-09

Feeds the month calendar on `/?header=calendar`.

```jsonc
{ "month": "2026-09",
  "days": [ { "date": "2026-09-14", "assignmentCount": 1 },
            { "date": "2026-09-17", "assignmentCount": 1 } ] }
```

**Fixture replaced:** `septemberCalendar`.

### Contradictions

`septemberCalendar` is a finished view-model, not data:

```js
{ label: 'September 2026', today: 12, marked: [14, 17],
  days: [null, null, 1, 2, /* … */ 30] }
```

- `days` carries **two leading nulls** to align the grid. Week-start convention is a
  locale decision and differs between km and en; the server would be choosing it.
- `today: 12` is the viewer's local date — server-side it is whatever timezone the
  server thinks in. (It is also inconsistent with the rest of the fixtures, which put
  "now" at Sep 14, 2026.)
- `label: 'September 2026'` is an untranslatable string. `MonthCalendar` already
  translates the weekday initials through `t('dashboard.dayInitial_*')`, so it clearly
  intends to own its own formatting.

The shape above returns dates and lets `MonthCalendar` build the grid it already knows
how to build. → **D4**

---

# 3. Study kits

## GET /api/kits?status=&q=

```jsonc
{ "kits": [
  { "id": "uuid",
    "title": "Introduction to Database Systems", "titleKm": "…",      // → D1
    "shortTitle": "Database Systems", "shortTitleKm": "…",            // → D1, no column
    "icon": "database", "accent": "violet",
    "status": "in_progress", "progress": 45,
    "cardCount": 6,                                                   // → D12
    "sourceKind": "youtube",                                          // → D11
    "lastStudiedAt": "…" }
] }
```

**Screens:** `/kits` (01-kits-tab), `/` (dashboard grid, first four).

**Fixture replaced:** `kits`.

`status` and `q` mirror the filter tabs and search box on `KitsPage`. Search must use
`pg_trgm` similarity against `study_kits.title` (`study_kits_title_trgm`), never
`to_tsvector` — Khmer titles are in scope and the default tokenizer silently returns
nothing.

### Contradictions

| Fixture field | Schema | Note |
|---|---|---|
| `title` / `titleKm` | `study_kits.title` only | → **D1** |
| `shortTitle` / `shortTitleKm` | **no column** | `KitCard` uses it for the narrow two-column dashboard grid and falls back to the full title. A real requirement with nowhere to live. → **D1** |
| `accent` | `study_kits.accent_color` | Straight rename. Fixture values are semantic tokens (`blue`/`violet`/`amber`/`teal`) mapped to classes in `KitCard`. Keep the token, not a colour. |
| `progress` | `progress_percent` | Rename only. |
| `cardCount` | `COUNT(flashcards WHERE study_kit_id)` | Indexed (`flashcards_study_kit_id_idx`); a lateral count per kit. → **D12** |
| `sourceKind` | `kit_sources.kind`, per source | A kit-level field derived from many source rows. → **D11** |
| `status` | `study_kits.status` | Values match; schema also allows `archived`, which no screen filters for. |

## POST /api/kits

```jsonc
// request
{ "title": "…", "titleKm": "…", "folderId": null,
  "icon": "document", "accent": "blue" }
// 201
{ "kit": { /* as above, cardCount 0, progress 0, status "in_progress" */ } }
```

**Screens:** `/kits/folders/new` (02-create-study-folder).

`KitsContext.addKit` assigns `icon` and `accent` round-robin by list position when not
given. That rotation is prototype behaviour; the server should pick a default or the
client should keep choosing. Worth deciding, not blocking.

Note the screen is titled "Create a study kit" in the design but lives at
`/kits/folders/new` and the flow is `02-create-study-folder`. `study_folders` exists as
a separate table and **is not used by any screen**. Either the route is misnamed or
folders are unbuilt; flagging so this endpoint is not built against the wrong table.

## GET /api/kits/:kitId

```jsonc
{ "kit": { /* one kit, as in GET /api/kits */ },
  "fileCount": 6 }
```

**Screens:** `/kits/:kitId` (03-study-kit-file-list) — the header reads
`t('kits.fileSummary', { files, cards })`.

## GET /api/kits/:kitId/sources

```jsonc
{ "sources": [
  { "id": "uuid", "name": "Database Week 1.pdf",   // kit_sources.title
    "kind": "pdf",                                  // → D13
    "byteSize": 2516582, "size": "2.4 MB",          // → D3
    "durationSeconds": null, "pageCount": 18,
    "status": "ready", "createdAt": "…" }
] }
```

**Screens:** `/kits/:kitId` file list, `/tutor` ("using N files" chip).

**Fixtures replaced:** `kitDetailFiles`, `otherKitFiles`, and `kitFiles`.

`otherKitFiles` is keyed by kit id purely because the prototype has no server; it is
this same endpoint called per kit. `KitsContext` is explicit that a kit with no files
must return an empty list, never another kit's — that is a correctness requirement on
this endpoint, not just on the prototype.

### Contradictions

- **`kind: 'document'` is not a legal value.** `kit_sources.kind` is
  `CHECK (kind IN ('pdf','image','youtube','link','topic','text'))`. `kitDetailFiles`
  has `{ id: 'd6', name: 'Practice questions.docx', kind: 'document' }`,
  `t('kits.kind_document')` exists in both dictionaries (`km.js:227`, `en.js:228`), and
  `KitDetailPage`'s `TILES` map has a `document` tile with its own `DocMark` icon. The
  client vocabulary is real and the CHECK constraint does not admit it. → **D13**
- `size` is pre-formatted, and it is **two different units**: `'2.4 MB'` for files and
  `'5h 02m'` for a YouTube video, in the same field of the same list. The row renders
  `t('kits.kind_'+kind) + ' · ' + size`. Schema has `byte_size` and `duration_seconds`
  in separate columns. → **D3**
- `name` vs `kit_sources.title` / `original_filename` — the fixture's `name` is the
  display title. Keep `title` in the DB and expose it as `name`, or rename. Cosmetic,
  but pick one before the components are wired.
- `pdfDocument.pages` is `8` while `kitFiles` gives the **same file** 18 pages. A
  fixture-internal inconsistency; `page_count` is the single source.
- `kitFiles` is exported but **never imported** — `KitDetailPage` declares a local
  `kitFiles` that shadows the name. It is still the only fixture carrying per-file
  `status` (`'processing'`) and `pages`, so it documents state this endpoint must
  return even though no screen currently reads it from there.

## POST /api/kits/:kitId/sources

Two content types, one endpoint.

```jsonc
// multipart/form-data — photo and PDF upload (multer, local disk in dev)
file: <binary>
// application/json — YouTube, link, or typed topic
{ "kind": "youtube", "url": "https://youtube.com/watch?v=…" }
{ "kind": "topic", "title": "Normalization" }
// 202
{ "source": { "id": "uuid", "status": "pending", … } }
```

**Screens:** `/kits/new`, `/kits/new/youtube`, `/kits/:kitId/add`,
`/kits/:kitId/add/youtube` (04-add-youtube-url-popup, 05-youtube-url-entry).

`202` because processing is asynchronous — the next screen polls.

## GET /api/kits/:kitId/sources/:sourceId

```jsonc
{ "source": { "id": "uuid", "status": "processing",
              "stage": "extracting" | "embedding" | "generating",
              "progressPercent": 40, "errorMessage": null } }
```

**Screens:** `/kits/new/processing`, `/kits/:kitId/add/processing` (06-youtube-processing).

### Contradictions

The processing screen shows **three named stages** with independent progress bars
(`kits.stageReading`, `kits.stageFlashcards`, `kits.stagePreparing` in `sheets.jsx`).
`kit_sources.status` is a single four-value enum (`pending`/`processing`/`ready`/`failed`)
with no stage and no percentage. `kit_sources.metadata` is JSONB and GIN-indexed, so
stage and progress can live there without a migration — but that needs to be a stated
decision so the shape is not invented per-writer.

When this flow completes from the Kits tab it **creates a kit**, not just a source
(`ProcessingSheet` calls `addKit`). So the YouTube path is `POST /api/kits` then
`POST /api/kits/:id/sources`, or a combined `POST /api/kits/from-source`. The fixture
does not decide this; the route tree implies two calls.

---

# 4. Study mode and summaries

## GET /api/kits/:kitId/summary

```jsonc
{
  "summary": {
    "title": "Course overview", "titleKm": "…",           // → D2
    "bodyMd": "…", "bodyMdKm": "…",                       // → D2
    "keyPoints": ["…"], "keyPointsKm": ["…"],             // → D2
    "durationSeconds": 18120, "durationLabel": "5h 02m",  // → D3
    "sourceKind": "youtube", "sourceLabel": "YouTube",    // → D3
    "status": "ready"
  },
  "chapters": [
    { "index": 1, "title": "Database foundations", "titleKm": "…",
      "start": 0, "end": 1458, "status": "ready" }
  ],
  "chaptersReady": 5, "chaptersTotal": 12
}
```

**Screens:** `/study/:kitId/summary` (02-five-hour-summary).

**Fixtures replaced:** `summary`, `chapters`.

`SummaryPage` computes `ready / total` itself and renders `clock(start)–clock(end)`, so
seconds are the right unit for chapter bounds — the client already formats them.
`chaptersReady`/`chaptersTotal` are convenience; the client can count.

### Contradictions

- `summary.title` + `titleKm`, `bodyMd` + `bodyMdKm`, `keyPoints` + `keyPointsKm`
  against `summaries.language`, one language per row. Two rows per summary, pivoted in
  the service, is the mechanical answer; it means generating every summary twice. → **D2**
- `durationLabel` / `sourceLabel` are display strings computed from
  `kit_sources.duration_seconds` and `kit_sources.kind`, reachable via
  `summaries.source_id` (indexed). Cheap to join, but `'5h 02m'` and `'YouTube'` are
  English literals in the header of a Khmer screen. → **D3**
- Chapter fields are shortened (`index`, `start`, `end`) where the schema is
  `chapter_index`, `start_seconds`, `end_seconds`. Renaming is fine, but note it breaks
  the "row fields stay snake_case" convention — these are computed enough to justify
  camelCase-ish names. Worth being deliberate rather than accidental.
- Chapter `status` values (`ready`/`generating`/`pending`) are a subset of
  `summaries.status`, which also allows `failed`. The screen has no failed state; the
  `STATUS_KEY` map in `SummaryPage` would render `undefined` for it. Not a contract bug,
  but the endpoint will return `failed` eventually.

## GET /api/kits/:kitId/summary/chapters/:index

```jsonc
{ "chapter": { "index": 1, "title": "…", "titleKm": "…", "status": "ready" },
  "sections": [
    { "id": "s1", "heading": "What is a database?", "headingKm": "…",
      "body": "A database is …", "bodyKm": "…" }
  ] }
```

**Screens:** `/study/:kitId/summary/:chapter` (03-summary-small-owl),
`…?tutor=1` (02-collapsible-ai-tutor-drawer — the same page with the drawer open).

**Fixture replaced:** `summarySections`.

### Contradictions

This is the sharpest structural one. The schema stores a chapter body as
**`summaries.body_md text`** — a single markdown blob. The fixture is an **array of
`{id, heading, body}` sections**, and `ChapterSummaryPage` renders each as its own
`<section>` with an `<h3>`.

`ai/types.js` says `bodyMd` is markdown with headings no deeper than `##`, so the
sections *are* the `##` blocks. Three ways out:

1. The service splits `body_md` on `##` and synthesises `id`s. Matches the fixture
   exactly, no migration — but ids are positional and unstable across regeneration.
2. The client renders markdown. Simplest, but changes the component and loses the
   per-section anchors.
3. Store sections as JSONB. A migration; makes the AI contract structured rather than
   markdown.

The fixture wins on shape, so (1) is the default reading, but the unstable `id` is a
real cost worth your call.

## GET /api/sources/:sourceId/document

```jsonc
{ "document": { "name": "Database Week 1.pdf", "size": "2.4 MB", "pages": 8,
                "title": "Database Systems — Week 1",
                "sections": [
                  { "heading": "…", "headingKm": "…", "body": "…", "bodyKm": "…" },
                  { "heading": "…", "headingKm": "…",
                    "bullets": ["…"], "bulletsKm": ["…"] }
                ] } }
```

**Screens:** `/study/:kitId/pdf` (04-pdf-viewer-with-chat), `?actions=1` (05-pdf-study-actions).

**Fixture replaced:** `pdfDocument`.

### Contradictions

**The schema cannot serve this.** There is no table holding a PDF's rendered structure.
`document_chunks` stores `content`, `page_number`, `start_seconds`, an embedding and
JSONB metadata — built for retrieval, not display. It has no headings, no
paragraph/bullet distinction, and chunk boundaries do not respect document structure.

Three readings, all with real costs:

1. **Serve the file and render client-side** (pdf.js against `kit_sources.storage_path`).
   This is what a PDF viewer normally is, and the screen has page controls and a zoom
   percentage that only make sense against a real rendered page. It makes
   `pdfDocument.sections` dead — the fixture would be describing a mock of a rendered
   page, not an API response.
2. **Extract structure at ingest** into a new table or `kit_sources.metadata`. Honours
   the fixture; adds a structure-extraction step to every PDF upload.
3. **Reuse chunks** and present them as sections. Cheapest, and wrong — the headings in
   the fixture are document headings, not chunk starts.

Reading (1) is most likely what the design means, but it contradicts the fixture. → **D7**

Also note the page-count disagreement (`pages: 8` here, `18` in `kitFiles`) and that
`sections[]` mixes `body` and `bullets` as alternatives — the component checks
`section.body &&` and `section.bullets &&` separately, so both are optional and either
may be absent.

---

# 5. AI tutor

## GET /api/kits/:kitId/conversation

```jsonc
{
  "conversation": { "id": "uuid", "language": "km", "lastMessageAt": "…" },
  "messages": [
    { "id": "uuid", "role": "assistant",
      "content": "Hi Sokchea! Ask me …", "contentKm": "…",        // → D2
      "citations": [], "createdAt": "2026-09-14T09:42:00Z" },     // → D3 (`at`)
    { "id": "uuid", "role": "assistant", "content": "…", "contentKm": "…",
      "citations": [ { "sourceTitle": "Database Week 1.pdf",
                       "pageNumber": 3, "startSeconds": null } ],
      "createdAt": "…" }
  ],
  "suggestions": [ { "en": "Explain SQL JOINs", "km": "ពន្យល់ពី SQL JOIN" } ]
}
```

**Screens:** `/tutor` (01-ai-chat-interface). The drawer on
`/study/:kitId/summary/:chapter?tutor=1` uses a hardcoded `PROMPTS` list and reads no
fixture. The PDF viewer's chat panel is this same endpoint scoped to one source.

**Fixtures replaced:** `chatMessages`, `chatSuggestions`, `pdfChat`.

## POST /api/conversations/:conversationId/messages

```jsonc
// request
{ "content": "What is a primary key?", "sourceId": null }
```

Responds `text/event-stream`. Per `ai/types.js`, `tutorReply` yields zero or more
`{type:'delta', text}` then **exactly one** terminal `{type:'done', citations,
suggestedFollowups}` or `{type:'error', message}`. Relay that framing unchanged; the
guaranteed terminal event is the client's close signal.

The user message is persisted before streaming; the assistant row is written with
`status: 'streaming'` and flipped to `'complete'` — `chat_messages.status` already has
exactly these values.

### Contradictions

- **`content` + `contentKm` is the most expensive instance of D2.** A tutor reply is
  generated once, in one language, in response to one question. Producing the other
  language means a second generation per turn — doubling latency on the one screen
  where latency is most visible. And `chat_conversations.language` exists, which says
  the schema expects a conversation to *have* a language. The bilingual messages are
  most likely an artefact of hand-writing fixtures for review rather than a requirement
  that chat history re-renders on a language switch. **This is the one place I would
  recommend breaking the fixture** — but it is your call. → **D2**
- **Two citation shapes in one file.** `chatMessages[2].citations` is
  `[{ sourceTitle, pageNumber }]`, matching `ai/types.js` `Citation` and
  `chat_messages.citations` JSONB exactly. But `pdfChat[2].source` is a bare string
  `'Database Week 1.pdf'`, and `PdfViewerPage` renders
  `t('tutor.source', { title: message.source })` while `TutorPage` renders
  `message.citations.map(...)`. Same concept, two shapes, two components. Unify on
  `citations[]`; the string form loses the page number the design shows.
- `at: '9:42 AM'` is a pre-formatted local time — timezone-dependent server-side and
  untranslated in Khmer. Return `createdAt` and format in the component. → **D3**
- `chatSuggestions` is `[{ en, km }]`, explicitly bilingual pairs, and the client picks
  by current language. `ai/types.js` `TutorDone.suggestedFollowups` is `string[]`, one
  language. Same conflict, much smaller stakes: suggestions are short enough to generate
  in both. → **D2**
- The `/tutor` header shows `t('tutor.usingFiles', { count: kitDetailFiles.length * 2 })`
  — the `* 2` is prototype padding. The real count is the kit's source count.

---

# 6. Quiz

## GET /api/kits/:kitId/quiz

```jsonc
{ "quiz": { "id": "uuid", "title": "…", "questionCount": 12, "status": "ready" },
  "questions": [
    { "id": "uuid", "position": 1, "kind": "multiple_choice",
      "prompt": "What does a primary key do?", "promptKm": "…",   // → D2
      "options": ["…","…","…","…"], "optionsKm": ["…"],           // → D2
      "correct": 0,                                                // → D8
      "explanation": "…", "explanationKm": "…",                    // → D2, D8
      "topic": "Primary keys" }
  ] }
```

**Screens:** `/quiz/:kitId` (01-quiz-controls-reordered), `?explain=1` (02-quiz-answer-explanation).

**Fixture replaced:** `quizQuestions`.

If no quiz exists yet, `POST /api/kits/:kitId/quiz` generates one (`202`, then poll
`quizzes.status`).

## POST /api/quizzes/:quizId/attempts → POST /api/attempts/:attemptId/answers → POST /api/attempts/:attemptId/submit

```jsonc
// answers request
{ "questionId": "uuid", "response": 0, "timeSpentSeconds": 12 }
// submit response — the results screen
{ "attempt": { "correct": 9, "total": 12, "mastery": 75,
               "takeaways": ["…"], "takeawaysKm": ["…"] } }        // → D2
```

**Screens:** `/quiz/:kitId/results` (03-quiz-completed-results).

**Fixture replaced:** `quizResult`.

### Contradictions

| Fixture | Schema | Note |
|---|---|---|
| `correct` | `quiz_attempts.correct_count` | rename |
| `total` | `quiz_attempts.total_questions` | rename |
| `mastery` | `quiz_attempts.mastery_percent` | rename |
| `takeaways` | `quiz_attempts.takeaways` jsonb | matches; `takeawaysKm` does not → **D2** |
| `correct` (per question) | `quiz_questions.correct_answer` jsonb | the JSONB holds an index for choice questions and text for written ones — the fixture's bare integer only covers the choice case. `ai/types.js` `correctAnswer` is `number\|string`, the fuller shape. |
| `topic` | `quiz_questions.topic_id → topics.name` | one indexed join, cheap. But `topics.name` is single-language, so a Khmer topic label hits **D1**. |

**Answer-key exposure (D8).** `QuizPage` computes `isCorrect = choice === question.correct`
and has a "Show answer" button that sets `choice = question.correct`. The answer key
must be in the browser for this screen to work as designed. That is defensible for
self-study. The same shape is used by the **assignment** workspace, where it is not —
see §9.

**Question count.** `QuizPage` takes its total from `quizResult.total` (12) while
`quizQuestions` has 3 and it cycles with `%`. Prototype padding — the real total is
`questions.length`, and `quizzes.question_count` should agree with it.

---

# 7. Practice

## GET /api/practice/home

```jsonc
{ "continue": { "kitId": "uuid", "title": "…", "titleKm": "…",
                "sessionId": "uuid", "answered": 8, "total": 10 } }
```

**Screens:** `/practice` (05-practice-with-mock-exam). The four mode tiles are static
UI; only the "continue" card needs data.

**Fixtures replaced:** `practiceResult` (reused there for progress), `kits[1]`.

Note `PracticeHomePage` renders the continue bar as `correct / total`, not
`answered / total`, while the label it uses is `practice.answeredOf`. Almost certainly
a slip in the prototype — the endpoint should return `answered`.

## POST /api/practice/sessions

```jsonc
// request — the three controls on 01-practice-setup map 1:1 onto columns
{ "studyKitId": "uuid", "mode": "practice" | "mock_exam",
  "questionCount": 10,
  "answerFormat": "multiple_choice" | "written",
  "timerSeconds": 600,
  "lessonIds": ["uuid"] }
// 201
{ "session": { "id": "uuid", "questionCount": 10, "timerSeconds": 600 } }
```

**Screens:** `/practice/setup` (01-practice-setup), `?mock=1`.

`PracticeSetupPage` already holds exactly `count` / `format` / `timer` in state with
these values (`0` for no timer), and its own comment says they map onto
`practice_sessions.question_count / answer_format / timer_seconds`. This is the
cleanest fixture-to-schema alignment in the app.

The count choices in the UI are `[5, 10, 20, 12]` where 12 renders as "All" — "all" is
a count computed from the kit, not a literal 12. The endpoint should take a number and
let the client resolve "all".

## GET /api/practice/lessons?q=

```jsonc
{ "lessons": [
  { "id": "uuid", "title": "SQL JOINs", "titleKm": "…",        // → D1
    "week": 3, "kind": "database",                              // → D6 (vocabulary)
    "mastery": 18,                                              // → D6 (not computable)
    "recommended": true, "needsPractice": true }                // → D6 (thresholds)
] }
```

**Screens:** `/practice/lessons` (02-practice-lesson-selection).

**Fixture replaced:** `practiceLessons`.

### Contradictions

- **`kind` uses a vocabulary that does not exist.** Fixture values are
  `'database' | 'doc' | 'book'`; `lessons.kind` is
  `CHECK (kind IN ('reading','document','video','exercise'))`. `PracticeLessonsPage`'s
  `LessonIcon` switches on `database` / `book` / default. These are *subject* icons,
  not lesson kinds — `'database'` describes what the lesson is about. Nothing in the
  schema stores that. → **D6**
- **`mastery` per lesson is not computable.** `user_topic_mastery` is keyed by
  `(user_id, topic_id)`, and `topics` has `study_kit_id` and `class_id` but **no
  `lesson_id`**. There is no join path from a lesson to its topics, so per-lesson
  mastery has no source. → **D6**
- `recommended` and `needsPractice` are derived from a mastery threshold (the fixture's
  only flagged lesson is at 18%). The cutoff is a product decision, not in the schema.
- The four fixture lessons span different subjects (databases and academic paragraphs),
  so this list is across all of the student's classes and kits, not one class.

## GET /api/practice/sessions/:sessionId

```jsonc
{ "session": { "id": "uuid", "timerSeconds": 600, "answeredCount": 0 },
  "questions": [
    { "id": "uuid", "position": 1,
      "prompt": "…", "promptKm": "…",
      "options": ["…"], "optionsKm": ["…"] } ] }
```

**Screens:** `/practice/session` (03-practice-batch-session).

**Fixture replaced:** `batchQuestions`.

`batchQuestions` **does** carry `correct`, but `PracticeSessionPage` never reads it — it
collects answers and submits. Unlike the quiz, this screen does not need the answer key,
so it should not be sent. → **D8**

## POST /api/practice/sessions/:sessionId/submit

```jsonc
{ "result": { "correct": 8, "answered": 10, "total": 10, "mastery": 80,
              "toReview": 2,
              "weakTopics": ["SQL queries", "Primary keys"],
              "weakTopicsKm": ["សំណួរ SQL", "គន្លឹះចម្បង"] } }   // → D1/D2
```

**Screens:** `/practice/results` (04-practice-results).

**Fixture replaced:** `practiceResult`.

### Contradictions

| Fixture | Schema |
|---|---|
| `correct` | `practice_sessions.correct_count` |
| `answered` | `practice_sessions.answered_count` |
| `total` | `practice_sessions.question_count` |
| `mastery` | `practice_sessions.mastery_percent` |
| `toReview` | **no column** — it is `answered - correct` (10 − 8 = 2 ✓). Compute; do not store. |
| `weakTopics` | `practice_sessions.weak_topics` jsonb. Shape matches **if** the JSONB holds topic *names*. If it holds `topic_id`s the endpoint needs a join to `topics.name`, and `weakTopicsKm` then needs a Khmer name that `topics` does not have. → **D1** |

---

# 8. Flashcards

## GET /api/kits/:kitId/flashcards

```jsonc
{ "deck": { "kitId": "uuid", "total": 12, "dueCount": 12 },
  "cards": [
    { "id": "uuid",
      "term": "Relational database", "termKm": "…",              // → D2
      "definition": "…", "definitionKm": "…",                    // → D2
      "hint": null, "state": "new", "dueAt": "…" }
  ] }
```

**Screens:** `/flashcards/:kitId` (01-flashcards-interface).

**Fixture replaced:** `flashcards`.

### Contradictions

- `term` + `termKm` / `definition` + `definitionKm` against `flashcards.language`, one
  language per row. Doubling the deck rows is cheaper than doubling summaries — card
  text is short — but it is still two generations per deck. → **D2**
- The fixture omits `hint`, `topic` and all SM-2 state, which the schema has and no
  screen reads. Including `state` and `dueAt` costs nothing, and the completion screen
  wants "next review" (`t('flashcards.nextReview')`), which currently renders with no
  data behind it.
- **`FlashcardsPage` computes `total = kit.cardCount * 2`** and cycles the five fixture
  cards with `%`. Prototype padding. The real total is `cards.length`, which must also
  be what `kits[].cardCount` counts — today the two disagree.

## POST /api/flashcards/:cardId/reviews

```jsonc
{ "rating": "again" | "hard" | "good" | "easy" }
→ { "card": { "id": "uuid", "state": "learning", "dueAt": "…", "intervalDays": 1 } }
```

`flashcard_reviews` is append-only and `flashcards` carries the SM-2 columns; both
already exist. No screen submits a rating yet — 01-flashcards-interface only has
reveal/next — so this endpoint has no screen dependency and can wait.

## GET /api/kits/:kitId/flashcards/session-summary

```jsonc
{ "reviewed": 12, "needAnotherLook": 4, "nextReviewAt": "2026-09-15T…" }
```

**Screens:** `/flashcards/:kitId/complete` (02-flashcards-complete).

**No fixture exists.** `FlashcardsCompletePage` hardcodes `needAnotherLook = 4` and
derives everything else from `kit.cardCount * 2`. The screen is built; its data is not
specified anywhere. `needAnotherLook` would be a count of this session's
`flashcard_reviews` rated `again`/`hard`, and `nextReviewAt` is `MIN(due_at)` over the
deck — both cheap, both currently undefined by any fixture. Flagged because it is the
one built screen with no fixture behind it at all.

---

# 9. Classes and assignments

## GET /api/classes

```jsonc
{ "classes": [
  { "id": "uuid", "title": "English for Academic Success", "titleKm": "…",  // → D1
    "description": "…", "descriptionKm": "…",                               // → D1
    "teacher": "Prof. Chanthou",
    "icon": "book",                                                         // → D1, no column
    "weeks": 12, "lessonCount": 36, "lessonsDone": 6 }                      // → D12
] }
```

**Screens:** `/classes` (01-classes-tab-no-upcoming), `/?header=calendar` (class cards).

**Fixture replaced:** `classes`.

### Contradictions

| Fixture | Schema | Cost |
|---|---|---|
| `teacher` | `classes.teacher_id → users.full_name` | one indexed join, cheap |
| `weeks` | `classes.week_count` | rename |
| `icon` | **no column** (`cover_color` exists) | migration → **D1** |
| `lessonCount` | `COUNT(lessons WHERE class_id)` | `lessons_class_id_idx` covers it, cheap |
| `lessonsDone` | `COUNT(lesson_progress WHERE user_id AND status='completed')` over the class's lessons | the schema's own comment on `lesson_progress` says this rollup exists precisely so "6 of 12 lessons completed" is one cheap count — it is intended |
| `titleKm`, `descriptionKm` | single-language columns | → **D1** |

Note `ClassesPage` renders `lessonsCompleted { done: lessonsDone, total: klass.weeks }`
— it divides by **weeks (12)**, not `lessonCount` (36), and so does the progress bar on
`ClassDetailPage`. With the fixture's numbers that reads "6 of 12". Whether the design
means lessons-of-lessons or weeks-of-weeks changes what `lessonsDone` counts. Worth
confirming against `docs/screens/09-classes-assignments/02` before this is built — the
field name says lessons, the denominator says weeks.

## GET /api/classes/:classId

```jsonc
{ "class": { /* as above */ },
  "lessonsByWeek": [
    { "week": 1, "lessons": [
      { "id": "uuid", "title": "Paragraph structure", "titleKm": "…",
        "kind": "document", "status": "in_progress", "done": 1, "total": 3 }
    ] }
  ],
  "materialsByWeek": [ { "week": 1, "files": 1 } ],
  "quizzesByWeek": [
    { "week": 1, "accent": "violet",                                   // → D9
      "quizzes": [ { "id": "uuid", "title": "Database foundations quiz",
                     "titleKm": "…", "questionCount": 10 } ] }
  ],
  "upcoming": [ { "assignmentId": "uuid", "title": "…", "dueAt": "…" } ] }
```

**Screens:** `/classes/:classId` (02-class-course-info-lessons-by-week),
`?tab=quizzes` (03-class-quizzes-folder).

**Fixtures replaced:** `lessonsByWeek`, `materialsByWeek`, `classQuizzes`.

`ClassDetailPage`'s own comment notes that screenshots 02 and 03 are different
iterations of the same screen and that it keeps both sets of content under 02's tab
names. The endpoint above serves the union, which is what the built screen needs.

### Contradictions

- **`lessonsByWeek` grouping.** The schema is flat: `lessons.week_number`, with
  `lessons_class_id_idx ON (class_id, week_number, position)`. Grouping is the service's
  job and the index makes it a single ordered scan. No conflict — just note the API
  returns the grouped shape, not rows.
- **`lesson.done` / `lesson.total`** are `COUNT(lesson_item_progress)` over
  `COUNT(lesson_items)` per lesson. Both indexed. For a 36-lesson class this is one
  `LEFT JOIN … GROUP BY`, not 36 queries — but it has to be written that way. → **D12**
- **`lesson.kind`** uses `'document'` and `'reading'`, both legal in `lessons.kind`.
  This one *does* match, unlike `practiceLessons[].kind`. Two fixtures, same field name,
  two vocabularies. → **D6**
- **`materialsByWeek` has no week to group by.** `class_materials` carries `class_id`
  and a **nullable** `lesson_id`; week is only reachable as
  `class_materials → lessons.week_number`. A material uploaded to the class with no
  lesson cannot be bucketed and will silently vanish from this list. → **D10**
- **`classQuizzes` likewise.** `quizzes` has `class_id` and a nullable `lesson_id`, no
  week. Same problem, same fix. → **D10**
- **`classQuizzes[].tone` is a Tailwind class string** —
  `'bg-violet-100 text-violet-700'` — sitting in what would be an API payload. Compare
  `kits[].accent: 'violet'`, which `KitCard` maps to classes locally. The accent pattern
  is right; `tone` should be a token. Flagged rather than silently renamed because the
  value is currently interpolated straight into a `className`. → **D9**
- `ClassDetailPage` hardcodes `t('classes.quizAvailable', { count: 1 })` and
  `t('classes.quizMeta', { count: 10 })`. Those are the per-week quiz count and
  `quizzes.question_count`.
- The "Upcoming" card hardcodes `ER Diagram Exercises` / `Sep 14` in JSX. That is the
  `upcoming[]` array above.

## GET /api/assignments/:assignmentId

```jsonc
{ "assignment": {
    "id": "uuid",
    "title": "ER Diagram Exercises", "titleKm": "…",          // → D1
    "className": "English for Academic Success", "classNameKm": "…",
    "dueAt": "2026-09-14T…", "dueLabel": "Sep 14",            // → D3
    "overview": "…", "overviewKm": "…",                        // assignments.description
    "instructions": ["…"], "instructionsKm": ["…"],            // jsonb; Km → D1
    "materials": [ { "id": "uuid", "name": "Week 1 — Paragraph structure.pdf" } ],
    "questionCount": 10,
    "allowFileUpload": true },
  "submission": { "status": "not_started", "completed": 0,
                  "files": [], "submittedAt": null } }
```

**Screens:** `/assignments/:id` (04-assignment-detail), `?upload=1` (05-assignment-detail-upload-file).

**Fixture replaced:** `assignment`.

### Contradictions

- `overview` → `assignments.description`. Pure rename; the fixture name reads better on
  the screen and should win.
- `dueLabel: 'Sep 14'` — same formatting problem as everywhere else. → **D3**
- `instructions` maps cleanly to `assignments.instructions jsonb` (GIN-indexed);
  `instructionsKm` has nowhere to go. → **D1**
- `materials[].name` → `assignment_materials.title` / `original_filename`. Cheap join,
  indexed.
- The fixture **flattens the submission into the assignment** — `completed: 0` and
  `status: 'not_started'` sit next to `questionCount`. Those are
  `assignment_submissions.completed_questions` and `.status`, which are **per user**,
  not per assignment. Nesting them under `submission` (as above) keeps the two lifetimes
  separate; the fixture's flat shape invites caching a per-user value as assignment
  metadata. Recommend the nested shape — a small deviation from the fixture, and the
  component reads both from one object today.
- `assignment_submissions` has `UNIQUE (assignment_id, user_id)`, so the submission
  lookup is a single index hit.

## GET /api/assignments/:assignmentId/questions

```jsonc
{ "questions": [
  { "id": "uuid", "position": 1,
    "prompt": "Which item is an entity in a database?", "promptKm": "…",
    "options": ["…"], "optionsKm": ["…"] } ] }               // no `correct` → D8
```

**Screens:** `/assignments/:id/work` (06-assignment-quiz-workspace).

**Fixture replaced:** `assignmentQuestions`.

### Contradictions

`assignmentQuestions` carries `correct` for every question. `AssignmentWorkspacePage`
**never reads it** — it collects `answers` and submits. So the answer key would ship in
the payload of a **graded, teacher-reviewed** assignment with no consumer.

For the quiz screen, shipping `correct` is a requirement (client-side grading, "Show
answer"). Here it is a leak. Recommend omitting it. → **D8**

Questions come from `assignments.quiz_id → quiz_questions`, ordered by `position`
(`UNIQUE (quiz_id, position)`).

## PUT /api/assignments/:assignmentId/submission

```jsonc
{ "answers": { "<questionId>": 0 }, "submit": false }
→ { "submission": { "status": "in_progress", "completed": 2, "updatedAt": "…" } }
```

`assignment_submissions.answers` is JSONB keyed by question id, which matches the
`answers` object `AssignmentWorkspacePage` builds exactly. `submit: true` sets
`status: 'submitted'`, stamps `submitted_at`, and sets `is_late` from `due_at`.

## POST /api/assignments/:assignmentId/submission/files

`multipart/form-data` → `{ "file": { "id", "name", "size" } }`. Writes
`submission_files`. **Screens:** `/assignments/:id?upload=1`.

## POST /api/classes/join

`{ "joinCode": "…" }` → `{ "class": {…} }`. `classes.join_code` is `UNIQUE`. Backs the
"Join a class" button on `/classes`, which has no handler yet.

---

# 10. Profile

## GET /api/profile/summary

```jsonc
{ "summary": { "kits": 4, "cards": 86, "mastery": 72 },
  "activity": [ { "date": "2026-09-08", "studied": true },
                { "date": "2026-09-09", "studied": true } ] }     // → D5
```

**Screens:** `/profile` (01-profile-tab).

**Fixtures replaced:** `profileSummary`, `learningWeek`.

### Contradictions

- `profileSummary.kits` = `COUNT(study_kits WHERE user_id)`, `cards` =
  `COUNT(flashcards WHERE user_id)`, `mastery` =
  `AVG(user_topic_mastery.mastery_percent)`. All three indexed by `user_id`; cheap as
  one query. → **D12**
- The fixture's numbers do not reconcile: `cards: 86` against kit card counts summing to
  36 (12+6+8+10), and `FlashcardsPage` separately assumes `cardCount * 2`. The endpoint
  must pick one definition of "a card" and make `kits[].cardCount`,
  `profileSummary.cards` and the deck length agree.
- **`learningWeek` has no source.** It is `[true, true, false, true, true, false, true]`
  — a positional Mon→Sun array with no dates. Nothing in the schema records daily study
  activity. Reconstructing it means a `UNION ALL` of date-truncated
  `flashcard_reviews.reviewed_at`, `quiz_attempts.started_at`,
  `practice_sessions.started_at` and `chat_messages.created_at`, grouped by day, on
  every profile view. And "which day is Monday" depends on the viewer's timezone, which
  a positional array cannot express. Recommend the dated shape above plus a
  `daily_activity` rollup written on each study event. → **D5**

---

# Fixture → endpoint index

| Fixture | Endpoint | Screens |
|---|---|---|
| `mockUser`, `mockOnboarding` | `GET /api/auth/me` | all authenticated |
| `kits` | `GET /api/kits`, `GET /api/dashboard` | 03-study-kits/01, 02-dashboard/01 |
| `kitFiles` *(unused export)* | `GET /api/kits/:id/sources` | — (documents `status`, `pages`) |
| `kitDetailFiles`, `otherKitFiles` | `GET /api/kits/:id/sources` | 03-study-kits/03 |
| `chapters`, `summary` | `GET /api/kits/:id/summary` | 04-study/02 |
| `summarySections` | `GET /api/kits/:id/summary/chapters/:n` | 04-study/03, 05-tutor/02 |
| `pdfDocument` | `GET /api/sources/:id/document` → **D7** | 04-study/04, 05 |
| `pdfChat` | `GET /api/kits/:id/conversation` (source-scoped) | 04-study/04 |
| `chatMessages`, `chatSuggestions` | `GET /api/kits/:id/conversation` | 05-tutor/01 |
| `quizQuestions` | `GET /api/kits/:id/quiz` | 06-quiz/01, 02 |
| `quizResult` | `POST /api/attempts/:id/submit` | 06-quiz/03 |
| `practiceLessons` | `GET /api/practice/lessons` | 07-practice/02 |
| `batchQuestions` | `GET /api/practice/sessions/:id` | 07-practice/03 |
| `practiceResult` | `POST /api/practice/sessions/:id/submit`, `GET /api/practice/home` | 07-practice/04, 05 |
| `flashcards` | `GET /api/kits/:id/flashcards` | 08-flashcards/01 |
| *(none)* | `GET /api/kits/:id/flashcards/session-summary` | 08-flashcards/02 |
| `classes` | `GET /api/classes`, `GET /api/dashboard` | 09-classes/01, 02-dashboard/03 |
| `lessonsByWeek`, `materialsByWeek`, `classQuizzes` | `GET /api/classes/:id` | 09-classes/02, 03 |
| `assignment` | `GET /api/assignments/:id` | 09-classes/04, 05 |
| `assignmentQuestions` | `GET /api/assignments/:id/questions` | 09-classes/06 |
| `assignmentDates`, `septemberCalendar` | `GET /api/dashboard`, `GET /api/me/agenda` | 02-dashboard/03 |
| `profileSummary`, `learningWeek` | `GET /api/profile/summary` | 10-profile/01 |

Two screens in the registry are deliberately unbuilt and need no endpoint:
`02-phone-otp-verification` and `03-email-code-verification` (no SMS or email provider).
`server/src/notify/index.js` and the `verification_codes` table are already in place for
when there is one.

---

# Open decisions in full

### D1 — Bilingual authored text

**Affects:** kit titles and short titles, class titles/descriptions/icons, lesson
titles, assignment titles and instructions, topic names, source names.

Every one of these is single-column in the schema (`study_kits.title`, `classes.title`,
`lessons.title`, `assignments.title`, `topics.name`) and double-valued in the fixtures.
The client switches language with no refetch, so serving one is not an option without
redesigning the switcher.

Options: paired `_km` columns (simplest, mirrors the fixture exactly, roughly eight
columns across six tables); a `translations` table keyed by
`(entity, id, field, language)` (flexible, adds a join to nearly every read); or JSONB
`{km, en}` per field.

The trigram-index point decides it, I think: `study_kits_title_trgm`,
`classes_title_trgm`, `lessons_title_trgm` and `kit_sources_title_trgm` all exist
because Khmer search must be trigram-based, and a GIN trigram index needs a plain `text`
column. JSONB would break those. That argues for paired columns.

Also needs deciding: **who writes the Khmer.** A student naming their own kit types one
string. `KitsContext.addKit` currently copies `title` into `titleKm` when none is given,
which is the honest behaviour and should probably be the server's too.

### D2 — Bilingual AI-generated text

**Affects:** summaries (title, body, key points), chapter titles and sections, quiz
prompts/options/explanations, flashcard terms and definitions, tutor replies, attempt
takeaways, practice weak topics, chat suggestions.

`ai/types.js` takes `language` as an input and returns one language. The fixtures want
both. Honouring them means every generation runs twice.

The cost is not uniform, which is why this is probably a per-artefact decision:

- **Cheap, worth doubling:** chat suggestions, flashcard terms, quiz options — short,
  generated in batch, generated once.
- **Expensive:** a 12-chapter summary of a five-hour lecture, doubled.
- **Worst:** tutor replies. One extra generation per conversation turn, on the screen
  where the user is watching the stream arrive. `chat_conversations.language` already
  exists, which suggests the schema's author expected a conversation to be
  single-language.

My reading is that the bilingual chat fixtures are an artefact of hand-writing fixtures
in both languages for review, not a requirement that chat history re-renders on a
language switch. That contradicts "the fixture wins", so it is yours to call.

### D3 — Formatting

`size`, `durationLabel`, `sourceLabel`, `dueLabel`, `at`, `month`/`day`, `label`.

The concrete argument against server formatting here: `t()` converts **numbers** to
Khmer digits and passes **strings** through (`formatNumber`, `i18n/index.js`).
`t('assignments.due', { date: 'Sep 14' })` therefore renders Western digits and an
English month inside Khmer UI. Every pre-formatted fixture string has this problem.

Recommend returning raw (`byteSize`, `durationSeconds`, `dueAt`, `createdAt`) and
formatting in the component, which already knows the language. If you want the fixture
shapes kept verbatim, return **both** — raw plus label — and let the client ignore the
label in Khmer.

### D4 — Calendar grid

Return dates; let `MonthCalendar` build the grid. It already owns weekday initials via
`t('dashboard.dayInitial_*')`, so it is already the component that knows the locale's
week shape. Server-side, `today` and the leading-blank count are both guesses about the
viewer.

### D5 — Daily activity

No table records it. Either query four tables per profile view, or write a
`daily_activity (user_id, day, source)` row on each study event and read one indexed
range. The second is a migration plus a write on several hot paths; the first is a
four-way UNION on a screen people open often.

Also: return dates, not a positional array. `[true, true, false, …]` cannot express
which day is which without assuming the viewer's timezone and week start.

### D6 — Per-lesson mastery and lesson `kind`

Two separate problems in one fixture.

**Mastery:** `topics` has no `lesson_id`. There is no join path from a lesson to the
topics a student has mastery in. Needs `topics.lesson_id`, a `lesson_topics` join table,
or deriving lesson mastery from `quiz_attempts` on `quizzes.lesson_id` (which exists).
The third needs no migration but measures something slightly different — quiz
performance, not topic mastery.

**Kind:** `practiceLessons[].kind` is `'database' | 'doc' | 'book'` — a *subject* icon,
with no column. `lessonsByWeek[].kind` is `'document' | 'reading'`, which is
`lessons.kind` and is legal. Two fixtures, one field name, two vocabularies. Pick one,
or name them differently (`kind` vs `subjectIcon`).

### D7 — PDF viewer content

Covered under `GET /api/sources/:sourceId/document`. Short version: the schema stores
chunks for retrieval, not a renderable document. Either render the PDF client-side from
the stored file (normal, and makes the fixture's `sections[]` a mock of a rendered page
rather than a response shape), or extract structure at ingest into a new column or table
(honours the fixture, adds an ingest step).

### D8 — Answer keys in responses

`correct` and `explanation` **must** reach the browser for the quiz screen — it grades
locally and has a "Show answer" button, both by design.

They **must not** reach it for the assignment workspace, which submits to a teacher for
grading; `assignmentQuestions` carries `correct` and the component never reads it.

Same for `batchQuestions` in practice: `correct` is present, unread, and the session is
scored server-side on submit.

Recommend: quiz endpoint includes the key; assignment and practice endpoints omit it.
That is three endpoints with two shapes over the same `quiz_questions` table, so it
should be a deliberate choice rather than a per-endpoint accident.

### D9 — `tone` as Tailwind classes

`classQuizzes[].tone: 'bg-violet-100 text-violet-700'` would put styling in the API.
`kits[].accent: 'violet'` is the same information as a token, mapped in `KitCard`.
Recommend `accent` everywhere. Noted rather than renamed because the value is currently
interpolated straight into a `className`, so changing it is a component change too.

### D10 — Week bucketing without a week column

`class_materials` and `quizzes` both reach a week only through a **nullable**
`lesson_id`. A material or quiz attached to the class but not to a lesson has no week
and drops out of the "by week" lists silently.

Options: add `week_number` to both (denormalised, matches how the screens think);
require `lesson_id` (changes the teacher's upload flow); or add an "unscheduled" bucket
to the UI. The first matches the fixtures.

### D11 — `sourceKind` for a mixed kit

`kits[1]` is `sourceKind: 'youtube'` while its sources are two PDFs, an image, a YouTube
video and a `.docx`. The badge on `KitCard` is a red YouTube play mark, so the field
drives a visible affordance.

Needs a stated rule: first source added, largest, most recent, or the one the kit was
created from. "Created from" matches the flows — `ProcessingSheet` creates the kit *from*
a YouTube URL — and would be a `study_kits.origin_kind` column set once at creation
rather than derived per read. That is a migration, but it removes a per-kit subquery
from the list endpoint.

### D12 — Aggregates in list responses

`kits[].cardCount`, `classes[].lessonCount`, `classes[].lessonsDone`,
`lesson.done`/`lesson.total`, `profileSummary.*`.

Every one is an indexed count, so none is individually expensive. The concern is shape:
the dashboard alone wants kit card counts *and* class lesson progress *and* agenda
items, and the naive implementation is a query per row.

All of them can be written as one `LEFT JOIN … GROUP BY` or a lateral subquery per
endpoint. This is a "decide once and write it that way" item rather than a schema
problem — but if any list grows past a few dozen rows, `lessonsDone` (a join across
`lessons` and `lesson_progress` filtered by user) is the one that will hurt first.

### D13 — `kind: 'document'` is not a legal `kit_sources.kind`

`kit_sources.kind CHECK (kind IN ('pdf','image','youtube','link','topic','text'))` does
not include `'document'`. But the fixture uses it, both dictionaries define
`kits.kind_document` (`km.js:227`, `en.js:228`), and `KitDetailPage` has a document tile
and a `DocMark` icon. A `.docx` upload has nowhere legal to go.

Either add `'document'` to the CHECK — a one-line migration, and `docs/SCHEMA.md` says
text+CHECK was chosen precisely so a new value is one line — or map `.docx` to `'text'`
and delete the client's document vocabulary. The fixture and both dictionaries say add
the value.

---

## Not covered

- **Teacher-side endpoints.** `classes`, `lessons`, `assignments` and `class_materials`
  all have authoring columns (`created_by`, `uploaded_by`, `status: 'draft'`), and
  `users.role` allows `'teacher'`, but `screens.js` registers no teacher screens. There
  are no fixtures, so there is no contract to write yet.
- **`study_folders`.** The table exists; no screen reads it. `/kits/folders/new` creates
  a **kit**, not a folder.
- **`plan_events`, `ai_generations`.** Audit tables, no screen.
- **Rate limiting** beyond the existing login/register limiters.
- **Pagination.** No fixture list is long enough to have needed it and no screen has a
  pager. Worth adding to `GET /api/kits` and `GET /api/classes` before they are built —
  retrofitting an envelope is worse than starting with one.
