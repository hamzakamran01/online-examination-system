import { and, eq, inArray } from "drizzle-orm"
import { db } from "./client"
import { answers, attempts, exams, user } from "./schema"
import { createExam, setExamQuestions, publishExam, closeExam } from "../services/exams"
import { enrollCandidates } from "../services/enrollments"
import { listQuestions, getQuestion } from "../services/questions"
import {
  startAttempt,
  getAttemptView,
  saveAnswers,
  submitAttempt,
  recalcAttempt,
  finalizeAllForExam,
} from "../services/attempts"
import { effectiveStatus } from "@/lib/domain/exam-status"
import type { SaveAnswersInput } from "@/lib/validation/attempts"

const title = "Algorithms Final (demo)"
const handles = ["ayesha", "bilal", "usman", "fatima", "hassan", "zainab", "omar"]
const paragraphs = [
  "An array shifts existing elements when inserting at the front but allows constant-time indexing. A linked list can prepend by updating the head pointer, but indexing takes a traversal. Arrays use contiguous storage; lists pay for pointers. I would choose an array for an index-heavy workload.",
  "Linked lists prepend in constant time and have linear random access. Arrays take linear time to prepend, but indexing is constant time. Linked lists use extra memory for links. I would use one for a queue with front insertions.",
  "Arrays let us jump directly to an index. Linked lists need a traversal, but adding a new head is fast. I would use an array for repeated indexed reads.",
  "Adding an element to the front of an array shifts the existing elements. A linked list can change the head reference without shifting anything.",
  "An array stores values together. A linked list connects separately allocated nodes, which also need space for links.",
  "I would use a linked list when repeatedly adding items to the front because I can update the head pointer.",
  "An array lets me retrieve an element by its index. A linked list requires following the links from the beginning.",
]
const writtenMarks = [6, 5.5, 4, 3.5, 3.5, 2.5, 2]

async function main() {
  if ((await db.select({ id: exams.id }).from(exams).where(eq(exams.title, title))).length) {
    console.log(title + " already exists.")
    return
  }
  const emails = ["examiner", ...handles].map((h) => h + "@examvault.test")
  const people = await db.select().from(user).where(inArray(user.email, emails))
  const accounts = emails.map((email) => {
    const person = people.find((p) => p.email === email && p.active)
    if (!person) throw Error("Missing active demo user " + email)
    return { id: person.id, name: person.name, email: person.email, role: person.role }
  })
  const [examiner, ...candidates] = accounts
  const bank = await listQuestions(examiner)
  const questions = await Promise.all(
    bank.filter((q) => q.topicName === "Data Structures").map((q) => getQuestion(examiner, q.id)),
  )
  const total = questions.reduce((sum, q) => sum + q.defaultMarks, 0)
  if (questions.length !== 6 || total !== 13) throw Error("Expected the six seeded Data Structures items.")
  const byId = new Map(questions.map((q) => [q.id, q]))
  const now = Date.now()
  const { id } = await createExam(examiner, {
    title,
    instructions: "Answer the objective questions and explain your reasoning in the written response.",
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + 3_600_000).toISOString(),
    durationMin: 30,
    totalMarks: total,
    passMark: 7,
  })
  await setExamQuestions(examiner, {
    examId: id,
    items: questions.map((q) => ({ questionId: q.id, marks: q.defaultMarks })),
  })
  await enrollCandidates(examiner, { examId: id, candidateIds: candidates.map((c) => c.id) })
  await publishExam(examiner, id)
  const summary = []
  for (const [index, candidate] of candidates.entries()) {
    const { attemptId } = await startAttempt(candidate, id)
    const view = await getAttemptView(candidate, attemptId)
    const responses: SaveAnswersInput["answers"] = []
    for (const item of view.paper.items) {
      const q = byId.get(item.itemId)!
      const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id)
      const wrong = q.options.find((o) => !o.isCorrect)?.id
      if (index >= 5 && q.defaultMarks === 2 && q.type === "single") continue
      const selected =
        q.type === "multi" && index >= 2
          ? [...correct.slice(0, index < 5 ? 2 : 0), ...(wrong ? [wrong] : [])]
          : q.type === "single" && index >= 4 && /Dijkstra/.test(q.stem)
            ? wrong
              ? [wrong]
              : []
            : correct
      responses.push({
        itemId: item.itemId,
        seq: 1,
        flagged: false,
        response: q.type === "written" ? { kind: "text", text: paragraphs[index] } : { kind: "choice", selected },
      })
    }
    await saveAnswers(candidate, attemptId, { clientId: "demo-activity", answers: responses })
    await submitAttempt(candidate, attemptId)
    const result = await db.transaction(async (tx) => {
      const [attempt] = await tx
        .select({ id: attempts.id, paper: attempts.paper, examId: attempts.examId })
        .from(attempts)
        .where(eq(attempts.id, attemptId))
        .for("update")
      for (const item of attempt.paper.items.filter((i) => i.type === "written")) {
        await tx
          .update(answers)
          .set({ manualScore: Math.min(item.marks, writtenMarks[index]), gradedBy: examiner.id, gradedAt: new Date() })
          .where(and(eq(answers.attemptId, attemptId), eq(answers.itemId, item.itemId)))
      }
      await recalcAttempt(tx, attempt)
      const [row] = await tx
        .select({ score: attempts.scoreTotal, max: attempts.maxMarks })
        .from(attempts)
        .where(eq(attempts.id, attemptId))
      return row
    })
    summary.push({
      candidate: candidate.name,
      attemptId,
      ...result,
      percent: Math.round((100 * (result.score ?? 0)) / result.max),
    })
  }
  await closeExam(examiner, id, finalizeAllForExam)
  await db
    .update(exams)
    .set({ resultsPublishedAt: new Date() })
    .where(and(eq(exams.id, id), eq(exams.ownerId, examiner.id)))

  const [web] = await db
    .select()
    .from(exams)
    .where(and(eq(exams.title, "Web Engineering Quiz"), eq(exams.ownerId, examiner.id)))
  if (web && effectiveStatus(web) === "ongoing") {
    for (const candidate of [candidates[1], candidates[2], candidates[4]]) {
      const [existing] = await db
        .select({ id: attempts.id })
        .from(attempts)
        .where(and(eq(attempts.examId, web.id), eq(attempts.candidateId, candidate.id), eq(attempts.isSandbox, false)))
      if (existing) continue
      const { attemptId } = await startAttempt(candidate, web.id)
      const view = await getAttemptView(candidate, attemptId)
      await saveAnswers(candidate, attemptId, {
        clientId: "demo-activity",
        answers: view.paper.items
          .filter((item) => item.type !== "written")
          .slice(0, 3)
          .map((item) => ({
            itemId: item.itemId,
            seq: 1,
            flagged: false,
            response: { kind: "choice", selected: [item.options[0].id] },
          })),
      })
    }
  } else console.log("Web Engineering Quiz is outside its availability window.")
  console.log(title + " " + id)
  console.table(summary)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
