import { ShieldAlert, TimerReset, WifiOff } from "lucide-react"
import { fmtDateTime } from "@/lib/format"
import { GAP_CAUSE_LABEL, OUTAGE_CAUSES, SIGNAL_DISCLAIMER } from "@/lib/domain/monitoring"
import { Panel } from "@/components/shell/page-header"
import { Badge } from "@/components/ui/badge"
import type { AttemptEvidence } from "@/server/services/monitoring"

function dur(sec: number) {
  if (sec < 60) return `${sec} s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s ? `${m} min ${s} s` : `${m} min`
}

/**
 * Attempt evidence beside the answers (I-5.3, I-5.4): server-measured outages with their
 * likely cause, extra time and its reasons, and review signals. Shown to graders and
 * dispute reviewers so decisions use the record, never an impression. Signals are
 * context, not proof (invariant 8).
 */
export function EvidencePanel({ evidence, title = "Attempt evidence" }: { evidence: AttemptEvidence; title?: string }) {
  const outages = evidence.gaps.filter((g) => OUTAGE_CAUSES.includes(g.cause))
  const background = evidence.gaps.filter((g) => g.cause === "background_tab")
  return (
    <Panel className="space-y-3 p-5" aria-labelledby="evidence-title">
      <h2 id="evidence-title" className="flex items-center gap-2 text-sm font-semibold">
        <ShieldAlert className="size-4 text-muted-foreground" aria-hidden />
        {title}
      </h2>
      <p className="text-sm">{evidence.summary}</p>

      {outages.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <WifiOff className="size-3.5" aria-hidden />
            Server-measured outages ({dur(evidence.outageSec)})
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {outages.map((g, i) => (
              <li key={i}>
                <span className="font-medium text-foreground tabular-nums">{dur(g.sec)}</span>
                {g.from && ` from ${new Date(g.from).toLocaleTimeString()}`}. {GAP_CAUSE_LABEL[g.cause]}.
              </li>
            ))}
          </ul>
        </div>
      )}
      {background.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {dur(evidence.backgroundSec)} of silence while the tab was in the background. Browsers slow timers in hidden tabs, so this is
          not counted as an outage.
        </p>
      )}

      {evidence.extensions.length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-medium">
            <TimerReset className="size-3.5" aria-hidden />
            Extra time
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {evidence.extensions.map((x, i) => (
              <li key={i}>
                <span className="font-medium text-foreground">+{dur(x.seconds)}</span> {fmtDateTime(x.at)}
                {x.incident && (
                  <Badge variant="outline" className="ml-1">
                    Declared outage
                  </Badge>
                )}
                <span className="block">Reason: {x.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {evidence.signals.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium">Signals for review</p>
          <ul className="flex flex-wrap gap-1.5">
            {evidence.signals.map((s) => (
              <li key={s.type}>
                <Badge variant="muted">
                  {s.label}: {s.count}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="border-t pt-3 text-xs text-muted-foreground">{SIGNAL_DISCLAIMER}</p>
    </Panel>
  )
}
