/** Display helpers. Timezone defaults to the browser; the server renders in the event's timezone. */
const TZ = typeof window === "undefined" ? (process.env.APP_TIMEZONE ?? "Asia/Karachi") : undefined

export function fmtDateTime(d: Date | string | null | undefined) {
  if (!d) return "Not set"
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(d))
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "Not set"
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }).format(new Date(d))
}

export function fmtMarks(n: number | null | undefined) {
  if (n === null || n === undefined) return "-"
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, "")
}

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return m ? `${h} h ${m} min` : `${h} h`
}

/** mm:ss or h:mm:ss for countdowns. */
export function fmtClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (x: number) => String(x).padStart(2, "0")
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** Value for <input type="datetime-local"> in the browser's timezone. */
export function toLocalInput(d: Date | string | null | undefined) {
  if (!d) return ""
  const x = new Date(d)
  const off = x.getTimezoneOffset() * 60_000
  return new Date(x.getTime() - off).toISOString().slice(0, 16)
}

export const round2 = (n: number) => Math.round(n * 100) / 100
