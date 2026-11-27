# Build plan

**Status:** Phases 0 and 1 verified | P2.1, P2.2 done | P2.3 to P2.10 and P3.1 to P3.3 merged | P3.5 to P3.9 (5.3 completion + 5.4 disputes) built and verified locally on `feat/monitoring-resilience`: `pnpm verify:trust` 59/59, unit tests 63/63 | Codex wave 2: CX-11 merged | `[~]` = built and verified locally, not yet on the live URL

Rules: tick only when it works end to end on the live URL. "built" = code merged, not yet verified in a browser.
Each task maps to SPEC IDs. Brief sections define WHAT we build; this order follows dependencies and marks at risk.

## Phase 0: foundation (done)
- [x] Docs: CLAUDE, SPEC, ARCHITECTURE, PLAN, INNOVATION, DECISIONS, DEMO, README skeleton
- [x] P0.1 Next 16.4.6 app at root, strict TS, Tailwind 4, shadcn ui + tokens from starter (T-6.4)
- [x] P0.2 Neon project + Drizzle schema (18 tables) + first migration (T-6.4)
- [x] P0.3 Better Auth with roles, login page, guards, proxy redirect (C-3.1.1)
- [x] P0.4 Seed: admin, 2 examiners, 8 candidates, 22 questions, 4 exams in different states (SUB-7.3)
- [x] P0.5 Deployed to Vercel (vercel.json, lazy DB client, /api/health diagnostics) (SUB-7.1)

## Phase 1: core workflow (built, verifying)
- [x] P1.1 App shell per role, nav (UX-8.1)
- [x] P1.2 Admin users: list, create, role, deactivate, reset password + audit log (C-3.1.2)
- [x] P1.3 Question bank CRUD, topics, filters, 3 types + schemes, lock when in published exam (C-3.3.1, C-3.3.2)
- [x] P1.4 Exam CRUD, settings, assign questions with marks, review checklist, publish/unpublish/close (C-3.2.1 to C-3.2.3)
- [x] P1.5 Enrollment UI + candidate home grouped by status + lobby (C-3.4.1 to C-3.4.3)
- [x] P1.6 Attempt start: eligibility, frozen snapshot + shuffle, server deadline (C-3.3.3, T-6.2a, T-6.2d)
- [x] P1.7 Workspace: palette states, server-synced timer, journaled autosave with client_seq, resume, review + idempotent submit, lazy expiry (C-3.5.1 to C-3.5.3, T-6.2b)
- [x] P1.8 Auto grading incl. multi-select rules (C-3.7.1)
- [x] P1.9 Authz pass (C-3.1.3, T-6.1)

### V: verification gate (next, ~1 h) - must pass before Phase 2
- [x] V.0a 5 s in-flight grace at the deadline: saves accepted until deadline + 5 s, finalization after the grace, submitted_at = deadline, candidate UI locks at zero (DECISIONS D10, T-6.2a)
- [x] V.0 Tamper-proof countdown: count down from the last server reading with `performance.now()` (monotonic), resync on every save and on focus; device clock changes have no effect (T-6.2a)
- [x] V.1 Live walkthrough as admin: create user, change role, deactivate, reset password, audit log entries
- [x] V.2 Live walkthrough as examiner: create question of each type, create exam, assign, enroll, checklist, publish, preview (sandbox)
- [x] V.3 Live walkthrough as candidate: home groups, lobby, start, answer all types, flag, refresh mid-exam, offline then online, submit twice, expiry on a short exam
- [x] V.4 Authz probe: candidate on another candidate's attempt, examiner2 on examiner's exam and question, candidate on examiner pages and APIs, unauthenticated API calls; network tab shows no answer key
- [x] V.5 Fixed: login redirect race (blank page after sign-in), empty pass mark stored as 0 (double validation coerced null). Verified on a disposable DB branch: 14 engine checks, role access matrix, admin deactivation, examiner create/assign/enroll/publish, candidate answer/flag/offline/reconnect/auto-submit at deadline

## Phase 2: finish core, then integrate secondary
1. Grading and results (completes the end-to-end workflow)
   - [x] P2.1 Manual grading queue for written answers, marks validated 0..max, feedback, totals recalculated in a transaction, per-answer grading history (previous mark, new mark, grader, comment, time) recorded in audit_log and shown under each answer (C-3.7.2, C-3.7.3, T-6.2c)
   - [x] P2.2 Results review screen, publish gated on all graded, candidate result page, completed exams retained read-only; regrade after publication only with a reason (totals recalculated, old report code shows Replaced); candidates can view their own submitted answers right after submitting, without marks or keys until publication (C-3.8.1, C-3.8.3)
2. Core monitoring (moved up from Phase 3 to protect core marks)
   - [~] P2.3 Live monitor, polled every 5 s: per candidate status NOT_STARTED / WRITING / DISCONNECTED (no save or heartbeat for 30 s) / SUBMITTED, answered count, time left, last seen, signal count; summary counts by status; lazy-finalize expired attempts before building the view (C-3.6.1)
   - [~] P2.4 Announcements: examiner posts, candidates see within one poll (C-3.6.2)
   - [~] P2.5 Incident log: client signals (tab away counted only when >= 1 s, with server-recorded duration; fullscreen exit; offline; reconnect) + server events (device change, late save rejected), "signal for review" wording and disclaimer. Signals NEVER end or penalise an attempt. Client-reported signals are rate limited and capped at 200 per attempt (C-3.6.3, T-6.1)
3. Integrate Codex branch (merge `codex/secondary`, review, wire up)
   - [ ] P2.6 Analytics tab + admin read-only access (C-3.8.2, S-4.5) - Codex CX-2 + CX-5 (discrimination index, quality flags)
   - [ ] P2.7 Imports link + enroll-from-import (S-4.4a, S-4.4b) - Codex CX-1
   - [ ] P2.8 PDF download buttons, verify page (S-4.2, S-4.6) - Codex CX-3
   - [ ] P2.9 Preferences panel + scratchpad inside the workspace (S-4.7, S-4.8) - Codex CX-4
4. - [~] P2.10 Network banner and per-question sync markers (S-4.1)

## Phase 3: innovation 5.3 (see INNOVATION.md)
- [~] P3.1 Heartbeat: server-measured connection gaps recorded as `connection_gap` with duration (I-5.3)
- [~] P3.2 Examiner grants extension: default = measured gap, reason required, total capped (15 min per attempt), attempt row locked while granting, audit log, candidate notified, deadline recomputed (I-5.3)
- [~] P3.3 T-2 min unsynced-answers warning; resume-on-another-device demo path (I-5.3)
- [~] P3.5 Gap causes: presence ledger (hidden and offline time since last ack, monotonic) on heartbeats and saves; server labels each gap background_tab / device_offline / no_contact; only real outages count towards suggestions (I-5.3)
- [~] P3.6 Declare an outage: pick a window, preview who the server measured as cut off, grant each their own measured loss (minus time already given, within the cap) under one audited reason; exam then attempts locked; request key makes it idempotent (I-5.3)
- [~] P3.7 Evidence beside grading: outages with cause, extensions with reasons, signals, device changes, shown on the grader and in dispute evidence (I-5.3, I-5.4)
- [~] P3.8 Device switch verified: answers, flags and deadline restored from the server, device_change recorded, the other device's ledger ignored (I-5.3)
- [~] P3.9 Disputes (second innovation 5.4): raise, evidence pack, reject / regrade / void for everyone, shared scoring rules (voids and overrides) in recalculation, results, PDFs; reports replaced at once; hotspots; candidate timeline; Disputes tab
- [ ] P3.4 (stretch) Fair paper generation: exam blueprint = N questions per (type, difficulty, marks); each candidate draws the least-used questions first with random ties, so every paper has identical difficulty mix and total marks (I-5.2)

## Phase 4: FEATURE FREEZE (final 1:30)
- [ ] P4.1 Demo seed: completed + published exam with graded attempts, ongoing exam with live attempts, upcoming, draft
- [ ] P4.2 README complete, credentials verified on live URL, credits incl. reference repos as design inspiration only (SUB-7.2)
- [ ] P4.3 UI polish: empty states, 375px check, focus, contrast (UX-8.x)
- [ ] P4.4 Rehearse DEMO.md twice on the live URL; final push + deploy before deadline (SUB-7.4)

## Reference repos (reviewed, see DECISIONS D9)
Ideas reimplemented, no code copied: monotonic countdown (V.0), live monitor states (P2.3), extension cap (P3.2), discrimination analytics (CX-5), fair generator (P3.4), grading history and reason-gated regrade (P2.1, P2.2), own-answers view after submit (P2.2), signal cap (P2.5), in-flight grace (V.0a). Sources: online-exam-platform, exam-platform-web, quiz-and-examination-platform, assess.

## Cut list (drop in this order if behind)
1. I-5.2 balanced papers (stretch)
2. Exam summary PDF (keep candidate result PDF)
3. Fullscreen-exit signal (keep tab-hidden, offline and device change)
4. Question import (keep candidate import)
4b. Paste-text question format (optional idea from assess repo)
5. Scroll layout option in workspace prefs (keep font size + theme)
6. Analytics charts reduced to table + one distribution chart
Never cut: server timer, frozen paper, idempotent submit, authz, publish gating, core monitoring, offline sync status.
