# SPEC: requirement traceability matrix

Source: `docs/Web-e-Thon_Problem_Statement.md`. Every row traces to the brief. Status: `todo` / `doing` / `done`.

| Category | Marks | Sections |
| --- | ---: | --- |
| Core Functionality | 30 | 3.1 to 3.8 |
| Secondary Features | 15 | 4.1 to 4.8 (all eight expected) |
| Technical Quality & Reliability | 20 | 6 |
| Open Innovation Challenges | 15 | 5 (we pick 5.3) |
| UI/UX & Product Design | 20 | 8 |

Scoring notes from the brief: partial credit exists; non-functional placeholders do not get full credit; judges test common scenarios and ask about design decisions.

## 3.1 Authentication & Authorization

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.1.1 | Secure authentication for admin, examiner, candidate, with an appropriate experience per role | Email + password login, hashed passwords, httpOnly DB session; each role lands on its own home and nav; logout invalidates session | Log in as each role, show different home | todo |
| C-3.1.2 | Admins manage user accounts and role assignments; permissions enforced on backend, not by hiding UI | Admin can create, edit, deactivate users and change role; every mutation re-checks role server side; non-admin call to admin API returns 403 | Change a role live; call admin API as candidate, get 403 | todo |
| C-3.1.3 | Examiners and candidates access only exams, records and actions they are authorized for | Examiner can read/write only own exams and questions; candidate only enrolled exams and own attempts; foreign IDs return 404/403 | Paste another examiner's exam URL, get denied | todo |

## 3.2 Examination Management

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.2.1 | Create and configure exams with title, instructions, schedule, duration, total marks and settings | Form validates window end > start, duration > 0 and fits window; total marks equals sum of assigned question marks before publish; settings: shuffle questions, shuffle options, results release mode | Create an exam end to end | todo |
| C-3.2.2 | Lifecycle draft, published, ongoing, completed; candidates cannot access before availability | Status shown everywhere; transitions enforced server side; candidate start before window or on draft returns error | Show a published-but-upcoming exam is locked for a candidate | todo |
| C-3.2.3 | Review exam details before publication; manage exams through an appropriate interface | Pre-publish review page with checklist (questions, marks match, enrolled count, window valid); publish blocked if checks fail; exam list with filters by status | Review screen, publish button enabling | todo |

## 3.3 Question Management

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.3.1 | Reusable question bank with categories/topics and difficulty; create, edit, assign to exams | Bank list filterable by topic, difficulty, type; CRUD with validation; assign from bank to exam with per-exam marks | Filter bank, add 3 questions to exam | todo |
| C-3.3.2 | Single-answer MCQ, multiple-select, written response, with appropriate marking schemes | Single: exactly 1 correct option; multi: 1+ correct, scheme all-or-nothing or partial; written: max marks + optional rubric | Create one of each type | todo |
| C-3.3.3 | Randomize objective questions or answer choices where applicable; preserve marking scheme and assignment for an active attempt | Per-candidate order seeded at start; snapshot stored on attempt; editing bank or exam after start does not change an active attempt | Edit a question mid-attempt, candidate still sees original | todo |

## 3.4 Candidate Management

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.4.1 | Examiners enroll candidates and view enrollment info | Enroll by search/multi-select or import; enrollment table with attempt status per candidate; unenroll blocked once attempt exists | Enroll 2 candidates, view table | todo |
| C-3.4.2 | Candidates see available, upcoming and completed exams with instructions and access status | Three grouped sections; each card shows window, duration, marks, status and why it is locked or open | Candidate home | todo |
| C-3.4.3 | Restrict entry to eligible candidates; enforce the availability window | Start requires enrollment + published + now within window, checked on server; message explains reason | Non-enrolled candidate is refused | todo |

## 3.5 Examination Interface

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.5.1 | Accessible workspace with questions, marks, remaining time, navigation; distinguish answered, unanswered, marked for review | Question palette with 3 visually and textually distinct states; timer with aria-live warnings at 5 and 1 min; keyboard navigation | Navigate, flag a question | todo |
| C-3.5.2 | Autosave answers; preserve progress and remaining time on refresh or return | Debounced save per change; save status visible; refresh restores answers, flags, position and server-derived remaining time | Refresh mid-exam | todo |
| C-3.5.3 | Review progress and submit; enforce time limit; finalize at expiry with answers accepted in time | Review screen lists unanswered/flagged before confirm; at deadline client locks and server finalizes; late saves rejected | Let a short exam expire | todo |

## 3.6 Examination Monitoring

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.6.1 | Examiners view active attempts, progress, events or incidents | Live table (polling) with answered count, time left, connection state, last seen, event count | Monitor while candidate answers | todo |
| C-3.6.2 | Monitor exam status; send announcements to candidates during an exam | Post announcement; candidates see it within one poll interval as a non-blocking banner; history kept | Send announcement, appears in candidate tab | todo |
| C-3.6.3 | Record and present incidents for review; indicators not conclusive evidence | Events logged with server time (tab hidden, fullscreen exit, offline gap, reconnect, device change); UI labels them "signals for review" with disclaimer | Show incident timeline with wording | todo |

## 3.7 Evaluation & Grading

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.7.1 | Auto-grade objective responses per marking scheme incl. multi-select rules | Graded at finalize from frozen snapshot; multi-select all-or-nothing or partial (per correct minus per wrong, floor 0) | Show multi-select partial score | todo |
| C-3.7.2 | Examiners review and manually grade written responses, validated against assigned marks | Grading queue per exam; marks input 0..max (step 0.5) validated both sides; optional feedback | Grade a written answer, try invalid mark | todo |
| C-3.7.3 | Accurate totals, consistent grading state; review results before publication | Total recomputed server side in a transaction; attempt grading_status pending/graded; publish blocked while ungraded | Results review screen | todo |

## 3.8 Results & Analytics

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| C-3.8.1 | Controlled result publication; candidates see only own published results | Publish action (with confirm) sets results_published_at; candidate result endpoint checks owner + published | Candidate sees result only after publish | todo |
| C-3.8.2 | Exam-level summaries and candidate-level scores from real submission data | Mean, median, high, low, pass rate, score distribution chart, per-candidate table; sandbox excluded | Analytics page | todo |
| C-3.8.3 | Retain completed attempts and results for later review by authorized users | Completed exams and attempts remain viewable read only; answer-level review for examiner and admin | Open an old exam's attempt | todo |

## 4 Secondary Features

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| S-4.1 | Network-aware interface: detect connectivity problems; show save/sync status; clear feedback when unstable or offline | Global pill: Saved / Saving / Offline, N pending / Sync failed; per-question sync marker; detects offline via events + failed requests + heartbeat | Turn wifi off mid-exam | todo |
| S-4.2 | Downloadable readable PDF reports from real data, with access restrictions | Candidate result PDF (own, published only) and exam summary PDF (owner examiner/admin) | Download both | todo |
| S-4.3 | Sandbox: examiner previews exam as candidate; no effect on real submissions, results, stats | Sandbox attempt flagged is_sandbox; excluded from every query of results/analytics/monitor; clear "Sandbox" banner; resettable | Preview, then show stats unchanged | todo |
| S-4.4a | Bulk import candidates from CSV/JSON with validation and clear errors | Preview with row-level errors (line, field, message) before commit; valid rows create/enroll in one transaction | Import a file with 2 bad rows | todo |
| S-4.4b | Bulk import questions from CSV/JSON with validation and clear errors | Same preview flow; type-specific checks (single needs exactly 1 correct) | Import question file | todo |
| S-4.5 | Question analytics: skipped, commonly incorrect, observed difficulty | Per-question: attempt rate, skip rate, correct rate (facility), most chosen wrong option, avg written score vs max | Question insights tab | todo |
| S-4.6 | Verifiable reports via unique ID or QR without exposing unnecessary data | Each issued PDF has random verification code + QR to `/verify/<code>`; public page shows valid/revoked, exam title, masked name, score, issue date only | Scan QR on phone | todo |
| S-4.7 | Customizable workspace: candidates change layout or viewing preferences, retained | Font size, theme (light/dark/high contrast), palette position, one-question vs scroll view; stored server side per user | Change prefs, refresh, persists | todo |
| S-4.8 | Digital scratchpad usable within the exam workflow | Per-attempt notes panel (text, autosaved with attempt), toggle with shortcut; never graded | Use scratchpad, refresh, still there | todo |

## 5 Innovation (see INNOVATION.md)

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| I-5.3 | Reduce impact of outages, device and power failures without extra time or unfair advantage | Local answer journal + sync; server deadline; resume on any device; server-measured outage incidents; examiner-granted, audited extension only | Offline demo + device switch | todo |
| I-5.2 | (stretch) Fairer randomized papers | Difficulty-balanced draw from bank per candidate with equal difficulty budget | Show two papers, equal difficulty score | todo |

## 6 Technical Requirements & Constraints

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| T-6.1 | Server-side authorization; protect credentials, answer keys, personal data, records; no private data on public endpoints or reports | Guards in every service; candidate DTOs built from allowlists (no is_correct); verify page minimal; passwords hashed | Inspect network tab: no keys | todo |
| T-6.2a | Timing independent of the device clock | Remaining time computed from server deadline and server-now offset | Change laptop clock, timer unchanged | todo |
| T-6.2b | Prevent duplicate submissions | Submit idempotent (row lock + status check); double-click and retries return same result | Double submit | todo |
| T-6.2c | Prevent inconsistent grading | Totals derived in one transaction; publish blocked until all graded; marks bounded | Try to publish with pending grading | todo |
| T-6.2d | Preserve assigned questions and marking scheme for active attempts | Snapshot frozen at start (see C-3.3.3) | Same as C-3.3.3 | todo |
| T-6.3 | Validate on frontend and backend; handle invalid data, interrupted requests, refreshes, repeated actions; communicate failures and save status | Shared zod schemas; retries with backoff; out-of-order saves ignored via client seq; error toasts in plain words | Send bad payload via devtools, get 400 | todo |
| T-6.4 | Appropriate DB design, separation of responsibilities, maintainable code | Normalized schema with FKs, unique constraints, enums; routes to services to DB layering | Walk through ARCHITECTURE | todo |
| T-6.5 | No required feature depends on paid APIs, keys, proprietary data, special hardware or billing services | Only free tiers that need no card; no AI dependency | README dependencies list | todo |

## 7 Submission Requirements

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| SUB-7.1 | Git repo with source and version history; deployed functional app | Public repo with many small commits; live URL works with seeded data | Open live URL | todo |
| SUB-7.2 | Concise README: setup, test credentials per role, dependencies, innovation description | All sections filled and accurate | README | todo |
| SUB-7.3 | Demonstrable with fictional/test data; ready for 15-minute evaluation | Seed script creates realistic fictional data; DEMO.md rehearsed | Seeded deploy | todo |
| SUB-7.4 | No commits, pushes, builds or deploys after the deadline | Final deploy and push done before deadline; no timestamp edits | n/a | todo |

## 8 UI/UX (evaluation criteria)

| ID | Requirement | Acceptance criteria | Demo | Status |
| --- | --- | --- | --- | --- |
| UX-8.1 | Consistent, accessible interface; clear navigation and hierarchy | Role-specific nav; WCAG AA contrast; labels, focus rings, aria-live for timer and save status | Keyboard-only run | todo |
| UX-8.2 | Responsive layouts and intuitive workflows; features discoverable | Works at 375px; empty states guide next action; exam detail tabs group features | Phone-width view | todo |
| UX-8.3 | Not generic or template-like; visuals support usability | Exam-specific design language; charts only where they inform | Overall walkthrough | todo |

## Open questions
1. Multi-select scheme: we default to per-question choice of all-or-nothing or partial (correct/n minus wrong/n, floor 0). OK?
2. Negative marking for single MCQ: off by default, per-exam toggle. Needed at all?
3. "Ongoing" state: we derive it (published and now inside window), and "completed" is set when the window ends or the examiner closes early. OK?
4. Late start: a candidate starting late gets min(duration, window end minus now). Confirm.
5. Examiner time extension may push one attempt past the window end (audited, with reason). Confirm.
6. Question bank scope: owner-scoped per examiner (admin sees all). Should banks be shared between examiners?
7. Candidate result detail after publish: show per-question marks always; show correct answers only if the exam setting "release answer review" is on. OK?
8. Bulk-imported candidates without accounts: create accounts with a generated temporary password shown once in the import report. OK?
9. One real attempt per candidate per exam (sandbox unlimited). OK?
