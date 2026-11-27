# CODEX task board

You are Codex, the second engineer on ExamVault (Technoverse 5.0 Web-e-Thon, 10-hour build).
Claude owns the critical path and merges your branch. Re-read this file before every task.
Status lives at the bottom: update it as you go.

## Read first (once per session)
1. `docs/Web-e-Thon_Problem_Statement.md` sections 3.8 and 4 (the brief is the source of truth)
2. `docs/SPEC.md` rows for your task ID (acceptance criteria = definition of done)
3. `docs/ARCHITECTURE.md` (data model, authorization matrix, invariants)
4. Existing code to copy patterns from:
   - service: `src/server/services/enrollments.ts`, `src/server/services/exams.ts`
   - server action: `src/features/exams/actions.ts` (requireRole + runAction)
   - route handler: `src/app/api/attempts/[id]/submit/route.ts` (errorResponse)
   - client form/list: `src/features/users/users-manager.tsx`, `src/features/exams/enrollment-manager.tsx`
   - page: `src/app/examiner/exams/[examId]/review/page.tsx`

## Hard rules (breaking one means the work is rejected)
1. Work only in the worktree `../examvault-codex` on branch `codex/secondary`. Never touch `main`, never push, never merge, never rebase.
2. Touch ONLY the files listed under your task's "You own". If you need a change anywhere else (schema, shared service, layout, tabs, workspace), write it under "Requests for Claude" at the bottom and continue with a stub that does not break the build.
3. Never edit: `src/server/db/schema.ts`, `drizzle/**`, `package.json`, `pnpm-lock.yaml`, `src/server/auth/**`, `src/server/services/attempts.ts`, `src/features/attempts/workspace/exam-workspace.tsx`, `src/features/attempts/workspace/sync-engine.ts`, `src/features/exams/exam-tabs.tsx`, `src/components/ui/**`, any `docs/*.md` except the status block of this file.
4. No new dependencies. Already installed and allowed: zod, react-hook-form, @tanstack/react-query, recharts (+ `src/components/ui/chart.tsx`), date-fns, lucide-react, @react-pdf/renderer 4.9.0, qrcode 1.5.4. Write a small CSV parser yourself (RFC 4180 quotes).
5. Security (judges test these):
   - Every service function takes `actor: SessionUser` as first argument and checks role AND ownership (examiner: `exam.ownerId === actor.id` via `getManagedExam`; candidate: own attempt only). Foreign ids return `notFound()`, never 403 with details.
   - Every server action / route handler: `requireRole(...)` first, zod-parse input, call the service, map errors with `runAction` / `errorResponse`.
   - Never return `answerKey`, `question_options.is_correct` or other candidates' data to a candidate.
   - Always filter `attempts.isSandbox = false` in results, analytics and reports.
   - Candidates see results/PDF only when `exams.resultsPublishedAt` is not null and the attempt is theirs.
6. Validation: one zod schema in `src/lib/validation/<domain>.ts`, used by the client form AND the server.
7. UI: reuse `src/components/ui/*` and `src/components/shell/*` (PageHeader, Panel, PanelHeader, Stat, NativeSelect, ConfirmAction, useAction, status badges). Every screen needs loading, empty and error states, labelled controls, keyboard access, and works at 375px wide. Tone: calm, institutional. No placeholder or fake data in the UI.
8. Copy: no em dashes anywhere (code, UI text, comments, commits). Monitoring wording says "signal", never "cheating".
9. Next.js 16 has breaking changes: `params`/`searchParams` are Promises, use `PageProps<"/route">` / `RouteContext<"/route">` types, `proxy.ts` not middleware. If unsure, read `node_modules/next/dist/docs/`. Do not use experimental APIs.
10. Before EVERY commit: `pnpm typecheck && pnpm lint && pnpm build` all pass (lint: 0 errors). Then commit with a conventional message referencing the SPEC id, e.g. `feat(imports): candidate CSV import with row errors (S-4.4a)`. No co-author or AI attribution lines. One task per commit (or a few small commits).
11. Data: your `.env.local` now points at your own Neon branch `codex-dev` (a private copy of the database). Test freely there, including creating test accounts and attempts. Never point any command at another database, never run migrations, never edit `.env.local`. Clean up nothing in production: you cannot reach it. Demo accounts are in `docs/DEMO.md` (passwords in `src/server/db/seed.ts`).
12. When a task is done: tick it in the status block, note anything Claude must wire up, then start the next task. Stop after the last task and write a short summary in the status block.

## Tasks (do them in this order: CX-4, CX-5, then CX-6 to CX-10)

### CX-1 Bulk import: candidates and questions (S-4.4a, S-4.4b)
Goal: examiner uploads a CSV or JSON file, sees a validated preview with row-level errors, then commits valid rows in one transaction.
- Candidates file columns: `name,email` (optional `password`). Behaviour: existing candidate emails are reused; new emails create candidate accounts with `insertUserWithPassword` (from `src/server/services/users.ts`, import only, do not modify) using the given password or a generated one (12 chars, letters + digits) that is shown ONCE in the result table with a copy button. Optional: enroll all rows into a chosen exam the examiner owns (use `enrollCandidates` from `src/server/services/enrollments.ts`). Reject emails that belong to admin/examiner accounts with a row error.
- Questions file columns: `type,topic,difficulty,marks,stem,options,correct,scheme,rubric` where `options` is `|`-separated and `correct` is the 1-based indexes `|`-separated (e.g. `1|3`). JSON accepts an array of objects with the same fields (options as array). Validate each row with the existing `questionSchema` (`src/lib/validation/questions.ts`) after mapping, so single needs exactly one correct option, etc. Commit with the same logic as `saveQuestion` (call it per row inside your own transaction loop is fine, or call `saveQuestion` per row).
- Preview UX: drop zone (native `<input type="file" accept=".csv,.json">` styled), file size limit 1 MB, max 500 rows, a table showing row number, parsed values and errors (field + message), counts "N valid, M with errors", a "Download error report (CSV)" button, and "Import N valid rows" (disabled when 0). After import show a success summary.
- Add downloadable template files: `public/templates/candidates.csv`, `public/templates/questions.csv` with 3 realistic fictional rows each.
- You own: `src/server/services/imports.ts`, `src/lib/validation/imports.ts`, `src/lib/csv.ts`, `src/features/imports/**`, `src/app/examiner/imports/**`, `public/templates/**`.
- Route: `/examiner/imports` (page with two tabs: Candidates, Questions). Claude will add the nav link.

### CX-2 Exam analytics and question analytics (C-3.8.2, S-4.5)
Goal: real performance insight from actual submissions (exclude sandbox, include only finalized attempts: status `submitted` or `auto_submitted`).
- Exam level: attempts finalized, mean, median, highest, lowest, pass rate (if `passMark` set), score distribution histogram (10 buckets of percentage) with recharts, per-candidate table (name, score, percent, status, grading state) sortable by score.
- Question level (one row per paper item, keyed by `itemId` = question id; paper lives in `attempts.paper` jsonb, answers in `answers`): attempts seen, skip rate (no answer or empty), correct rate for objective items (`answers.autoScore === item.marks`), average score vs max, observed difficulty label (facility index: >0.7 easy, 0.3 to 0.7 moderate, <0.3 hard) next to the authored difficulty, and for objective items the most chosen wrong option text (from the paper options). Highlight "frequently skipped" (skip rate >= 30%) and "commonly incorrect" (correct rate < 40%).
- Empty state when no finalized attempts yet.
- You own: `src/server/services/analytics.ts`, `src/features/analytics/**`, `src/app/examiner/exams/[examId]/analytics/page.tsx`.
- Access: owner examiner (and admin read). Claude will add the "Analytics" tab.

### CX-3 PDF reports and verification (S-4.2, S-4.6)
Goal: downloadable, readable PDFs from real data plus a public verification page that exposes minimum data.
- Candidate result PDF: `GET /api/reports/attempt/[attemptId]`. Allowed: the attempt's candidate only when `exams.resultsPublishedAt` is set; the owner examiner; admin. Content: exam title, candidate name, submitted at, score / max, percent, pass/fail if pass mark set, per-question marks table (number, type, marks awarded, max), verification code + QR code (PNG data URL via `qrcode`) linking to `${BETTER_AUTH_URL}/verify/<code>`, issue date. Do not include correct answers or other candidates.
- On first download create a `result_reports` row (code: 128-bit random, base32 or base64url, unique; `scoreSnapshot`, `maxSnapshot`, `issuedBy`); later downloads reuse the existing non-revoked row for that attempt.
- Exam summary PDF: `GET /api/reports/exam/[examId]` for owner examiner / admin: exam details, statistics (reuse your analytics service), per-candidate score table. No verification code needed.
- Public page `/verify/[code]` (no login, add nothing to proxy matcher): shows Valid / Revoked / Not found, exam title, candidate name masked (first name + last initial, e.g. "Ayesha M."), score snapshot / max, issue date. Nothing else. Also a small form on `/verify` to type a code.
- Render PDFs with `@react-pdf/renderer` (`renderToBuffer`) in a Node runtime route (`export const runtime = "nodejs"`). Return `Content-Disposition: attachment; filename="..."`.
- You own: `src/server/services/reports.ts`, `src/features/reports/**`, `src/app/api/reports/**`, `src/app/verify/**`.
- Claude will place the download buttons on the result and exam pages; also export a small client component `DownloadReportButton` from `src/features/reports/download-button.tsx` for that.

### CX-4 Workspace preferences and scratchpad (S-4.7, S-4.8)
Build the pieces; Claude integrates them into the exam workspace.
- Preferences: font size (90, 100, 115, 130 percent), theme (system, light, dark, high contrast), layout (one question per page, or all questions in a scrolling list), palette side (left, right). Persist per user in `user_preferences` (upsert). Service `getPreferences(actor)` / `savePreferences(actor, input)`, zod schema, server action, and a client component `PreferencesPanel({ value, onChange })` that saves with optimistic update and a toast on failure. Also export `applyPreferences(prefs)` that returns the CSS variables/classes to apply (high contrast: add a `.contrast` class; define its CSS variables in `src/features/attempts/workspace/contrast.css` with WCAG AAA-ish contrast).
- Scratchpad: per attempt (`attempts.scratchpad` text column, max 20,000 chars). Service `saveScratchpad(actor, attemptId, text)` (owner only, only while `status = in_progress` and before `deadlineAt`), route `PUT /api/attempts/[id]/scratchpad`, client component `Scratchpad({ attemptId, initial })` with debounced autosave (1 s), saved/saving/offline indicator, character count, clear button with confirm, and a localStorage fallback when offline (key `ev:scratch:<attemptId>`). Make it clear it is never graded.
- You own: `src/server/services/workspace.ts`, `src/lib/validation/workspace.ts`, `src/features/attempts/workspace/preferences-panel.tsx`, `src/features/attempts/workspace/scratchpad.tsx`, `src/features/attempts/workspace/contrast.css`, `src/features/attempts/workspace/workspace-actions.ts`, `src/app/api/attempts/[id]/scratchpad/route.ts`.

### CX-5 Question analytics: discrimination and quality flags (S-4.5, added after the reference-repo review)
Extend your CX-2 analytics (same files you already own) with item-analysis measures judges recognise:
- Rank finalized, non-sandbox attempts by percentage. Upper group = top 27%, lower group = bottom 27% (group size = max(1, round(n * 0.27))).
- Discrimination index per question = (share correct in upper group) - (share correct in lower group), counting only group members who received that item (papers can differ). Range -1 to +1. Label: >= 0.3 good, 0.1 to 0.3 fair, < 0.1 review (negative = "Review: stronger candidates did worse").
- "Correct" for objective items = full marks; for written items = at least 50% of the item's marks once graded. Exclude written answers still pending grading from both measures.
- Flags (show as badges with plain-language tooltips): fewer than 5 graded responses -> "Not enough data" (no other flag); correct rate < 20% -> "Very hard or flawed"; > 95% -> "Too easy"; discrimination < 0.1 -> "Review wording"; skip rate >= 30% -> "Frequently skipped"; most chosen wrong option picked by >= 40% -> "Strong distractor".
- Add a short "How to read this" explainer panel on the analytics page.
- Keep these as pure functions in your analytics service (no extra queries per question) and keep sandbox attempts excluded.
- You own: the same files as CX-2. Reimplement from this description; do not copy code from any other repository.

### CX-6 Review fixes for CX-1 to CX-3 (do this before CX-7)
Claude reviewed your branch: security and validation are correct. Fix these quality issues:
1. QR link host (`src/features/reports/pdf.tsx`): import `authBaseURL` from `@/server/auth/auth` (import only, do not edit that file) and build the verify URL from it. `VERCEL_URL` is a per-deployment URL that may be behind Vercel login protection, so judges scanning the QR could hit a login wall.
2. Verify page (`src/app/verify/[code]/page.tsx`, `src/app/verify/page.tsx`): make it a trustworthy public page. Centered card with the ExamVault `Logo` (`src/components/shell/logo.tsx`), a large status block (Valid: success colors + ShieldCheck icon + "This result report is authentic"; Revoked: warning colors + "This report was replaced by a newer version (for example after a regrade)"; Not found: neutral + "No report matches this code. Check the code and try again."), the four fields with proper `dt` styling, a footnote "For privacy this page shows only the exam, a shortened name, the score and the issue date.", and a "Verify another code" link. The `/verify` form: labelled input (use `Field`, `FieldLabel`), helper text "The code is printed under the QR code on the report", error state for malformed codes instead of redirecting to `/verify/invalid`. Add `export const metadata` titles. Works at 375px.
3. Import results summary (`src/server/services/imports.ts`, `src/features/imports/**`): return and show separate counts: new accounts created, existing accounts reused, enrollments added, questions created, rows skipped with errors. Today `imported` counts reused accounts as imported, which is misleading.
4. Import performance: hash passwords for new accounts BEFORE opening the transaction (collect valid rows first, then `hashPassword` from `better-auth/crypto`, then one transaction that inserts users with the precomputed hash). You will need a small local insert helper in your service instead of `insertUserWithPassword` for this path; keep `providerId: "credential"`, `accountId = userId`, `emailVerified: true` exactly as that helper does. Add `export const maxDuration = 60` to the upload route. Goal: 200 rows commit in under 10 s.
5. Analytics: show a visible note and count when finalized attempts still have written answers pending grading ("3 attempts include ungraded written answers; scores may rise"). Run prettier on `src/app/examiner/exams/[examId]/analytics/page.tsx` (it is unformatted).
6. Result PDF: add the candidate's percent and Pass/Fail (when pass mark set), and a line under the QR with the plain code text and "Verify at <host>/verify". Keep it to one page for up to 40 questions (smaller table font if needed).
- You own: the files from CX-1 to CX-3 only.

### CX-7 Demo data generator (feeds Phase 4 and makes analytics meaningful)
Goal: one command creates realistic activity on top of the base seed, using the REAL services so every invariant holds.
- File: `src/server/db/demo-activity.ts`, run with `pnpm exec tsx --conditions=react-server --env-file=.env.local src/server/db/demo-activity.ts`. Do NOT add a package.json script (Claude will).
- Build `SessionUser` objects from the seeded users (query `user` by email) and call the services directly: `startAttempt`, `saveAnswers`, `submitAttempt` from `src/server/services/attempts.ts` (import only).
- Data to create:
  - Create a NEW exam titled "Algorithms Final (demo)" through `createExam`, `setExamQuestions` (the examiner's Data Structures questions), `enrollCandidates` and `publishExam`, with a window that is open now (services cannot backdate windows, and existing seeded exams must stay untouched). Have all 7 seeded candidates start, answer and submit with a realistic spread: 2 strong (85 to 100%), 3 average (50 to 75%), 2 weak (20 to 45%), at least one skipped question per weak candidate, one candidate who picks the same wrong option on a multi question (to show "Strong distractor"). Written answers: realistic short paragraphs of varying quality.
  - Grade written answers by updating `answers.manual_score` (0..item marks, half steps) and `graded_by` / `graded_at`, then call `recalcAttempt` (exported from attempts.ts) inside a transaction. Then close the exam with `closeExam(actor, examId, finalizeAllForExam)` and set `exams.results_published_at = now()`.
  - "Web Engineering Quiz" (ongoing): 3 candidates start and save 2 to 4 answers each but do NOT submit (live monitor demo). Leave Ayesha NOT started so the presenter can start her live.
- Idempotent: if an exam titled "Algorithms Final (demo)" already exists, print a message and exit without changes.
- Print a summary table at the end. Run it on `codex-dev` and confirm the analytics page and PDFs look meaningful.
- You own: `src/server/db/demo-activity.ts`.

### CX-8 Admin platform overview (brief section 2: "overall platform operations")
- Page `src/app/admin/overview/page.tsx` + service `src/server/services/platform.ts` (admin only, `requireRole`/`requirePageRole("admin")`, every function re-checks `actor.role === "admin"`).
- Content: stat tiles (active users by role, deactivated accounts, exams by effective status using `effectiveStatus`, candidates writing right now, attempts submitted today, written answers awaiting grading across the platform), a "Needs attention" list (exams whose window ended with ungraded attempts; published exams starting within 24 h with zero enrolled; deactivated accounts with an in-progress attempt), a 14-day bar chart of submitted attempts (recharts via `src/components/ui/chart.tsx`, sandbox excluded), and the 10 latest audit entries with a link to `/admin/audit`.
- Server-rendered, no client polling needed. Empty states for a fresh database. Works at 375px.
- You own: `src/app/admin/overview/**`, `src/server/services/platform.ts`, `src/features/platform/**`. Claude will add the nav link.

### CX-9 Automated tests for pure domain logic (Technical Quality)
- Use Node's built-in runner, no new dependencies: `pnpm exec tsx --conditions=react-server --test "tests/**/*.test.ts"` (Claude will add a `test` script).
- Files under `tests/` only. Import modules through relative paths or the `@/` alias (tsx resolves tsconfig paths).
- Cover at least:
  - `src/server/domain/grading.ts` `scoreItem`: single (correct, wrong, two selected), multi all_or_nothing (exact, subset, superset), multi partial (2 of 3 correct, one wrong cancels one right, all options selected = 0, never negative), written returns null, unanswered = 0.
  - `src/lib/domain/exam-status.ts` `effectiveStatus` boundaries (exactly at start, exactly at end, completed overrides).
  - `src/lib/validation/questions.ts`: single with 0 or 2 correct rejected, multi with 0 correct rejected, duplicate options rejected, written with options rejected, half marks ok, 1.25 rejected.
  - `src/lib/validation/exams.ts`: end before start, duration longer than window, pass mark above total.
  - `src/lib/csv.ts`: quoted commas, escaped quotes, CRLF, embedded newline line numbers, unclosed quote error, 501 rows error.
  - Your analytics math (export the pure part if needed: median of even/odd counts, distribution buckets incl. 100%, discrimination with tiny groups).
- Target: 50+ assertions, all passing, runs in under 5 s.
- You own: `tests/**`, plus pure-function exports you add to your own files.

### CX-10 Accessibility and responsive audit (report only, no code changes outside your files)
- Read every page and component under `src/app/**` and `src/features/**` (both Claude's and yours) and write `docs/AUDIT.md`: a table of findings with file:line, WCAG 2.1 AA criterion, severity (blocker, major, minor), and the exact fix. Check: labels and accessible names, heading order, focus visibility, keyboard traps in dialogs and sheets, color-only status signals, contrast of muted text on canvas, touch targets under 44 px on mobile, tables overflowing at 375 px, live regions for timer and save status, error messages tied to fields with `aria-describedby`.
- Fix the findings that are in files you own; list the rest for Claude.
- You own: `docs/AUDIT.md` (create it; this is the only docs file you may write besides this board's status block).

## Status (Codex updates this block)
- [ ] CX-1 Bulk import
- [ ] CX-2 Analytics
- [ ] CX-3 PDF reports and verification
- [ ] CX-4 Preferences and scratchpad
- [ ] CX-5 Discrimination index and quality flags
- [ ] CX-6 Review fixes
- [ ] CX-7 Demo data generator
- [ ] CX-8 Admin platform overview
- [ ] CX-9 Automated tests
- [ ] CX-10 Accessibility audit

### Notes for Claude (wiring needed, exports, decisions)
-

### Requests for Claude (changes outside your files)
-
