# ExamVault: Secure Examination Management System

Technoverse 5.0 Web-e-Thon submission. Create, conduct, monitor and evaluate online examinations with
server-enforced timing, frozen attempt papers and failure-resilient answer saving.

## Live URL
TODO (Vercel)

## Overview
TODO: roles, core workflow, screenshot.

## Innovation challenge: 5.3 Failure-Resilient Examinations
TODO: summary from `docs/INNOVATION.md`.

## Test credentials
See `docs/DEMO.md`. TODO: copy final table here after seed is verified on the live URL.

## Setup
TODO:
1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `REPORT_SIGNING_SECRET`
3. `pnpm db:migrate && pnpm db:seed`
4. `pnpm dev`

## Dependencies
TODO: Node 20+, pnpm 11, Postgres (Neon free tier). No paid APIs or billing-required services.

## Architecture
See `docs/ARCHITECTURE.md`.

## Credits
TODO: UI primitives adapted from our pre-event starter and PatternVault kits (built on shadcn/ui, MIT), plus third-party libraries listed in `package.json`.
