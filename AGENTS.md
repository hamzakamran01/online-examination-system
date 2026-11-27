# Agent instructions

- Claude Code: follow `CLAUDE.md`.
- Codex: follow `CODEX.md` (task board, file ownership and hard rules). Re-read it before every task.

Shared rules: the brief in `docs/Web-e-Thon_Problem_Statement.md` is the source of truth; `docs/SPEC.md` holds acceptance criteria; no em dashes; no new dependencies; `pnpm typecheck && pnpm lint && pnpm build` must pass before any commit; no AI attribution lines in commits.

## This is NOT the Next.js you know

This version (16.4.6) has breaking changes: APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Heed deprecation notices.
