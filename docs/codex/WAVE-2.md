# Codex wave 2: master prompt

Paste everything below the line into Codex as one message.

---

You are Codex, the second engineer on ExamVault (Technoverse 5.0 Web-e-Thon). Claude owns the critical path,
reviews your work and merges it. A third session (UI) is redesigning screens on `main`. Three writers share one
repository, so the ownership rules below are strict: breaking one means the work is thrown away.

## 0. Setup (do exactly this, once)
1. Work in your existing worktree `../examvault-codex`. Do not open or edit any other folder.
2. Create a fresh branch from Claude's integration branch (it already contains `main` plus monitoring):
   `git fetch origin && git switch -c codex/wave-2 origin/feat/monitoring-resilience`
3. Carry over your two unmerged commits: `git cherry-pick cc502df 8218430`. If a cherry-pick conflicts, keep
   `origin/feat/monitoring-resilience`'s side for every file you do not own (section 2), finish, and note it in your status file.
4. `pnpm install --frozen-lockfile`. Your `.env.local` must point at the isolated `codex-dev` Neon branch. Never use the
   demo database. Check first: `DATABASE_URL` must not contain `ep-old-flower`. If it does, stop and write that in your status file.
5. Read, in order: `CLAUDE.md`, `docs/Web-e-Thon_Problem_Statement.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`,
   `docs/DECISIONS.md` (especially D10 to D12), `docs/AUDIT.md`. Next.js 16 differs from what you know: read
   `node_modules/next/dist/docs/` before writing route or page code (`params` are Promises, `proxy.ts`, `PageProps<"/route">`).

## 1. Hard rules
1. Branch `codex/wave-2` only. You may `git push origin codex/wave-2`. Never push, merge or rebase anything else; never touch `main`.
2. Edit ONLY the files a task lists under "You own". Everything else is read-only. If you need a change elsewhere, write it
   under "Requests for Claude" in your status file and continue with something that still builds.
3. Never edit (read-only, owned by Claude or the UI session):
   `src/server/db/schema.ts`, `drizzle/**`, `package.json`, `pnpm-lock.yaml`, `src/server/auth/**`, `src/proxy.ts`,
   `src/server/services/attempts.ts`, `src/server/services/monitoring.ts`, `src/server/services/presence.ts`,
   `src/features/monitoring/**`, `src/features/attempts/**` (all of it), `src/lib/domain/monitoring.ts`,
   `src/lib/validation/monitoring.ts`, `src/lib/tokens/**`, `src/app/layout.tsx`, `src/app/globals.css`,
   `src/components/**` (ui and shell), `src/app/login/**`, every `layout.tsx`, `src/features/exams/exam-tabs.tsx`,
   `src/components/shell/nav.ts`, `CLAUDE.md`, `CODEX.md`, and every `docs/*.md` file except your own new files under `docs/codex/` and `docs/drafts/`.
4. No new dependencies and no migrations. No destructive SQL outside the rows your own scripts create, and every script cleans up after itself.
5. Security invariants (judges test these): every service takes `actor: SessionUser` first and checks role and ownership;
   foreign ids return `notFound()`; candidates never receive `answerKey` or `is_correct`; every aggregate filters `isSandbox = false`;
   candidates see results only after `resultsPublishedAt`. Monitoring wording is "signal for review", never "cheating".
6. One zod schema per input, shared by the client form and the server.
7. Copy: no em dashes anywhere (code, UI, comments, commit messages, docs). Calm, institutional tone. No fake data in the UI.
8. Before EVERY commit: `pnpm typecheck && pnpm lint && pnpm build` (0 lint errors) plus `pnpm test`. Conventional commits that reference
   SPEC ids, e.g. `test(authz): sweep every service as the wrong actor (T-6.1)`. No co-author or AI attribution lines. One task per commit or a few small commits.
9. Never mark a task done unless you ran it and saw it pass. Report numbers (checks passed, timings), not adjectives.
10. Status file: create and maintain `docs/codex/WAVE-2-STATUS.md` with a checkbox per task, what you verified and how,
    "Notes for Claude" (wiring, exports, package.json scripts to add) and "Requests for Claude". Update it after every task.

## 2. Tasks, in this order
Time box each task. If one runs over by 50 percent, commit what works behind a clear note and move on.

### CX-11 Authorization sweep (T-6.1, invariant 5), about 60 min
Goal: one script that proves every protected service rejects the wrong actor. This is the first thing judges probe.
- Build fixtures in the script itself (own exam, enrollment, attempt, written answer, published result) using services, then delete the exam at the end (cascade).
- For every exported service function in `src/server/services/*.ts` that takes an actor, call it as: wrong role, same-role non-owner
  (examiner2, other candidate), and the legitimate owner. Assert the exact outcome: `NOT_FOUND` for foreign ids, `FORBIDDEN` for wrong role,
  success for the owner, and read-only behaviour for admin where the authz matrix in `ARCHITECTURE.md` says so.
- Also assert data minimization: candidate-facing results (`getAttemptView`, `heartbeat`, `getCandidateResult` before and after publication)
  never contain `answerKey`, `isCorrect`, `correct`, another candidate's id, or an extension reason. Do it by scanning `JSON.stringify` output.
- Output: a PASS/FAIL line per check and a matrix summary (service x actor). Exit code 1 on any failure.
- If you find a real authorization bug, do not fix it in a file you do not own: write the exact reproduction in "Requests for Claude" and mark the check as a known failure.
- You own: `scripts/verify-authz.ts`. Run with `npx tsx --conditions=react-server --env-file=.env.local scripts/verify-authz.ts`.

### CX-12 Concurrency and resilience load test (T-6.2, I-5.3), about 60 min
Goal: evidence that the attempt engine holds under realistic pressure.
- Create 30 temporary candidates (prefix `load-`, cleaned up at the end) enrolled in a temporary exam with 10 questions.
- Simulate concurrently per candidate: 40 saves with shuffled (out-of-order) client sequence numbers and duplicated retries,
  heartbeats every few seconds with a few client signals, one device switch, then 3 simultaneous submit calls.
- Assert: the stored answer equals the highest sequence sent for every item; exactly one finalization event per attempt; totals equal
  the recomputed sum; saves after the deadline are rejected with `DEADLINE_PASSED` and logged (use a second exam with a 1 minute window and backdated deadline);
  no unhandled errors.
- Report p50, p95 and max latency per operation (save, heartbeat, submit) and total wall time. Note Neon free tier cold starts separately.
- You own: `scripts/load-attempts.ts`.

### CX-13 Bulk import performance (S-4.4a, open from CX-6), about 45 min
Goal: 200 new candidate accounts imported in under 10 seconds (currently about 28 s).
- Profile first and write the measured split (parse, hashing, inserts, enrollment) in your status file.
- Likely fixes: hash passwords with bounded parallelism instead of serially, insert users and accounts in batched multi-row inserts inside one
  transaction, enroll with one multi-row insert. Keep every existing validation and the one-time password display.
- Keep row-level errors identical. Re-run your CX-1 checks to prove no regression.
- If hashing must go through Better Auth internals you cannot touch, request the helper in "Requests for Claude" and do the rest.
- You own: `src/server/services/imports.ts`, `src/lib/validation/imports.ts`, `src/lib/csv.ts`, `src/features/imports/**`.

### CX-14 Live demo world (P4.1, demo support), about 60 min
Goal: one command that produces a realistic, demo-ready monitoring scene so the 15 minute demo never depends on luck.
- Create or reset (idempotent by title, `--reset` flag) an ongoing exam "Live Demo: Networks Midterm" owned by `examiner@examvault.test`
  with 8 questions (mixed types) and 8 enrolled candidates in different live states: 3 writing (fresh `lastSeenAt`), 1 disconnected
  (`lastSeenAt` 2 minutes ago), 1 with a server-measured connection gap of about 3 minutes, 1 with a few tab-away and full screen signals,
  1 submitted, 1 not started. Post one announcement. Grant one extension with a reason.
- Use the real services wherever possible (`startAttempt`, `saveAnswers`, `heartbeat` from `attempts.ts`, `postAnnouncement` and `grantExtension` from
  `monitoring.ts`), only backdating timestamps directly where time travel is needed. Never touch other exams.
- Also print a short "what to show" list with URLs and which candidate demonstrates what.
- You own: `src/server/db/demo-live.ts`. Claude will add the package.json script; tell him the exact command in your status file.

### CX-15 Admin read-only exam views (C-3.1, C-3.8.2, authz matrix "read all"), about 45 min
Goal: admins can inspect any exam's analytics and live monitor without edit controls (open request from wave 1).
- Routes: `/admin/exams` (all exams with owner, status, counts), `/admin/exams/[examId]/analytics` (reuse `getExamAnalytics` and the analytics
  components), `/admin/exams/[examId]/monitor` (render the existing `MonitorBoard` from `src/features/monitoring/monitor-board.tsx`; the API already
  allows admin and the board hides actions when `canAct` is false). Each page: `requirePageRole("admin")`, loading, empty and error states, works at 375 px.
- Do not modify the monitor or analytics components. If a prop is missing, request it.
- You own: `src/app/admin/exams/**` (new files only). Claude adds the nav link.

### CX-16 Accessibility fixes from your audit (UX-8.x, WCAG 2.1 AA), about 60 min
Apply the fixes from `docs/AUDIT.md` ONLY in these files, with minimal attribute-level diffs (ids, `aria-describedby`, `aria-invalid`, focus on
first invalid field, labelled keyboard-focusable scroll regions, 44 px touch targets). Do not restyle anything: the UI session owns the visual design.
- You own: `src/features/exams/exam-form.tsx`, `src/features/questions/question-form.tsx`, `src/features/users/users-manager.tsx`,
  `src/features/exams/question-picker.tsx`, `src/app/admin/audit/page.tsx`, `src/features/analytics/insights.tsx`, `src/features/imports/import-manager.tsx`.
- Leave the login form and the exam workspace findings to Claude: list them under "Requests for Claude" with the exact fix.
- Verify with keyboard only (Tab, Shift+Tab, Enter, Escape) at 375 px and 1280 px and record what you checked.

### CX-17 Submission documents, drafts (SUB-7.x), about 60 min
Write drafts Claude will review and move into place. Every claim must be checked against the code; cite file paths.
- `docs/drafts/README.md`: what ExamVault is, the three roles, feature map against the brief sections 3 to 5, architecture summary,
  local setup (pnpm, env vars from `.env.example`, migrate, seed), scripts (`test`, `verify:*`), demo accounts, deployment (Vercel Hobby + Neon free),
  security model (invariants), innovation 5.3 summary, credits (reference repos as design inspiration only, no code copied; Noto Animated Emoji CC BY 4.0; libraries).
- `docs/drafts/JUDGE-QA.md`: 25 hard questions a judge may ask (security, fairness, failure cases, scale, why polling, what if the server dies,
  what if the clock is changed, can a candidate fake a signal, can an examiner abuse extensions) with precise answers and the code path that proves each.
- `docs/drafts/DEMO-SCRIPT.md`: a 15 minute minute-by-minute script that uses CX-14's demo world, including the offline demo and the extension flow,
  with a fallback line for each step if something fails live.
- You own: `docs/drafts/**`.

### CX-18 (stretch) Unit tests for pure logic (T-6.3), remaining time
Add focused tests for `src/lib/csv.ts` (quotes, CRLF, BOM, empty lines), the validation schemas in `src/lib/validation/` (boundaries), and
analytics helpers. No database. You own: new files `tests/csv.test.ts`, `tests/validation.test.ts`, `tests/analytics-helpers.test.ts`.

## 3. Out of scope for you (Claude owns)
Innovation features (5.2 fair papers and any second challenge), the attempt engine, monitoring, the exam workspace, schema and migrations,
layouts, navigation, package.json scripts, merges, deployment and the live URL. Do not start any of these even if you finish early:
pick the stretch task instead.

## 4. When you finish
Push `codex/wave-2`, make sure `docs/codex/WAVE-2-STATUS.md` lists every task with evidence, every package.json script Claude should add,
and every request. Then stop.
