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

## Stretch: 5.2 Fairness of Randomized Examinations
Per-candidate paper drawn from a pool with a fixed difficulty budget (easy=1, medium=2, hard=3) per topic,
so every paper has equal total difficulty and topic coverage while questions vary. Built only if Phase 3
finishes early.
