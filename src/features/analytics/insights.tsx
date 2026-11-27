"use client"
import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts"
import { Panel, PanelHeader, Stat } from "@/components/shell/page-header"
import type { ExamAnalytics } from "@/server/services/analytics"
const number = (n: number | null) =>
  n === null ? "Pending" : n.toLocaleString(undefined, { maximumFractionDigits: 1 })
export function Insights({ data }: { data: ExamAnalytics }) {
  const [ascending, sort] = useState(false)
  const { stats, candidates, questions } = data
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
      </div>
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
                  "Fully correct",
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
                    {q.skip >= 30 && <p className="text-warning-text">Frequently skipped</p>}
                    {q.correct !== null && q.correct < 40 && <p className="text-warning-text">Commonly incorrect</p>}
                  </td>
                  <td>{q.seen}</td>
                  <td>{number(100 - q.skip)}%</td>
                  <td>{number(q.skip)}%</td>
                  <td>{q.correct === null ? "Written" : number(q.correct) + "%"}</td>
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
    </div>
  )
}
