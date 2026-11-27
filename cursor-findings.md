# ExamVault design findings (CDO, late 2026)

Research date: 27 November 2026. Product: Secure Examination Management System for Technoverse 5.0 Web-e-Thon. Innovation focus: 5.3 Failure-Resilient Examinations.

## What the brief actually rewards

Evaluation gives **20 marks to UI/UX**. Judges score:

- Intuitive workflows and feature discoverability
- Visual hierarchy (not decoration)
- Accessibility and keyboard use
- Responsiveness including 375px
- Interaction quality (save status, timer, empty states)

They explicitly penalise **generic, template-like, or unrefined AI-generated interfaces**. Visuals only score when they support usability.

Role-specific experiences are required, not one dashboard with different nav labels.

## Product jobs by role

| Role | Job to be done | Anxiety | Design implication |
| --- | --- | --- | --- |
| Candidate | Sit a fair paper, trust that answers are kept, finish before the server deadline | Time, connectivity, "did it save?", accidental submit | Calm exam hall. Timer + save status always visible. Palette states without colour-only encoding. Clear lobby contract before the clock starts. |
| Examiner | Author, enroll, watch, grade, publish | Missing a live incident, publishing too early, grading inconsistency | Command board by lifecycle. Tabs that map to the exam pipeline. Status that reads as operations, not marketing KPIs. |
| Administrator | Accounts, roles, audit | Wrong role, leftover access | Dense, accountable registry. Audit as a ledger, not a pretty table. |
| Public verifier | Confirm a paper is genuine | Over-exposure of private data | Certificate, minimum fields, no dashboard chrome. |

## What elite exam products actually look like

Sources synthesised: NTA computer-based test palette language; Pearson VUE / Prometric hall discipline; Numbas accessibility; Plugixa exam-hall layouts; Complete Frontend "online exam platform" system design; Cherif et al. 2025 "Stress by Design?" (LMU).

### Candidate workspace (highest-stakes screen)

1. **One question at a time** with a persistent palette. Scrolling a whole paper raises anxiety and loses place.
2. **Timer and save status sit together** in a sticky bar. Those two questions never leave the viewport: how long is left, and is my work safe?
3. **Server clock, silent by default.** Live regions must not announce every second. Announce at 10 / 5 / 1 minutes (already in the product).
4. **Five palette states in the NTA tradition**, each with **shape plus label**, not colour alone: not visited, opened-unanswered, answered, marked, answered+marked. Colour-blind candidates otherwise lose marks to the UI.
5. **Submit is a review, then a confirmation.** Summary of unanswered and flagged items. Wording: keep working vs submit now.
6. **Stress research (2025):** about a third of students said the interface hurt performance. They asked for simpler visuals, familiarisation before the real paper, timer visibility control, and **explicit connection/save indicators**. Feature-rich dashboards increase stress. Minimal hall chrome wins.
7. **Options as large hit targets** with letter stamps (A, B, C). Native radio/checkbox. Focus moves to the new stem on jump.
8. **Mobile:** palette in a bottom sheet; large previous/next; timer never collides with the question.

### Examiner operations

- Lifecycle grouping (draft / scheduled / live / closed) is how exam boards think, not a flat card grid of "projects".
- Live exams need a writing-now signal. Everything else is quieter.
- Exam detail is a pipeline: settings, paper, candidates, review, grading, analytics. Tabs must feel like stations, not generic SaaS.

### Institutional visual language (not startup SaaS)

Products that feel "real" in this domain share:

- **Warm paper + cool ink.** Examination booklets are cream stock with navy rules, not violet gradients on cool gray.
- **Serif for titles, sans for controls.** Boards, universities, and professional bodies still use this split. Sans-only Geist dashboards read as every 2024 AI starter kit.
- **Restrained chroma.** Authority comes from contrast and type, not neon primary buttons.
- **Hairlines and stamps**, not floating glass cards with 24px radius.
- **Tabular numerals** on time, marks, and counts.
- **One brass/seal accent** for verification, scores, and official marks. Used sparingly.

Generic tells to kill: indigo/violet brand, identical rounded cards, "Welcome back" dashboard, icon-in-circle empty states with no next action, rainbow KPI tiles, purple glow.

## Audit of what is already built

Strengths to keep:

- Role shells and exam tabs already exist.
- Workspace already has server-synced timer, sync pill, review-before-submit, sandbox banner, announcements.
- Copy is mostly plain and non-accusatory ("event", not "cheating").
- Demo accounts on login are useful for the 15-minute judging path.

Gaps versus elite exam UX:

- Tokens are PatternVault **violet/indigo SaaS**. That is the template look the brief forbids.
- Geist-only type. No institutional voice.
- Sidebar is a light generic app nav. Exam halls and registries use a dark ink rail.
- Candidate home is equal cards. An open or in-progress paper should dominate.
- Palette encodes answered vs not mainly by fill colour. Flag is a tiny badge. No shape language. No "opened but blank" vs "never visited" if we can add it without new data (visited can be client-only).
- Buttons default to 32px height. Exam controls need more generous targets.
- Login is a split SaaS marketing panel. It should feel like a credential desk.
- Verify and submitted screens look like leftover cards, not a certificate or a receipt.
- `space-y` stacks and identical `rounded-xl border shadow-panel` everywhere flatten hierarchy.

## Design direction: Examination Registry

Name in the UI stays **ExamVault**. The system metaphor is a **registry**, not a productivity app.

Principles:

1. **Paper and ink.** Cream canvas, navy ink, brass seal. Dark rail for navigation.
2. **Type with a spine.** Newsreader for titles and exam names. Geist for UI. Geist Mono for the clock.
3. **Calm under time pressure.** No decorative motion on the attempt screen. Motion only for save/retry spinners.
4. **Status is operational.** Open now, writing, waiting to publish. Not vanity metrics.
5. **Trust is visible.** Sync state, server timer caption, verifiable report as a certificate.
6. **Comfort at 375px.** Lobby, palette sheet, and start contract must work with a thumb.
7. **Do not fight other agents.** Visual and layout only. No service, schema, or attempt-engine changes.

## Accessibility floor (UX-8.1)

- WCAG AA contrast on paper/ink (navy on cream passes; violet-on-white often fails in badges).
- Palette accessible names already include state; keep and extend.
- Focus rings stay 2px on ink.
- Skip link already present.
- Reduced-motion already respected in tokens.

## What we will not do

- No illustration mascots, no 3D blobs, no mesh gradients.
- No "AI copilot" chrome.
- No changing attempt timing, sync, or authz behaviour.
- No em dashes in copy.
