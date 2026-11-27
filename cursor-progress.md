# Cursor CDO progress

Owner: design/frontend pass (does not own feature work on Claude Code or Codex branches).

## Goal

Revolutionise ExamVault UI/UX for Web-e-Thon judging: institutional examination registry, user-centric, non-template. Findings in `cursor-findings.md`.

## Status

- [x] Brief + SPEC UX-8 + current screens audited
- [x] Research written (`cursor-findings.md`)
- [x] Tokens: paper + ink + seal, Newsreader headings
- [x] App shell, login, page chrome
- [x] Candidate home, lobby, examiner home, admin, verify, submitted
- [x] Exam workspace palette, timer, option stamps
- [ ] Browser walkthrough at 1280 and 375

## Guardrails

- Presentation only. No API, schema, or sync-engine edits.
- No em dashes.
- shadcn semantic tokens. Forms keep Field primitives.
- Other agents may be editing feature files; avoid `exam-tabs` logic, services, and actions.

## Files touched (intended)

- `src/lib/tokens/tokens.css`
- `src/app/layout.tsx`
- `src/components/shell/*`
- `src/app/login/*`
- Role home pages, lobby, workspace chrome, verify, done, exam layout/tabs styling
