/**
 * Creates a live exam for a manual browser walkthrough of the monitor (test branch only).
 * Run: pnpm tsx --conditions=react-server --env-file=.env.test scripts/setup-monitor-demo.ts
 * Prints the exam id. Delete with: ... setup-monitor-demo.ts --delete <examId>
 */
import { and, eq, isNull } from "drizzle-orm"
import { db } from "@/server/db/client"
import { enrollments, examQuestions, exams, questions, user } from "@/server/db/schema"

async function main() {
  if (process.argv[2] === "--delete") {
    await db.delete(exams).where(eq(exams.id, process.argv[3]))
    console.log("deleted")
    process.exit(0)
  }
  const [examiner] = await db.select().from(user).where(eq(user.email, "examiner@examvault.test"))
  const cands = await db.select().from(user).where(eq(user.role, "candidate"))
  const qs = await db
    .select({ id: questions.id })
    .from(questions)
    .where(and(eq(questions.ownerId, examiner.id), isNull(questions.archivedAt)))
    .limit(4)
  const now = Date.now()
  const [exam] = await db
    .insert(exams)
    .values({
      ownerId: examiner.id,
      title: "Live Monitor Walkthrough",
      instructions: "Answer every question.",
      startsAt: new Date(now - 60_000),
      endsAt: new Date(now + 2 * 3_600_000),
      durationMin: 45,
      totalMarks: qs.length,
      status: "published",
      publishedAt: new Date(now),
    })
    .returning()
  await db.insert(examQuestions).values(qs.map((q, i) => ({ examId: exam.id, questionId: q.id, position: i, marks: 1 })))
  await db.insert(enrollments).values(cands.filter((c) => c.email !== "sara@examvault.test").map((c) => ({ examId: exam.id, candidateId: c.id, enrolledBy: examiner.id })))
  console.log(exam.id)
  process.exit(0)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
