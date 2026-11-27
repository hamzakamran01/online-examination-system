# Architecture

## Stack lock
| Choice | Why (one line) |
| --- | --- |
| Next.js 16.4.6 App Router, React 19.3, TS strict | One deployable for UI + API; server components keep keys and queries on the server |
| Tailwind 4.3.3 + shadcn (base-ui) | Accessible primitives already proven in `starter/`; fast, consistent UI |
| Postgres (Neon free) | Relational integrity, transactions, row locks, constraints: exactly what attempts and grading need |
| Drizzle ORM + drizzle-kit + `pg` | Typed schema as code, real migrations, interactive transactions with `SELECT ... FOR UPDATE` |
| Better Auth (email/password + admin plugin) | DB sessions, hashed passwords, role field, admin user management without hand-rolled crypto |
| zod 4 | One schema validates the form and the server input |
| TanStack Query | Polling for monitor/announcements, retries, cache; no paid realtime service |
| @react-pdf/renderer + qrcode | PDF generated server side from DB data; QR is local, no external API |
| IndexedDB (idb-keyval) answer journal | Survives refresh, crash and power loss on the same device |

## Deployment (free tier only, no billing details)
- Vercel Hobby: Next.js app (Node runtime for all DB routes).
- Neon Free: Postgres, pooled connection string in `DATABASE_URL`.
- No cron needed: attempt expiry is finalized lazily (see invariant 4).
- Env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `REPORT_SIGNING_SECRET`. All listed in `.env.example`.

## App structure
```
src/
  proxy.ts                          redirect unauthenticated users (cosmetic; real checks in services)
  app/
    (auth)/login                    sign in
    admin/                          users, audit log
    examiner/                       dashboard, bank, imports
    examiner/exams/[examId]/        overview | questions | candidates | review | monitor | grading | results | analytics
    candidate/                      home (available, upcoming, completed)
    candidate/exams/[examId]/       lobby (instructions, start)
    attempt/[attemptId]/            exam workspace (also used for sandbox)
    candidate/results/[attemptId]   own published result
    verify/[code]/                  public report verification
    api/auth/[...all]               Better Auth handler
    api/attempts/[id]/...           state, answers, heartbeat, events, submit
    api/reports/...                 PDF downloads
  server/
    db/schema.ts client.ts seed.ts
    auth/auth.ts guards.ts
    services/*.ts                   one file per domain
  features/<domain>/                components + server actions
  components/ui | components/shell
  lib/validation/*.ts  lib/time.ts  lib/offline-queue.ts
drizzle/                            migrations
```

## Data model
| Table | Key fields | Relations / constraints |
| --- | --- | --- |
| user (Better Auth) | id, name, email, role enum(admin, examiner, candidate), banned, createdAt | email unique |
| session, account, verification | Better Auth managed | account holds password hash |
| user_preferences | user_id PK, font_scale, theme(light, dark, contrast), layout(single, scroll), palette_side | 1:1 user |
| topics | id, owner_id, name | unique(owner_id, name) |
| questions | id, owner_id, topic_id, type enum(single, multi, written), difficulty enum(easy, medium, hard), stem, default_marks, multi_scheme enum(all_or_nothing, partial), rubric, archived_at, updated_at | FK owner, topic |
| question_options | id, question_id, text, is_correct, position | FK question cascade |
| exams | id, owner_id, title, instructions, starts_at, ends_at, duration_min, total_marks, status enum(draft, published, completed), shuffle_questions, shuffle_options, negative_marking, release_answer_review, pass_mark, published_at, closed_at, results_published_at | check ends_at > starts_at |
| exam_questions | exam_id, question_id, position, marks | PK(exam_id, question_id); locked once exam published |
| enrollments | exam_id, candidate_id, enrolled_by, created_at | PK(exam_id, candidate_id) |
| attempts | id, exam_id, candidate_id, is_sandbox, status enum(in_progress, submitted, auto_submitted), started_at, deadline_at, submitted_at, submit_reason, paper jsonb (candidate-safe snapshot: items, order, option order, marks, scheme), key jsonb (server-only correct option ids), score_auto, score_manual, score_total, grading_status enum(pending, graded), last_seen_at, scratchpad text, extension_sec | unique(exam_id, candidate_id) where not is_sandbox |
| answers | attempt_id, item_id, response jsonb, flagged, client_seq, saved_at (server), auto_score, manual_score, feedback, graded_by, graded_at | PK(attempt_id, item_id) |
| attempt_events | id, attempt_id, type enum(tab_hidden, fullscreen_exit, offline, reconnect, connection_gap, device_change, late_save_rejected, extension_granted, submit), source(client, server), detail jsonb, client_ts, server_ts | FK attempt; append only |
| announcements | id, exam_id, author_id, body, created_at | FK exam |
| time_extensions | id, attempt_id, seconds, reason, granted_by, created_at | reason required |
| result_reports | id, attempt_id, code (random 128-bit, base32), issued_at, issued_by, score_snapshot, revoked_at | code unique |
| audit_log | id, actor_id, action, entity_type, entity_id, meta jsonb, created_at | append only |

Paper snapshot is the only thing the workspace reads. `key` is never selected in candidate queries.
"ongoing" is derived: status = published and starts_at <= now < ends_at. Completed when now >= ends_at or closed_at set.

## Authorization matrix
| Action | Admin | Examiner | Candidate | Public |
| --- | --- | --- | --- | --- |
| Manage users, roles, deactivate | yes | no | no | no |
| View audit log | yes | own exams | no | no |
| CRUD own questions/topics, import questions | read all | own | no | no |
| CRUD exams, publish, close | read all | own | no | no |
| Enroll/import candidates | yes | own exams | no | no |
| Monitor, announce, grant extension | read all | own exams | no | no |
| Grade, publish results, analytics, exam PDF | read all | own exams | no | no |
| Sandbox attempt | no | own exams | no | no |
| List assigned exams, start attempt | no | no | enrolled + window | no |
| Save answers, heartbeat, events, submit | no | no | own attempt, before deadline | no |
| View result, download result PDF | yes | own exams | own + published | no |
| Verify report by code | yes | yes | yes | minimal fields |

Ownership: examiner rules check `exam.owner_id = user.id`. Candidate rules check `attempt.candidate_id = user.id`. Foreign IDs return 404 (no existence leak).

## API / route surface
| Domain | Surface | Role |
| --- | --- | --- |
| Auth | `/api/auth/*` (Better Auth) | any |
| Users | actions: createUser, updateUser, setRole, setActive | admin |
| Questions | actions: upsertQuestion, archiveQuestion, upsertTopic, importQuestions(preview, commit) | examiner |
| Exams | actions: createExam, updateExam, setExamQuestions, publishExam, closeExam | examiner owner |
| Enrollment | actions: enroll, unenroll, importCandidates(preview, commit) | examiner owner, admin |
| Attempt start | action: startAttempt(examId, {sandbox}) | candidate enrolled / examiner owner for sandbox |
| Attempt runtime | `GET /api/attempts/[id]` state; `PUT /api/attempts/[id]/answers` batch with client_seq; `POST .../heartbeat` carries queued client signals and returns server now, deadline, announcements, granted extensions (D11); `POST .../submit` idempotent; `PUT .../scratchpad` | candidate owner (or examiner for sandbox) |
| Monitoring | `GET /api/exams/[id]/monitor` (polled); `GET /api/exams/[id]/monitor/attempts/[attemptId]` timeline; actions: announce, grantExtension | examiner owner (admin read only) |
| Grading | actions: gradeAnswer, recalcAttempt; publishResults | examiner owner |
| Analytics | server components reading services (exam + question analytics) | examiner owner, admin |
| Reports | `GET /api/reports/attempt/[id]` PDF; `GET /api/reports/exam/[id]` PDF | owner rules above |
| Verify | `/verify/[code]` page | public |
| Preferences | action: savePreferences | any signed-in |

## Core invariants
1. Server time is the only clock. Attempt deadline = server start time + duration (+ granted extensions), capped by the exam window end (extensions may exceed it, audited). Client timer is display only, synced via server-now offset.
2. An active attempt's questions, order, options and marking scheme are frozen in `attempts.paper`/`attempts.key` at start and never change.
3. Answer keys and correct flags are never sent to candidate endpoints. Candidate DTOs are built by allowlist.
4. Submit is idempotent: row lock, status check, one finalization. Answers received after `deadline_at` are rejected (409) and logged. Expired attempts are finalized lazily on any read/write/monitor poll.
5. Every permission is checked on the backend in the service layer, never only by hiding UI.
6. Sandbox attempts never touch real results, analytics, monitors or reports (`is_sandbox = false` filter in every aggregate).
7. Candidates see results only after the examiner publishes them.
8. Monitoring incidents are signals, never proof of misconduct. UI wording reflects that.
9. Public verification endpoint exposes minimum data only (status, exam title, masked name, score, issue date).
10. Grading state is consistent: totals recalculated server side in a transaction, manual marks validated against max marks, publish blocked while any attempt is pending.
