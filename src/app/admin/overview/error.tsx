"use client"
import { Button } from "@/components/ui/button"
export default function ErrorView({ reset }: { reset: () => void }) {
  return (
    <div className="space-y-3">
      <p role="alert">The platform overview could not load.</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
