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
11. Data: use the seeded Neon database through `.env.local` (already present). Never run `pnpm db:seed`, migrations or any destructive SQL. Test with the demo accounts in `docs/DEMO.md` (password list in `src/server/db/seed.ts`).
12. When a task is done: tick it in the status block, note anything Claude must wire up, then start the next task. Stop after the last task and write a short summary in the status block.

## Tasks (do them in this order)

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

## Status (Codex updates this block)
- [x] CX-1 Bulk import
- [x] CX-2 Analytics
- [x] CX-3 PDF reports and verification
- [x] CX-4 Preferences and scratchpad
- [x] CX-5 Discrimination index and quality flags
- [ ] CX-6 Review fixes
- [x] CX-7 Demo data generator
- [x] CX-8 Admin platform overview
- [x] CX-9 Automated tests
- [ ] CX-10 Accessibility audit

CX-1 through CX-4 are complete on codex/secondary. Live checks covered import validation and account reuse, empty and populated analytics, both PDFs, verification, and scratchpad persistence and ownership. Preferences passed a database save and reload check.

### Notes for Claude (wiring needed, exports, decisions)
- Add the test script from CX-9. Node reported 27 passing tests in 2.32 seconds.
- Add an admin navigation link to /admin/overview. Submission day counts use APP_TIMEZONE, defaulting to Asia/Karachi.
- Run the demo activity command from CX-7. The first codex-dev run produced seven graded attempts and a Strong distractor flag. I lowered two written marks in the generator after that run to place every average score within the requested band. The title guard preserves the existing run.
- CX-5 shows unavailable discrimination when either comparison group has no graded observations for that item. Equal percentages are ordered by attempt ID.
- In exam-workspace.tsx import { PreferencesPanel, applyPreferences } from "./preferences-panel" and { Scratchpad } from "./scratchpad". Render <PreferencesPanel value={prefs} onChange={setPrefs} /> and <Scratchpad attemptId={view.id} initial={view.scratchpad} />. Initialize prefs from getPreferences(actor) imported server-side from "@/server/services/workspace".
- Load getPreferences(actor) alongside the attempt. Pass that value and a state setter to PreferencesPanel. Apply applyPreferences(value) to the workspace, honor data-layout and data-palette-side when arranging questions, and apply the font percentage at the document root for rem-sized controls. Mount Scratchpad with attemptId and initial={view.scratchpad}. It handles Alt+S internally.
- Place DownloadReportButton from features/reports/download-button on authorized result and exam screens with kind="attempt" or kind="exam" and the corresponding id. Verification uses BETTER_AUTH_URL. Changed score totals supersede the previous verification snapshot.
- Add the Analytics tab at /examiner/exams/[examId]/analytics. getExamAnalytics(actor, examId) supplies the summary PDF as well as the screen.
- Link the examiner navigation to /examiner/imports. Candidate creation and enrollment share a transaction. The existing enrollment helper opens its own transaction, so imports apply its checks and insertion within the batch transaction.

### Requests for Claude (changes outside your files)
- This checkout exposes the public URL as auth.options.baseURL. Export authBaseURL from auth.ts if consumers should use the named export.
- CX-6 created 200 accounts in one request on codex-dev, but took 28.1 seconds including route startup and Better Auth hashing. The under-10-second target remains open.
- The enclosing examiner layouts restrict analytics page access to examiners. Provide an admin read-only entry point or update the layouts with appropriate read-only controls.
