# Build plan (~9.5 h remaining)

**Status:** Phase 0 | docs done, awaiting approval to scaffold | next: P0.1

Times are elapsed hackathon clock. Every task maps to SPEC IDs. Tick only when done end to end.

## Phase 0 (to 0:45): foundation
- [x] Docs: CLAUDE, SPEC, ARCHITECTURE, PLAN, INNOVATION, DECISIONS, DEMO, README skeleton
- [ ] P0.1 Scaffold Next 16.4.6 app at root (pnpm), strict TS, Tailwind 4, copy shadcn ui + tokens from `starter/` (T-6.4)
- [ ] P0.2 Neon project + Drizzle schema for all tables + first migration (T-6.4)
- [ ] P0.3 Better Auth with roles, login page, guards, proxy redirect (C-3.1.1)
- [ ] P0.4 Seed: admin, 2 examiners, 3 candidates, topics, 20 questions (SUB-7.3)
- [ ] P0.5 Deploy skeleton to Vercel with env vars, confirm login on live URL (SUB-7.1)

## Phase 1 (to 4:00): core workflow
- [ ] P1.1 App shell per role, nav, status pills (UX-8.1)
- [ ] P1.2 Admin users: list, create, role, deactivate + audit (C-3.1.2)
- [ ] P1.3 Question bank CRUD, topics, filters, 3 types + schemes (C-3.3.1, C-3.3.2)
- [ ] P1.4 Exam CRUD, settings, assign questions with marks, review page, publish/close lifecycle (C-3.2.1, C-3.2.2, C-3.2.3)
- [ ] P1.5 Enrollment UI + candidate home grouped by status (C-3.4.1, C-3.4.2, C-3.4.3)
- [ ] P1.6 Attempt start: eligibility checks, snapshot + shuffle, deadline (C-3.3.3, T-6.2a, T-6.2d)
- [ ] P1.7 Workspace: palette states, timer, autosave with client_seq, resume, review + submit, lazy expiry (C-3.5.1, C-3.5.2, C-3.5.3, T-6.2b)
- [ ] P1.8 Auto grading incl. multi-select rules (C-3.7.1)
- [ ] P1.9 Authz pass: try foreign IDs per role on every endpoint (C-3.1.3, T-6.1)

## Phase 2 (to 7:00): grading, results, secondary
- [ ] P2.1 Manual grading queue + validation + totals (C-3.7.2, C-3.7.3, T-6.2c)
- [ ] P2.2 Results review + publish + candidate result page (C-3.8.1, C-3.8.3)
- [ ] P2.3 Exam analytics (C-3.8.2) + question analytics (S-4.5)
- [ ] P2.4 Network-aware status + offline journal (S-4.1, part of I-5.3)
- [ ] P2.5 Workspace preferences + scratchpad (S-4.7, S-4.8)
- [ ] P2.6 Sandbox preview (S-4.3)
- [ ] P2.7 Bulk import candidates + questions with preview errors (S-4.4a, S-4.4b)
- [ ] P2.8 PDF reports + verification code/QR + public verify page (S-4.2, S-4.6)

## Phase 3 (to 8:30): monitoring + innovation
- [ ] P3.1 Monitor table (polling), events timeline, signal wording (C-3.6.1, C-3.6.3)
- [ ] P3.2 Announcements via heartbeat (C-3.6.2)
- [ ] P3.3 Heartbeat gap detection, server-measured outage, audited extension, device-change event (I-5.3)
- [ ] P3.4 (stretch) Difficulty-balanced paper generation (I-5.2)

## Phase 4 (final 1:30): FEATURE FREEZE
- [ ] P4.1 Realistic demo seed: one completed+published exam, one ongoing, one upcoming, one draft
- [ ] P4.2 README complete, credentials verified on live URL (SUB-7.2)
- [ ] P4.3 UI polish: empty states, 375px check, focus, contrast (UX-8.x)
- [ ] P4.4 Rehearse DEMO.md twice on the live URL; final push + deploy before deadline (SUB-7.4)

## Cut list (drop in this order if behind)
1. I-5.2 balanced papers (stretch)
2. Exam summary PDF (keep candidate result PDF)
3. Fullscreen-exit event and device-change event (keep tab-hidden + connection gap)
4. Question import (keep candidate import)
5. Scroll layout option in workspace prefs (keep font size + theme)
6. Analytics charts reduced to table + one distribution chart
Never cut: server timer, snapshot, idempotent submit, authz, publish gating, offline sync status.
