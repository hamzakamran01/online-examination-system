import { test } from "node:test"
import assert from "node:assert/strict"
import { scoreItem, isAnswered } from "../src/server/domain/grading"
import { effectiveStatus } from "../src/lib/domain/exam-status"
import { questionSchema } from "../src/lib/validation/questions"
import { examSchema } from "../src/lib/validation/exams"
import { readCsv } from "../src/lib/csv"
import { discrimination, median, scoreBucket } from "../src/server/services/analytics"
import type { PaperItem } from "../src/lib/domain/paper"

const item: PaperItem = {
  itemId: "q",
  type: "multi",
  stem: "Sample question",
  marks: 6,
  scheme: "partial",
  topic: null,
  difficulty: "medium",
  options: [],
}
const key = { correct: ["a", "b", "c"] }
for (const [name, type, scheme, selected, expected] of [
  ["single correct", "single", "all_or_nothing", ["a"], 6],
  ["single wrong", "single", "all_or_nothing", ["x"], 0],
  ["single two selected", "single", "all_or_nothing", ["a", "b"], 0],
  ["all or nothing exact", "multi", "all_or_nothing", ["c", "a", "b"], 6],
  ["all or nothing subset", "multi", "all_or_nothing", ["a", "b"], 0],
  ["all or nothing superset", "multi", "all_or_nothing", ["a", "b", "c", "x"], 0],
  ["partial two of three", "multi", "partial", ["a", "b"], 4],
  ["partial one wrong cancels one right", "multi", "partial", ["a", "b", "x"], 2],
  ["partial every option", "multi", "partial", ["a", "b", "c", "x", "y", "z"], 0],
  ["partial floors at zero", "multi", "partial", ["a", "x", "y"], 0],
  ["duplicate choice counts once", "multi", "partial", ["a", "a"], 2],
  ["unanswered", "multi", "partial", [], 0],
  ["written", "written", "partial", [], null],
] as const)
  test(name, () =>
    assert.equal(scoreItem({ ...item, type, scheme }, key, { kind: "choice", selected: [...selected] }), expected),
  )
test("absent responses and keys", () => {
  assert.equal(scoreItem(item, key, null), 0)
  assert.equal(scoreItem(item, undefined, { kind: "choice", selected: ["a"] }), 0)
  assert.equal(isAnswered(null), false)
  assert.equal(isAnswered({ kind: "text", text: "  " }), false)
  assert.equal(isAnswered({ kind: "text", text: "answer" }), true)
  assert.equal(isAnswered({ kind: "choice", selected: [] }), false)
  assert.equal(isAnswered({ kind: "choice", selected: ["a"] }), true)
})
test("effective status boundaries", () => {
  const exam = { status: "published" as const, startsAt: new Date(1000), endsAt: new Date(2000) }
  assert.equal(effectiveStatus(exam, new Date(999)), "published")
  assert.equal(effectiveStatus(exam, new Date(1000)), "ongoing")
  assert.equal(effectiveStatus(exam, new Date(1999)), "ongoing")
  assert.equal(effectiveStatus(exam, new Date(2000)), "completed")
  assert.equal(effectiveStatus({ ...exam, status: "completed" }, new Date(0)), "completed")
  assert.equal(effectiveStatus({ ...exam, status: "draft" }, new Date(3000)), "draft")
})
const options = [
  { text: "Alpha", isCorrect: true },
  { text: "Beta", isCorrect: false },
]
const question = { type: "single", stem: "Which option matches?", difficulty: "easy", defaultMarks: 1.5, options }
for (const [name, change, expected] of [
  ["single zero correct", { options: options.map((o) => ({ ...o, isCorrect: false })) }, false],
  ["single two correct", { options: options.map((o) => ({ ...o, isCorrect: true })) }, false],
  ["multi zero correct", { type: "multi", options: options.map((o) => ({ ...o, isCorrect: false })) }, false],
  ["duplicate options", { options: [options[0], { text: "ALPHA", isCorrect: false }] }, false],
  ["written with choices", { type: "written" }, false],
  ["written without choices", { type: "written", options: [] }, true],
  ["half marks", {}, true],
  ["quarter marks", { defaultMarks: 1.25 }, false],
  ["zero marks", { defaultMarks: 0 }, false],
] as const)
  test(name, () => assert.equal(questionSchema.safeParse({ ...question, ...change }).success, expected))
test("exam validation", () => {
  const exam = {
    title: "Sample exam",
    startsAt: "2026-11-27T01:00:00Z",
    endsAt: "2026-11-27T02:00:00Z",
    durationMin: 60,
    totalMarks: 10,
    passMark: 5,
  }
  assert.equal(examSchema.safeParse(exam).success, true)
  assert.equal(examSchema.safeParse({ ...exam, endsAt: "2026-11-27T00:00:00Z" }).success, false)
  assert.equal(examSchema.safeParse({ ...exam, durationMin: 61 }).success, false)
  assert.equal(examSchema.safeParse({ ...exam, passMark: 11 }).success, false)
  assert.equal(examSchema.safeParse({ ...exam, passMark: 10 }).success, true)
})
test("CSV records and limits", () => {
  const rows = readCsv('name,notes\r\n"Smith, Jane","He said ""hello""."\r\n"two\r\nlines",record\r\nAFTER,line')
  assert.equal(rows.length, 4)
  assert.deepEqual(rows[0].cells, ["name", "notes"])
  assert.equal(rows[1].cells[0], "Smith, Jane")
  assert.equal(rows[1].cells[1], 'He said "hello".')
  assert.equal(rows[2].cells[0], "two\r\nlines")
  assert.equal(rows[2].line, 3)
  assert.equal(rows[3].line, 5)
  assert.throws(() => readCsv('name\n"open'), /Unclosed quotation/)
  assert.throws(() => readCsv("name\n" + "row\n".repeat(501)), /500 data rows/)
  assert.equal(readCsv("name\n" + "row\n".repeat(500)).length, 501)
})
test("analytics math", () => {
  assert.equal(median([]), null)
  assert.equal(median([5]), 5)
  assert.equal(median([9, 2, 6]), 6)
  assert.equal(median([9, 2, 6, 4]), 5)
  for (let i = 0; i < 10; i++) assert.equal(scoreBucket(i * 10), i)
  assert.equal(scoreBucket(100), 9)
  assert.equal(scoreBucket(99.99), 9)
  assert.equal(scoreBucket(-1), 0)
  assert.equal(discrimination([true], [false]), 1)
  assert.equal(discrimination([false], [true]), -1)
  assert.equal(discrimination([true, false], [false]), 0.5)
  assert.equal(discrimination([true], []), null)
  assert.equal(discrimination([], [true]), null)
})
