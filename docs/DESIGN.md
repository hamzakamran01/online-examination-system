# ExamVault design system

Institutional examination registry. Not a productivity dashboard.

## Metaphor

Paper stock, ink rail, brass seal. The product is a **registry**: timed papers, accountable grading, verifiable reports.

## Type

| Role | Face | Use |
| --- | --- | --- |
| Display | Newsreader (serif) | Page titles, exam names, scores, timer labels |
| UI | Geist | Navigation, forms, body, tables |
| Clock | Geist Mono | Remaining time, codes, sequences |

Kickers: 11px, 0.16em tracking, uppercase, muted. Never use kickers as the only heading.

## Colour

Warm cream canvas (`--paper-h: 82`). Cool navy ink (`--brand-h: 236`). Brass `--seal` only for official marks: verification, score, current-question ring, logo mark on dark.

Status colours are operational, never decorative:

- Success: open / writing / saved / pass
- Warning: in progress / retrying / unmarked review
- Danger: missed / time critical / failed save
- Info: announcements / sandbox

Do not introduce violet, mesh gradients, or glow as brand.

## Shape and elevation

Radius 6px (`--radius: 0.4rem`). Hairline borders plus `--shadow-panel`. Cards are paper on canvas, not floating glass.

Primary actions: filled navy. Secondary: outline. Destructive: soft red, never filled red on exam submit (submit is navy; the confirm copy carries the weight).

## Control heights

| Control | Height |
| --- | --- |
| Default button / input | 40px / 36px |
| Large exam actions | 44px |
| Compact table actions | 28px |
| Palette cell | square, min 40px |

Hit targets on the attempt screen and lobby must work with a thumb at 375px.

## Density

Operations desks (admin, examiner lists): compact tables, 4-column stats.

Candidate home: one featured paper, then quieter groups.

Exam hall: one question, persistent map, timer and save always in view.

## Motion

Respect `prefers-reduced-motion`. No decorative float. Spinners only for save, retry, submit. Live regions announce 10 / 5 / 1 minute warnings, not every tick.

## Accessibility

Navy on cream meets AA. Palette states use **shape plus label**, not colour alone. Focus ring 2px on `--ring`. Skip link present. Native radio/checkbox remain in the accessibility tree (visually replaced by letter stamps).

## Copy

Plain institutional English. "Event" and "flag for review", never "cheating". No em dashes. Role desks: Administrator, Examiner, Candidate. Public verify shows minimum fields only.

## Do

- Put time and save status together.
- Group examiner work by lifecycle.
- Use serif for the name of the paper.
- Show a contract in the lobby before the clock starts.
- Treat verify and submit-done as certificate and receipt.

## Do not

- Welcome-back dashboards, rainbow KPI tiles, mascots, AI chrome.
- Colour-only palette states.
- Timer that depends on the device clock (visual only; engine is server-synced).
- Hide permissions in the UI as if that were security.
