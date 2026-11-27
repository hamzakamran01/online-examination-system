/** RFC 4180 records, including physical starting lines for diagnostics. */
export function readCsv(source: string) {
  const records: { line: number; cells: string[] }[] = []
  let cells: string[] = [],
    field = "",
    line = 1,
    start = 1
  let quoted = false,
    closed = false
  function finish() {
    cells.push(field)
    if (cells.length > 1 || field.trim()) records.push({ line: start, cells })
    if (records.length > 501) throw Error("Use at most 500 data rows.")
    cells = []
    field = ""
    closed = false
  }
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
          closed = true
        }
      } else {
        field += ch
        if (ch === "\n" || (ch === "\r" && source[i + 1] !== "\n")) line++
      }
    } else if (ch === ",") {
      cells.push(field)
      field = ""
      closed = false
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && source[i + 1] === "\n") i++
      finish()
      start = ++line
    } else if (ch === '"' && !field && !closed) quoted = true
    else if (closed || ch === '"') throw Error(`Invalid quotation on line ${line}.`)
    else field += ch
  }
  if (quoted) throw Error(`Unclosed quotation on line ${start}.`)
  finish()
  return records
}
