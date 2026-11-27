"use client"
import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Panel, PanelHeader, Stat, MetricStrip } from "@/components/shell/page-header"
import type { ExamAnalytics } from "@/server/services/analytics"
const flagHelp: Record<string, string> = {
  "Not enough data": "Fewer than five graded responses.",
  "Very hard or flawed": "Fewer than 20% met the scoring threshold.",
  "Too easy": "More than 95% met the scoring threshold.",
  "Review wording": "The upper group performed less than 10 percentage points better.",
  "Frequently skipped": "At least 30% of candidates who received this item skipped it.",
  "Strong distractor": "At least 40% of candidates who received this item chose the same wrong option.",
}
const number = (n: number | null) =>
  n === null ? "Pending" : n.toLocaleString(undefined, { maximumFractionDigits: 1 })
export function Insights({ data }: { data: ExamAnalytics }) {
  const [ascending, sort] = useState(false)
  const { stats, candidates, questions } = data
  const pending = candidates.filter((candidate) => candidate.grading === "pending").length
  if (!stats.count)
    return (
      <Panel>
        <PanelHeader
          title="No finalized attempts yet"
          description="Performance statistics appear after a candidate submits."
        />
      </Panel>
    )
  return (
    <div className="space-y-6">
      {pending > 0 && (
        <p className="rounded-lg border bg-warning-soft p-3 text-sm text-warning-text">
          {pending} {pending === 1 ? "attempt includes" : "attempts include"} ungraded written answers. Scores may rise.
        </p>
      )}
      <MetricStrip className="md:grid-cols-3 lg:grid-cols-3">
        {Object.entries({
          "Finalized attempts": stats.count,
          Mean: stats.mean,
          Median: stats.median,
          Highest: stats.high,
          Lowest: stats.low,
        }).map(([label, value]) => (
          <Stat key={label} label={label} value={number(value)} />
        ))}
        {stats.passRate !== null && <Stat label="Pass rate" value={number(stats.passRate) + "%"} />}
      </MetricStrip>
      <Panel>
        <PanelHeader
          title="Score distribution"
          description="Finalized attempts by percentage score. Scores pending grading can change."
        />
        <div className="h-60 p-3">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.distribution}>
              <XAxis dataKey="range" fontSize={10} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" name="Attempts" fill="var(--primary)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="Candidate scores" />
        <div className="overflow-x-auto p-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th>Candidate</th>
                <th aria-sort={ascending ? "ascending" : "descending"}>
                  <button onClick={() => sort(!ascending)}>Score {ascending ? "↑" : "↓"}</button>
                </th>
                <th>Percent</th>
                <th>Status</th>
                <th>Grading</th>
              </tr>
            </thead>
            <tbody>
              {(ascending ? [...candidates].reverse() : candidates).map((c) => (
                <tr key={c.id} className="border-t">
                  <td className="py-2">{c.name}</td>
                  <td>
                    {number(c.score)} / {number(c.max)}
                  </td>
                  <td>{number(c.percent)}%</td>
                  <td>{c.status.replaceAll("_", " ")}</td>
                  <td>{c.grading}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <PanelHeader
          title="Question insights"
          description="Rates use the attempts that contained each question. Written averages exclude responses awaiting marks."
        />
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[55rem] text-left text-sm">
            <thead>
              <tr>
                {[
                  "Question",
                  "Seen",
                  "Answered",
                  "Skipped",
                  "Met threshold",
                  "Discrimination",
                  "Average / max",
                  "Authored / observed",
                  "Most chosen wrong option",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id} className="border-t">
                  <td className="max-w-xs py-3 pr-3">
                    {q.stem}
                    <ul className="mt-2 flex flex-wrap gap-1">
                      {q.flags.map((flag) => (
                        <li
                          key={flag}
                          tabIndex={0}
                          title={flagHelp[flag]}
                          className="rounded-full bg-warning-soft px-2 py-0.5 text-xs text-warning-text"
                        >
                          {flag}
                          <span className="sr-only">. {flagHelp[flag]}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>{q.seen}</td>
                  <td>{number(100 - q.skip)}%</td>
                  <td>{number(q.skip)}%</td>
                  <td>{q.correct === null ? "Pending" : number(q.correct) + "%"}</td>
                  <td>
                    {q.index === null ? q.discriminationLabel : `${q.index.toFixed(2)} (${q.discriminationLabel})`}
                  </td>
                  <td>
                    {number(q.avg)} / {number(q.max)}
                  </td>
                  <td>
                    {q.authored} / {q.observed}
                  </td>
                  <td>{q.wrong ?? "None"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <PanelHeader title="How to read this" />
        <p className="p-4 text-sm text-muted-foreground">
          Discrimination compares the top and bottom 27% by exam percentage. It measures the difference in the share
          earning full marks on an objective item or at least half marks on a written item. Only candidates who received
          the item count, and written answers awaiting marks are excluded. Flags identify items to review once there are
          at least five graded responses.
        </p>
      </Panel>
    </div>
  )
}
