# Demo guide

## Test credentials (created by `pnpm db:seed`, fictional)
| Role | Email | Password |
| --- | --- | --- |
| Administrator | admin@examvault.test | Admin#2026 |
| Examiner | examiner@examvault.test | Examiner#2026 |
| Examiner (second, for authz demo) | examiner2@examvault.test | Examiner#2026 |
| Candidate | ayesha@examvault.test | Candidate#2026 |
| Candidate | bilal@examvault.test | Candidate#2026 |
| Candidate (not enrolled) | sara@examvault.test | Candidate#2026 |

Seeded exams: "Data Structures Midterm" (completed, results published), "Web Engineering Quiz" (ongoing),
"Database Systems Final" (published, upcoming), "Networks Practice" (draft).

## 15-minute script (highest marks first)
| Min | Step | Shows |
| --- | --- | --- |
| 0:00 | One-line problem + architecture slide (README diagram) | context |
| 0:45 | Examiner: question bank filters, 3 question types, multi-select scheme | C-3.3 |
| 2:00 | Examiner: create exam, assign questions, review checklist, publish, enroll Ayesha via CSV import with a bad row | C-3.2, C-3.4, S-4.4 |
| 4:00 | Candidate Ayesha (second browser): home groups, lobby, start; palette states, flag, scratchpad, prefs | C-3.4.2, C-3.5.1, S-4.7, S-4.8 |
| 5:30 | Failure resilience: wifi off, answer 2, refresh, wifi on, Saved; change device clock | I-5.3, S-4.1, T-6.2a |
| 7:30 | Examiner monitor: progress, connection_gap with cause, announcement, grant extension with reason; Declare an outage for everyone affected | C-3.6, I-5.3 |
| 9:00 | Candidate submits (double-click), then attempt locked | C-3.5.3, T-6.2b |
| 9:45 | Examiner grading: written answer, invalid mark rejected, totals, publish blocked until graded, publish | C-3.7, C-3.8.1 |
| 11:15 | Analytics + question analytics on the completed exam | C-3.8.2, S-4.5 |
| 12:15 | Candidate result, download PDF, scan QR, public verify page | S-4.2, S-4.6 |
| 13:15 | Disputes: candidate questions a mark; examiner evidence pack, void for everyone; old QR shows Replaced | I-5.4 |
| 13:45 | Security: candidate Sara opens Ayesha's attempt URL, examiner2 opens examiner's exam; network tab has no answer keys; admin changes a role | C-3.1, T-6.1 |
| 14:30 | Questions | |

## Likely judge questions
| Question | Answer |
| --- | --- |
| What if the candidate changes the device clock? | Deadline lives on the server; client only shows deadline minus server-synced now. |
| Can a candidate call the API for another exam or attempt? | No. Every service checks enrollment/ownership; foreign IDs return 404. |
| Where are answer keys? | Only in `attempts.key` and `question_options.is_correct`, never selected in candidate DTOs. |
| Double submit or network retry? | Submit locks the row and checks status; repeats return the same finalized result. |
| Candidate goes offline at the end? | Answers in the local journal sync on reconnect if before deadline; later ones are rejected and logged; examiner may grant an audited extension based on server-measured outage. |
| Does editing a question affect running attempts? | No. Paper and key are frozen at attempt start. |
| Does preview pollute statistics? | No. Sandbox attempts are flagged and excluded from every aggregate. |
| How is a PDF verified without leaking data? | Random code in QR; public page shows status, exam title, masked name, score, date only. |
| Is a tab switch treated as cheating? | No. It is a signal for review with a disclaimer; the examiner decides. |
| Why polling not websockets? | Free-tier serverless friendly, 5 to 15 s latency is enough for exams. |
| What happens if the server never sees the deadline pass? | Lazy finalization: the next read, save or monitor poll finalizes it in a transaction. |
| A hidden tab misses heartbeats. Is that an outage? | No. Heartbeats and saves carry how long the tab was hidden or offline; the server labels the gap "background tab" and does not count it. |
| The server itself went down for 40 candidates. Now what? | Declare an outage: pick the window, the server shows each candidate's own measured loss, one click grants each their amount with one audited reason. Retries apply once; declaring twice cannot pay twice. |
| Can a candidate get extra time by pulling the cable? | They lose the time like anyone else; extra time is only ever an examiner decision, and the evidence shows offline vs no contact vs background tab. |
| What if a question was simply wrong? | A dispute leads to "void for everyone": one rule (exclude or full marks) recalculated on every paper in one transaction, sibling disputes closed, old reports Replaced. |
| Can a candidate spam disputes? | One per question, at most 5 per attempt, 7 days after publication, a 20 character explanation; withdrawal is final. |
| What does the examiner see when deciding? | The question as that candidate saw it, their answer, key and rubric, grading history, outage record and how the whole cohort answered. |
