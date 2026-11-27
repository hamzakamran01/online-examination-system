# Innovation: 5.3 Failure-Resilient Examinations

## Problem
Wifi drops, a laptop dies, power cuts out. Today that usually means lost answers, a frozen timer, or an
examiner guessing whether to believe the candidate. Naive fixes (pause the timer while offline) let a
candidate pull the cable to buy time.

## Who it affects
Candidates on unreliable networks or shared devices (most affected, least able to prove it), and
examiners who must decide fairly without evidence.

## Mechanism
| # | Piece | What it does |
| --- | --- | --- |
| 1 | Local answer journal | Every change is written to IndexedDB with a monotonic `client_seq` before any network call. Survives refresh, crash, power loss on the same device. |
| 2 | Sync queue + status | Queue flushes with backoff. Global pill (Saved / Saving / Offline, N pending / Sync failed) and a per-question marker. Server ignores stale `client_seq`, so retries and reordering are safe. |
| 3 | Server-authoritative deadline | Deadline fixed at start on the server. Client shows `deadline - (Date.now() + serverOffset)`. Changing the device clock or going offline never changes it. |
| 4 | Resume anywhere | Log in on another device: paper, saved answers, flags, scratchpad and remaining time come from the server. A `device_change` event is logged. |
| 5 | Server-measured outage | Heartbeat every 15 s. A gap over 45 s is recorded by the server as `connection_gap` with its measured duration. Evidence comes from the server, not from candidate claims. |
| 6 | Fair compensation, never automatic | Examiner sees measured outage per attempt and can grant an extension (default = measured gap), reason required, written to `time_extensions` and `audit_log`, candidate notified via announcement. |
| 7 | Strict cut-off | Saves after the deadline are rejected (409) and logged as `late_save_rejected`. Attempt finalizes with answers accepted in time. Warning at T-2 min if unsynced answers exist. |
| 8 | Honest outage labels | Heartbeats and saves carry a presence ledger (hidden and offline time since the last acknowledged request, monotonic clock). Each measured gap is labelled: background tab (browser throttled timers, not an outage), device offline, or no contact (server or network path). Only real outages count. |
| 9 | Declare an outage | One server or lab failure, many candidates: the examiner picks the window, previews who the server measured as cut off, and grants each their OWN measured loss (minus time already given, within the cap) under one reason. One locked, idempotent transaction; every grant audited with its measured seconds. |
| 10 | Evidence where decisions are made | The grader and the dispute reviewer see the attempt record beside the answers: outages with cause, extra time with reasons, device changes, late saves, signals, with the "signals are not proof" disclaimer. |
| 11 | Device switch | A new device gets the paper, saved answers, flags, scratchpad and the same server deadline; the server logs `device_change`; the old device's silence is never explained by the new device's ledger. |

## Trade-offs
- No automatic time credit: prevents gaming by disconnecting, at the cost of needing an examiner decision.
- Offline answers not synced before the deadline are not counted. Mitigated by the T-2 min warning and the extension path.
- Journal is per device: a dead device loses only unsynced changes (seconds), shown as "last synced at".
- Heartbeat polling instead of websockets: free tier friendly, ~15 s detection latency.

## Demo (2 minutes)
1. Candidate answers Q1, Q2. Turn wifi off (or DevTools offline). Answer Q3, Q4: pill shows "Offline, 2 pending".
2. Refresh the page while offline: answers still there from the journal, timer still correct.
3. Wifi on: pill goes "Saving" then "Saved". Examiner monitor shows a `connection_gap` of N seconds.
4. Examiner grants extension of N seconds with a reason; candidate timer updates; audit log shows the entry.
5. Change the laptop clock: timer unaffected.

## Demo, part two (90 seconds)
6. Second candidate tab hidden for 2 minutes: timeline says "Tab in background", outage total unchanged.
7. Examiner: Declare an outage, "Last 10 min": preview shows who lost contact and for how long, grant to all affected in one click, audit log lists each grant.

# Innovation 2: 5.4 Trust and Dispute Resolution

## Problem
After results, a candidate who believes a mark is wrong has no structured way to say so, and an examiner who
agrees has no safe way to fix one paper, let alone a flawed question that hurt everyone. Ad hoc fixes (editing
a mark in a spreadsheet, emailing a corrected PDF) leave no trail and leave old reports in circulation.

## Mechanism
| # | Piece | What it does |
| --- | --- | --- |
| 1 | Scoped dispute | One question, one dispute, typed (grading error, ambiguous question, technical incident), written statement, within 7 days of publication, at most 5 per attempt. Withdrawal is final. |
| 2 | Evidence pack | The question exactly as this candidate saw it (frozen paper, their option order), their answer and save time, answer key and marking guide, grading history, server-measured outages and signals, and the cohort's choices for the same question. |
| 3 | Three outcomes, all explained | Reject (note), regrade (written mark or an override of the automatic mark), or void for everyone. The candidate reads the explanation. |
| 4 | One rule for all | Voiding applies one policy (exclude from every paper, or full marks for all) to every paper that contains the question, recalculated in one transaction; other open disputes on it close with the same decision. |
| 5 | No stale certificates | Any issued report whose score changes is marked Replaced at once; the public verify page says so and the new PDF gets a new code. |
| 6 | Accountability | Raised, withdrawn, resolved, regraded and voided are all audited; regrades appear in the question's grading history. |
| 7 | Quality signal | Questions with 2 or more disputes, or disputed on 20 percent of papers, are flagged on the Disputes tab. |

## Trade-offs
- Disputes open only after publication: before that, the examiner is still grading and a dispute has nothing to dispute.
- A void changes other candidates' totals. That is the point (consistency), and the confirmation dialog says how many papers change.
- Objective overrides are per candidate; a wrong answer key that affects everyone should be voided, not overridden 40 times.

## Demo (2 minutes)
1. Candidate opens a published result, "Question this mark", picks "Ambiguous question", explains.
2. Examiner, Disputes tab: hotspot flag, open the evidence pack: frozen question, cohort choices, outage record.
3. Void for everyone (exclude): every total recalculates; the candidate's timeline shows the decision and reason.
4. Scan the old PDF's QR: "Replaced by a newer report".

## Stretch: 5.2 Fairness of Randomized Examinations
Per-candidate paper drawn from a pool with a fixed difficulty budget (easy=1, medium=2, hard=3) per topic,
so every paper has equal total difficulty and topic coverage while questions vary. Built only if Phase 3
finishes early.
