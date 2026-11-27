import "server-only"
import { and, asc, desc, eq, ilike, inArray, isNull, sql, type SQL } from "drizzle-orm"
import { db, type Tx } from "@/server/db/client"
import { examQuestions, exams, questionOptions, questions, topics } from "@/server/db/schema"
import type { SessionUser } from "@/server/auth/guards"
import { AppError, notFound } from "@/server/errors"
import { audit } from "./audit"
import { questionFilterSchema, questionSchema, type QuestionFilter, type QuestionInput } from "@/lib/validation/questions"

function assertExaminer(actor: SessionUser) {
  if (actor.role !== "examiner" && actor.role !== "admin") throw new AppError("FORBIDDEN", "Only examiners can manage questions.")
}

/** Examiners see their own bank. Admins can read every bank. */
const ownerScope = (actor: SessionUser) => (actor.role === "admin" ? undefined : eq(questions.ownerId, actor.id))

export async function listTopics(actor: SessionUser) {
  assertExaminer(actor)
  return db
    .select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(actor.role === "admin" ? undefined : eq(topics.ownerId, actor.id))
    .orderBy(asc(topics.name))
}

export async function listQuestions(actor: SessionUser, rawFilter: QuestionFilter = {}) {
  assertExaminer(actor)
  const f = questionFilterSchema.parse(rawFilter)
  const where: (SQL | undefined)[] = [ownerScope(actor), isNull(questions.archivedAt)]
  if (f.type) where.push(eq(questions.type, f.type))
  if (f.difficulty) where.push(eq(questions.difficulty, f.difficulty))
  if (f.topic) where.push(eq(questions.topicId, f.topic))
  if (f.q) where.push(ilike(questions.stem, `%${f.q}%`))

  return db
    .select({
      id: questions.id,
      type: questions.type,
      difficulty: questions.difficulty,
      stem: questions.stem,
      defaultMarks: questions.defaultMarks,
      multiScheme: questions.multiScheme,
      topicId: questions.topicId,
      topicName: topics.name,
      updatedAt: questions.updatedAt,
      optionCount: sql<number>`(select count(*)::int from ${questionOptions} where ${questionOptions.questionId} = ${questions.id})`,
      usedIn: sql<number>`(select count(*)::int from ${examQuestions} where ${examQuestions.questionId} = ${questions.id})`,
    })
    .from(questions)
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .where(and(...where))
    .orderBy(desc(questions.updatedAt))
}

export async function getQuestion(actor: SessionUser, id: string) {
  assertExaminer(actor)
  const [q] = await db
    .select({ question: questions, topicName: topics.name })
    .from(questions)
    .leftJoin(topics, eq(topics.id, questions.topicId))
    .where(and(eq(questions.id, id), ownerScope(actor), isNull(questions.archivedAt)))
    .limit(1)
  if (!q) throw notFound("Question")
  const options = await db
    .select({ id: questionOptions.id, text: questionOptions.text, isCorrect: questionOptions.isCorrect })
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id))
    .orderBy(asc(questionOptions.position))
  return { ...q.question, topicName: q.topicName ?? "", options }
}

async function resolveTopic(tx: Tx, ownerId: string, name: string) {
  const clean = name.trim()
  if (!clean) return null
  await tx.insert(topics).values({ ownerId, name: clean }).onConflictDoNothing()
  const [t] = await tx
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.ownerId, ownerId), eq(topics.name, clean)))
  return t.id
}

/**
 * Questions inside a published (scheduled or ongoing) exam are locked so every
 * candidate of that exam receives identical content. Attempts already store a
 * frozen copy, so completed exams do not block edits.
 */
async function assertEditable(tx: Tx, questionId: string) {
  const [locked] = await tx
    .select({ title: exams.title })
    .from(examQuestions)
    .innerJoin(exams, eq(exams.id, examQuestions.examId))
    .where(and(eq(examQuestions.questionId, questionId), eq(exams.status, "published")))
    .limit(1)
  if (locked)
    throw new AppError(
      "CONFLICT",
      `This question is part of the published exam "${locked.title}" and cannot change. Duplicate it to make a new version.`
    )
}

export async function saveQuestion(actor: SessionUser, raw: QuestionInput) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only examiners can author questions.")
  const input = questionSchema.parse(raw)

  return db.transaction(async (tx) => {
    const topicId = await resolveTopic(tx, actor.id, input.topicName)
    const values = {
      type: input.type,
      stem: input.stem,
      difficulty: input.difficulty,
      defaultMarks: input.defaultMarks,
      multiScheme: input.type === "multi" ? input.multiScheme : ("all_or_nothing" as const),
      rubric: input.type === "written" ? input.rubric || null : null,
      topicId,
    }

    let id = input.id
    if (id) {
      const [existing] = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(and(eq(questions.id, id), eq(questions.ownerId, actor.id), isNull(questions.archivedAt)))
        .for("update")
      if (!existing) throw notFound("Question")
      await assertEditable(tx, id)
      await tx.update(questions).set(values).where(eq(questions.id, id))
      await tx.delete(questionOptions).where(eq(questionOptions.questionId, id))
    } else {
      const [created] = await tx.insert(questions).values({ ...values, ownerId: actor.id }).returning({ id: questions.id })
      id = created.id
    }

    if (input.type !== "written" && input.options.length) {
      await tx
        .insert(questionOptions)
        .values(input.options.map((o, position) => ({ questionId: id!, text: o.text, isCorrect: o.isCorrect, position })))
    }
    await audit(tx, actor.id, input.id ? "question.updated" : "question.created", "question", id, { type: input.type })
    return { id }
  })
}

export async function duplicateQuestion(actor: SessionUser, id: string) {
  const q = await getQuestion(actor, id)
  if (q.ownerId !== actor.id) throw notFound("Question")
  return saveQuestion(actor, {
    type: q.type,
    stem: `${q.stem} (copy)`,
    topicName: q.topicName,
    difficulty: q.difficulty,
    defaultMarks: q.defaultMarks,
    multiScheme: q.multiScheme,
    rubric: q.rubric ?? "",
    options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
  })
}

export async function archiveQuestion(actor: SessionUser, id: string) {
  if (actor.role !== "examiner") throw new AppError("FORBIDDEN", "Only examiners can archive questions.")
  await db.transaction(async (tx) => {
    const [q] = await tx
      .select({ id: questions.id })
      .from(questions)
      .where(and(eq(questions.id, id), eq(questions.ownerId, actor.id), isNull(questions.archivedAt)))
      .for("update")
    if (!q) throw notFound("Question")
    const [inDraft] = await tx
      .select({ title: exams.title })
      .from(examQuestions)
      .innerJoin(exams, eq(exams.id, examQuestions.examId))
      .where(and(eq(examQuestions.questionId, id), inArray(exams.status, ["draft", "published"])))
      .limit(1)
    if (inDraft) throw new AppError("CONFLICT", `Remove this question from "${inDraft.title}" before archiving it.`)
    await tx.update(questions).set({ archivedAt: new Date() }).where(eq(questions.id, id))
    await audit(tx, actor.id, "question.archived", "question", id)
  })
}
