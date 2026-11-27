import { Skeleton } from "@/components/ui/skeleton"

/** Mirrors the overview layout (header, KPI row, three panels, chart and trail) so nothing jumps. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading platform overview">
      <span className="sr-only">Loading platform overview</span>
      <Skeleton className="h-3 w-56" />
      <Skeleton className="mt-3 h-8 w-80" />
      <Skeleton className="mt-3 mb-6 h-4 w-96 max-w-full" />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[148px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[230px] rounded-xl" />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  )
}
