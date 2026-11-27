# ExamVault: operating manual for AI coding sessions

## Project
Secure Examination Management System for Technoverse 5.0 Web-e-Thon (10 hours, 15-minute live demo).
Three roles: Administrator (users, roles), Examiner (exams, question bank, candidates, monitoring, grading,
publishing), Candidate (take assigned exams, view own published results). Innovation focus: 5.3
Failure-Resilient Examinations. The brief in `docs/Web-e-Thon_Problem_Statement.md` is the single source
of truth. `starter/` and `patternvault/` are reference-only sister folders (gitignored): copy UI pieces
from them when they fit, never import from them.

## Read first, every session
1. `docs/SPEC.md` (requirement IDs and acceptance criteria)
2. `docs/PLAN.md` (what is next, status)
3. `docs/ARCHITECTURE.md` (data model, authz matrix, invariants) when touching data or APIs

## Stack lock
| Layer | Choice | Version |
| --- | --- | --- |
| Framework | Next.js App Router, TypeScript strict | next 16.4.6, react 19.3.0 |
| UI | Tailwind CSS + shadcn (base-ui) + lucide | tailwindcss 4.3.3, shadcn ^4.23, @base-ui/react ^1.9 |
| Forms / validation | react-hook-form + zod (shared client and server schemas) | zod ^4.6, rhf ^7.92 |
| Data fetching | TanStack Query (polling for monitor, attempt state) | ^5.108 |
| Charts | recharts | 3.8.0 |
| DB | Postgres on Neon (free tier) | Postgres 17 |
| ORM | Drizzle ORM + drizzle-kit migrations, `pg` driver (transactions) | pin at install |
| Auth | Better Auth (email + password, admin plugin, DB sessions) | pin at install |
| PDF / QR | @react-pdf/renderer, qrcode | pin at install |
| Package manager | pnpm | 11.0.9 |
| Hosting | Vercel Hobby + Neon Free (no billing required) | |

Rules: verify each new package against its official docs before installing and pin the exact version.
This Next.js version has breaking changes: read `node_modules/next/dist/docs/` before writing Next code.
`middleware.ts` is now `proxy.ts`. Route `params` and `cookies()` are async.

## Folder conventions
```
src/app/                 routes only (thin): (auth), admin, examiner, candidate, verify, api
src/server/db/           schema.ts, client.ts, seed.ts      (server-only)
src/server/auth/         better-auth config, guards (requireUser, requireRole, assertOwner)
src/server/services/     domain logic: exams, questions, enrollments, attempts, grading,
                         results, analytics, monitoring, imports, reports, audit
src/features/<domain>/   UI components + server actions for that domain
src/components/ui/       shadcn primitives (copied from starter/ where identical)
src/components/shell/    app shell, nav, status pills
src/lib/validation/      zod schemas shared by client forms and server
src/lib/                 utils, time helpers, offline answer queue (client)
drizzle/                 generated migrations (commit them)
```
- Services never trust input: every service function takes the session user and checks role + ownership.
- Route handlers and server actions are thin: parse with zod, call a service, map errors to HTTP codes.
- Anything importing `src/server/**` must be server-only (`import "server-only"`).

## Non-negotiable invariants (full text in ARCHITECTURE.md)
1. Server time is the only clock. Deadline = min(start + duration + extensions, window end unless extended).
2. Attempt snapshot (questions, order, options, marks, scheme) is frozen at start.
3. Answer keys / `is_correct` never reach candidate endpoints or candidate bundles.
4. Submit is idempotent. One finalized submission per attempt. Saves after deadline are rejected.
5. Every permission is checked on the backend. Hiding UI is cosmetic only.
6. Sandbox attempts never touch real results, analytics, reports or exam stats.
7. Candidates see results only after the examiner publishes them.
8. Incidents are signals, never proof. Wording: "event", "flag for review", never "cheating".
9. Public verify endpoint returns minimum data only.
10. Totals are recalculated server side. Manual marks validated 0..max.

## Workflow rules
- One feature per change. Reference the SPEC ID in the commit body.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`. Small and frequent.
- After each task: update status in `docs/SPEC.md` and `docs/PLAN.md`; append real decisions to
  `docs/DECISIONS.md`.
- Before commit: `pnpm typecheck && pnpm lint && pnpm build` must pass.
- Never mark something done unless it works end to end in the browser with seeded data.
- No em dashes anywhere (code, copy, docs). No paid APIs, no billing-required services.
- No secrets in git. `.env.example` lists every variable with empty values.
- Feature freeze at Phase 4 start (see PLAN). After that only fixes, seed, README, polish.

## Definition of done (per SPEC row)
- [ ] Backend authz enforced (role + ownership), verified by calling the API as the wrong user
- [ ] Input validated with the same zod schema on client and server
- [ ] Loading, error and empty states handled; failures are communicated in plain words
- [ ] Works after refresh and with repeated clicks (no duplicates)
- [ ] Keyboard usable, labelled controls, visible focus, works at 375px width
- [ ] Matches the SPEC acceptance criteria; SPEC status updated

## UI direction
Calm, institutional, high-contrast. Purpose-built screens per role, not a generic template.
Reuse from `starter/src/components/ui` (shadcn primitives, tokens), `patternvault` app-shell,
data-table, dashboard-kit, system-states. Rewrite copy and layout for exams; drop dispatch theming.

## Other docs
`docs/ARCHITECTURE.md` data model, authz, API surface | `docs/INNOVATION.md` 5.3 design |
`docs/DECISIONS.md` decision log | `docs/DEMO.md` credentials, demo script, judge Q&A | `README.md`
