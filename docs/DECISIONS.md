# Decision log

Append new entries at the bottom. Format: decision, why, alternative rejected.

## D1 Fresh app at repo root, starter and patternvault as reference only
- Why: starter stores data in localStorage / one jsonb table, its demo cookie carries the role (forgeable), and roles do not match the brief. Its UI layer is good.
- Do: copy shadcn ui, tokens, app-shell, data-table, dashboard-kit, system-states where they fit; no imports from sister folders; both folders gitignored and credited in README.
- Rejected: extending the starter (would spend hours removing AI/RAG and rewriting auth and data anyway).

## D2 Next.js 16.4.6 + React 19.3 + Tailwind 4 + shadcn
- Why: same versions as starter, so copied components work unchanged; one deployable for UI and API.
- Rejected: separate Express/Nest API (two deploys, slower).

## D3 Postgres on Neon + Drizzle ORM
- Why: relational integrity, transactions and row locks for submit/grading; free tier without card; typed schema and migrations.
- Rejected: Supabase with RLS (two authz paths to keep consistent), Prisma (heavier client, slower cold starts), SQLite (not durable on Vercel).

## D4 Better Auth with admin plugin
- Why: hashed passwords, DB sessions, role field and admin user APIs out of the box; works with Drizzle.
- Rejected: Auth.js credentials (no first-class admin user management), hand-rolled sessions (time and security risk).

## D5 Timing: server deadline fixed at start, lazy finalization
- Why: device clock cannot influence time; no cron needed on free tier. Any read, save, heartbeat or monitor poll after the deadline finalizes the attempt in a transaction.
- Rejected: client-side countdown authority; scheduled job (Vercel Hobby cron is daily only).

## D6 Autosave: IndexedDB journal + batched PUT with client_seq
- Why: survives refresh and power loss; out-of-order and repeated requests are harmless; drives the sync status UI.
- Rejected: save on navigation only (loses work), websockets (free-tier limits, more moving parts).

## D7 Innovation pick: 5.3 primary, 5.2 stretch
- Why: 5.3 reuses S-4.1 work, is demoable live by turning wifi off, and strengthens the reliability marks. 5.2 is small if time remains.
- Rejected: 5.1 AI integrity (privacy trade-offs, webcam-style proctoring out of scope), 5.4 disputes (larger workflow).

## D8 Monitoring via polling
- Why: TanStack Query polling every 5 s (monitor) and 15 s heartbeat (candidate) is free and reliable on Vercel.
- Rejected: Pusher/Ably (keys, limits), self-hosted websockets (not on serverless).

## D9 Reference repos: reimplement ideas, copy no code
- Reviewed 5 exam repos in `helpers and UI components/`. Best two (online-exam-platform, exam-platform-web) have no license, and all differ in stack and data model.
- Adopted as ideas: monotonic countdown (`performance.now()`), live monitor states with 30 s disconnect, extension cap with row lock, discrimination index (upper/lower 27%), fair blueprint generator.
- Rejected: auto-terminating attempts after tab switches (brief 3.6: signals are not proof); client-side answer banks and mock logins (security).
- Rejected: building on any repo wholesale (license risk, porting cost exceeds writing it).

## D10 Deadline grace: 5 s for in-flight requests (decided)
- Saves are accepted until deadline_at + 5 s; the candidate UI locks at zero, so only requests already in transit benefit. Expired attempts are finalized after the grace with submitted_at = deadline_at.
- Why: an honest last answer sent at 0:00 must not be lost to network latency; 5 s gives no usable extra time. Three reference repos use the same pattern.
- Rejected: strict 0 s cutoff (drops in-flight answers), 30 s grace (reads as extra time, against brief 5.3).

## D11 Signals travel with the heartbeat (decided)
- Client signals (tab away, full screen exit, offline period, reconnect) are queued in localStorage and sent in the 15 s heartbeat body, not a separate events endpoint. One request per beat, and signals raised while offline arrive after reconnecting instead of being lost.
- The heartbeat schema only accepts client signal types. Server-only events (connection_gap, device_change, late_save_rejected, extension_granted) cannot be forged by a client.
- Durations are measured on the device with `performance.now()` (monotonic, immune to clock changes) and labelled "reported by the browser". The server stamps its own time on every event; outages are measured only from server timestamps.
- Caps: tab switches under 1 s ignored; 200 client signals per attempt; repeated device_change within 2 min collapsed.

## D12 Connection gaps and extensions (decided)
- A silence over 45 s between server contacts (saves or heartbeats) is stored as `connection_gap` with its server-measured duration. Disconnected on the monitor = no contact for 30 s (two missed beats).
- Extra time is never automatic. The examiner grants it (default pre-filled from the measured outage minus time already granted), reason required, whole minutes, 15 min total per attempt. The attempt row is locked so concurrent grants cannot pass the cap; ownership is checked without locking the exam row (avoids lock-order inversion with closeExam).
- Only before the deadline: once time has run out the attempt is being finalized, so a grant would reopen a closed attempt.
- The candidate learns the amount (toast, timer moves on the next heartbeat) but never the reason, which can contain personal details. Admins can read the monitor but not act (authz matrix: read all).
- Rejected: pausing the timer while offline (pull the cable to gain time), automatic credit for gaps (same abuse), exam-wide announcement per extension (leaks one candidate's situation to everyone).

## D13 Background tabs are not outages (decided)
- Browsers throttle timers in hidden tabs (Chrome to about one tick a minute), so a hidden exam tab misses heartbeats and the server would record a false outage.
- The client keeps a presence ledger (hidden and offline milliseconds since the last acknowledged request, monotonic clock) and sends it with every heartbeat AND autosave. The server still measures the gap itself; the ledger only labels it: `background_tab` (visible for less than one gap threshold), `device_offline` (device reported no network for half the gap or 45 s), otherwise `no_contact`.
- Only offline and no-contact gaps count as outages for suggestions and incidents. Background gaps stay on the timeline, without a warning dot.
- A ledger sent by a different client id than the one last seen is ignored: the new device cannot describe the old device's silence.
- Abuse: the ledger can only make a silence look less like an outage (lower compensation) or, if forged, more like one; compensation is still an examiner decision with the timeline in view, never automatic.

## D14 Declared incidents compensate per candidate (decided)
- A whole-lab or server outage should not mean 40 manual extensions. The examiner declares a window; the server builds a plan from its own data (outage-cause gap overlap with the window, plus candidates still silent), subtracts extra time already granted since the window opened, rounds up to whole minutes within the 15 minute cap.
- The preview and the grant run the same function; the grant rebuilds it inside one transaction after locking the exam row and then every live attempt in id order (the same order as closeExam). A client-generated request key with a unique index makes double clicks and retries apply once.
- Rejected: one flat amount for everyone (rewards candidates who were never cut off), automatic credit from gaps (pull the cable to gain time), windows in the future (pre-approving time).

## D15 Second innovation: 5.4 Trust and Dispute Resolution (decided, supersedes D7's rejection)
- Why now: most of the machinery already existed (frozen papers, grading history, reason-gated regrades, Replaced report codes, server-measured evidence). 5.2 stays a stretch.
- One dispute per question per attempt, at most 5 per attempt, within 7 days of publication; withdrawal is final. Types: grading error, ambiguous question, technical incident.
- Outcomes: reject (note), regrade (written mark, or an override of the automatic mark for objective questions), void for everyone (`exclude` shrinks every paper's maximum, `full_marks` awards it to all). A void recalculates every paper containing the question in one transaction and closes sibling open disputes with the same decision.
- Scoring precedence lives in one pure module (`src/lib/domain/scoring.ts`) used by recalculation, grader, candidate result and PDF, so no screen can disagree.
- Any issued report whose snapshot no longer matches the recalculated total is marked Replaced immediately (also on ordinary post-publication regrades), so an old QR code stops vouching for an outdated score.
- Lock order: dispute row, then attempts in id order; the exam row is read without a lock, as in grading, so resolution cannot deadlock with grading or closing an exam.
- Rejected: free-text appeals without a question (unreviewable), unlimited disputes (spam), per-candidate voids (inconsistent rule), deleting voided questions from papers (breaks the frozen paper invariant).
