# ReanMate — Screen Inventory (59 screens)

| # | Folder | Screens | Covers |
|---|--------|---------|--------|
| 01 | auth-onboarding | 8 | Phone signup, OTP, email code, role pick, 3-step survey, Free vs Plus |
| 02 | dashboard | 4 | Populated home, home with Classes nav, owl/calendar header, empty home |
| 03 | study-kits | 21 | Kits tab, create folder, file list, YouTube URL add + processing, plus the full 2026-09 revision (07–21) |
| 04 | study-mode-summaries | 5 | Study mode, summaries, PDF viewer + study actions |
| 05 | ai-tutor-chat | 2 | Chat interface, collapsible tutor drawer |
| 06 | quiz | 3 | Controls, answer explanation, results |
| 07 | practice | 7 | Setup, lesson select, batch session, results, mock exam, progress |
| 08 | flashcards | 2 | Card interface, completion |
| 09 | classes-assignments | 6 | Classes tab, course info, quizzes folder, assignment detail/upload/workspace |
| 10 | profile | 1 | Profile tab |

Files are numbered inside each folder in flow order (01 → n), and the `reanmate-` prefix was dropped since the folder already says it.

## 2026-09 revision

`02-dashboard/04` and `03-study-kits/07–21` are a later pass over the home and
study-kit flows, filed alongside the originals rather than replacing them. The
revision covers the empty and populated kits tab, kit naming, the empty kit
detail, the add-material menu and all four input sheets (photo, PDF, YouTube,
topic), each of their analyzing states, the ready-to-study material row, and the
study-options grid. Where it disagrees with `01–06`, the revision is newer.

Matching icons ship in `docs/brand/icons/` — 19 SVGs on a 64×64 viewBox with the
palette hardcoded (blue `#1677E8`, yellow `#FFD42F`, green `#18B96A`). They are
reference art, not wired into `client/public/icons.svg`.
