# Agent instructions

- Claude Code: follow `CLAUDE.md`.
- Codex: follow `CODEX.md` (task board, file ownership and hard rules). Re-read it before every task.

Shared rules: the brief in `docs/Web-e-Thon_Problem_Statement.md` is the source of truth; `docs/SPEC.md` holds acceptance criteria; no em dashes; no new dependencies; `pnpm typecheck && pnpm lint && pnpm build` must pass before any commit; no AI attribution lines in commits.

## This is NOT the Next.js you know

This version (16.4.6) has breaking changes: APIs, conventions, and file structure may differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing Next code. Heed deprecation notices.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
