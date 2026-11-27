"use client"
import { Bar, BarChart, XAxis, YAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export function ActivityChart({ days }: { days: { date: string; count: number }[] }) {
  return (
    <ChartContainer className="h-60 w-full" config={{ count: { label: "Submissions", color: "var(--primary)" } }}>
      <BarChart accessibilityLayer data={days}>
        <XAxis dataKey="date" tickFormatter={(day) => day.slice(5)} minTickGap={16} />
        <YAxis allowDecimals={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={3} />
      </BarChart>
    </ChartContainer>
  )
}
