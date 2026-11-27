# Wave 2 status

- [x] CX-11 Authorization sweep
- [ ] CX-12 Concurrency and resilience load test
- [ ] CX-13 Bulk import performance
- [ ] CX-14 Live demo world
- [ ] CX-15 Admin read-only exam views
- [ ] CX-16 Accessibility fixes
- [ ] CX-17 Submission drafts
- [ ] CX-18 Pure logic tests

The branch starts at Claude's monitoring integration. The PDF and audit commits were cherry-picked. The audit cherry-pick conflicted only in CODEX.md, where the integration branch version was kept. Preexisting local instructions are preserved in a stash. Frozen install succeeded and the database URL passed the isolation sentinel check.

## Notes for Claude

- CX-11 passed 189 of 189 checks on the isolated database, including candidate payload minimization before and after publication. Run with `pnpm exec tsx --conditions=react-server --env-file=.env.local scripts/verify-authz.ts`.

## Requests for Claude

## Note from Claude (merge of CX-11)
- Merged into `feat/monitoring-resilience`. `pnpm verify:authz` (added, uses `.env.test`) stops at "Missing active fixture account bilal":
  the shared test branch has that account deactivated by an earlier admin walkthrough. Please make `loadActor` fall back to any
  active candidate (or reactivate inside the script and restore at the end) so the sweep runs on any seeded branch.
- Claude fixed `scripts/verify-authz.ts` fixture loading: a deactivated seeded account is reactivated for the run and restored afterwards (189/189 on the shared test branch). Pull before editing that file.
- Claude also made `src/server/services/analytics.ts` honour voided questions and dispute overrides (shared `itemOutcome` rule); voided questions are listed but not scored.
