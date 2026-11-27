/**
 * Demo seed (fictional data). Run: pnpm db:seed
 * Resets every table, then creates accounts, a question bank and exams in
 * different lifecycle states. Safe to re-run before a demo.
 */
import { sql } from "drizzle-orm"
import { db } from "./client"
import * as s from "./schema"
import { insertUserWithPassword } from "@/server/services/users"

type Q = {
  topic: string
  type: "single" | "multi" | "written"
  difficulty: "easy" | "medium" | "hard"
  stem: string
  marks: number
  scheme?: "all_or_nothing" | "partial"
  rubric?: string
  options?: [string, boolean][]
}

const BANK: Q[] = [
  // Web Engineering
  { topic: "Web Engineering", type: "single", difficulty: "easy", marks: 1, stem: "Which HTTP status code means the requested resource was not found?", options: [["200", false], ["301", false], ["404", true], ["500", false]] },
  { topic: "Web Engineering", type: "single", difficulty: "easy", marks: 1, stem: "Which HTML element is the most appropriate for the primary navigation of a page?", options: [["<div>", false], ["<nav>", true], ["<section>", false], ["<menu>", false]] },
  { topic: "Web Engineering", type: "multi", difficulty: "medium", marks: 2, scheme: "partial", stem: "Which of the following HTTP methods are defined as idempotent?", options: [["GET", true], ["PUT", true], ["POST", false], ["DELETE", true]] },
  { topic: "Web Engineering", type: "single", difficulty: "medium", marks: 1, stem: "Which cookie attribute prevents JavaScript from reading the cookie?", options: [["Secure", false], ["SameSite=Strict", false], ["HttpOnly", true], ["Path=/", false]] },
  { topic: "Web Engineering", type: "multi", difficulty: "hard", marks: 3, scheme: "all_or_nothing", stem: "Which measures directly reduce the risk of Cross-Site Scripting (XSS)?", options: [["Escaping output by context", true], ["Content Security Policy", true], ["Using HTTPS only", false], ["Sanitizing untrusted HTML", true], ["Longer session timeouts", false]] },
  { topic: "Web Engineering", type: "written", difficulty: "medium", marks: 5, stem: "Explain why a server must never trust a timer that runs only in the browser during an online exam. Describe how you would enforce the time limit instead.", rubric: "2 marks: client clock can be changed or paused. 2 marks: server stores start and deadline and rejects late saves. 1 mark: client timer is display only and synced to server time." },
  { topic: "Web Engineering", type: "single", difficulty: "hard", marks: 2, stem: "A form is submitted twice because of a double click. Which server-side technique best guarantees only one record is created?", options: [["Disable the button with CSS", false], ["Idempotency key or unique constraint checked in a transaction", true], ["Increase the request timeout", false], ["Store the form in localStorage", false]] },
  // Data Structures
  { topic: "Data Structures", type: "single", difficulty: "easy", marks: 1, stem: "What is the worst-case time complexity of searching in a balanced binary search tree with n nodes?", options: [["O(1)", false], ["O(log n)", true], ["O(n)", false], ["O(n log n)", false]] },
  { topic: "Data Structures", type: "single", difficulty: "easy", marks: 1, stem: "Which data structure follows the First In, First Out (FIFO) principle?", options: [["Stack", false], ["Queue", true], ["Heap", false], ["Tree", false]] },
  { topic: "Data Structures", type: "multi", difficulty: "medium", marks: 2, scheme: "partial", stem: "Which of these sorting algorithms have an average time complexity of O(n log n)?", options: [["Merge sort", true], ["Quick sort", true], ["Bubble sort", false], ["Heap sort", true], ["Insertion sort", false]] },
  { topic: "Data Structures", type: "single", difficulty: "medium", marks: 1, stem: "A hash table resolves collisions by storing colliding keys in a linked list per bucket. What is this technique called?", options: [["Linear probing", false], ["Separate chaining", true], ["Double hashing", false], ["Rehashing", false]] },
  { topic: "Data Structures", type: "single", difficulty: "hard", marks: 2, stem: "Dijkstra's algorithm can produce incorrect results when the graph contains:", options: [["Cycles", false], ["Negative edge weights", true], ["Undirected edges", false], ["More than 1000 vertices", false]] },
  { topic: "Data Structures", type: "written", difficulty: "hard", marks: 6, stem: "Compare an array-based list and a linked list for inserting at the front, random access and memory use. When would you choose each?", rubric: "2 marks per correct comparison (front insert, random access, memory) including a valid use case." },
  // Databases
  { topic: "Databases", type: "single", difficulty: "easy", marks: 1, stem: "Which SQL clause filters groups after aggregation?", options: [["WHERE", false], ["HAVING", true], ["ORDER BY", false], ["LIMIT", false]] },
  { topic: "Databases", type: "multi", difficulty: "medium", marks: 2, scheme: "all_or_nothing", stem: "Which properties are part of ACID?", options: [["Atomicity", true], ["Consistency", true], ["Availability", false], ["Isolation", true], ["Durability", true]] },
  { topic: "Databases", type: "single", difficulty: "medium", marks: 1, stem: "Which normal form removes transitive dependencies on the primary key?", options: [["1NF", false], ["2NF", false], ["3NF", true], ["4NF", false]] },
  { topic: "Databases", type: "single", difficulty: "hard", marks: 2, stem: "Two transactions read the same row and both update it based on the old value. Which SQL feature prevents the lost update?", options: [["SELECT ... FOR UPDATE row lock", true], ["A larger connection pool", false], ["An index on the column", false], ["A view", false]] },
  { topic: "Databases", type: "written", difficulty: "medium", marks: 4, stem: "Design the tables needed to store exam attempts so that a candidate can only have one real attempt per exam. Name the constraint you would use.", rubric: "2 marks: attempts table with exam and candidate keys. 2 marks: unique constraint or partial unique index on (exam_id, candidate_id)." },
  // Networks
  { topic: "Computer Networks", type: "single", difficulty: "easy", marks: 1, stem: "Which protocol is connection-oriented and guarantees ordered delivery?", options: [["UDP", false], ["TCP", true], ["ICMP", false], ["ARP", false]] },
  { topic: "Computer Networks", type: "single", difficulty: "medium", marks: 1, stem: "What is the default port for HTTPS?", options: [["80", false], ["8080", false], ["443", true], ["22", false]] },
  { topic: "Computer Networks", type: "multi", difficulty: "medium", marks: 2, scheme: "partial", stem: "Which of the following are private IPv4 address ranges?", options: [["10.0.0.0/8", true], ["172.16.0.0/12", true], ["192.168.0.0/16", true], ["8.8.8.0/24", false]] },
  { topic: "Computer Networks", type: "written", difficulty: "easy", marks: 3, stem: "In two or three sentences, explain what DNS does when you type a website address into a browser.", rubric: "1 mark: translates names to IP addresses. 1 mark: resolver queries servers or cache. 1 mark: browser then connects to the IP." },
]

const H = 60 * 60 * 1000
const D = 24 * H

async function main() {
  console.log("Resetting tables")
  await db.execute(sql`truncate table
    audit_log, result_reports, time_extensions, announcements, attempt_events, answers, attempts,
    enrollments, exam_questions, exams, question_options, questions, topics, user_preferences,
    verification, session, account, "user" restart identity cascade`)

  console.log("Creating accounts")
  const admin = await insertUserWithPassword(db, { name: "Areeba Khan", email: "admin@examvault.test", role: "admin", password: "Admin#2026" })
  const examiner = await insertUserWithPassword(db, { name: "Dr. Hamid Raza", email: "examiner@examvault.test", role: "examiner", password: "Examiner#2026" })
  const examiner2 = await insertUserWithPassword(db, { name: "Ms. Nida Farooq", email: "examiner2@examvault.test", role: "examiner", password: "Examiner#2026" })
  const people = [
    ["Ayesha Malik", "ayesha"],
    ["Bilal Ahmed", "bilal"],
    ["Sara Iqbal", "sara"],
    ["Usman Tariq", "usman"],
    ["Fatima Noor", "fatima"],
    ["Hassan Ali", "hassan"],
    ["Zainab Shah", "zainab"],
    ["Omar Siddiqui", "omar"],
  ] as const
  const candidates: Record<string, string> = {}
  for (const [name, handle] of people)
    candidates[handle] = await insertUserWithPassword(db, { name, email: `${handle}@examvault.test`, role: "candidate", password: "Candidate#2026" })

  console.log("Creating question bank")
  const topicIds = new Map<string, string>()
  const qIds: Record<string, string[]> = {}
  const marksById = new Map<string, number>()
  for (const q of BANK) {
    if (!topicIds.has(q.topic)) {
      const [t] = await db.insert(s.topics).values({ ownerId: examiner, name: q.topic }).returning({ id: s.topics.id })
      topicIds.set(q.topic, t.id)
    }
    const [row] = await db
      .insert(s.questions)
      .values({
        ownerId: examiner,
        topicId: topicIds.get(q.topic)!,
        type: q.type,
        difficulty: q.difficulty,
        stem: q.stem,
        defaultMarks: q.marks,
        multiScheme: q.scheme ?? "all_or_nothing",
        rubric: q.rubric ?? null,
      })
      .returning({ id: s.questions.id })
    if (q.options?.length)
      await db.insert(s.questionOptions).values(q.options.map(([text, isCorrect], position) => ({ questionId: row.id, text, isCorrect, position })))
    ;(qIds[q.topic] ??= []).push(row.id)
    marksById.set(row.id, q.marks)
  }
  // A second examiner owns one private question (used to demo bank isolation).
  const [t2] = await db.insert(s.topics).values({ ownerId: examiner2, name: "Software Engineering" }).returning({ id: s.topics.id })
  const [q2] = await db
    .insert(s.questions)
    .values({ ownerId: examiner2, topicId: t2.id, type: "single", difficulty: "easy", stem: "Which model delivers software in short, iterative sprints?", defaultMarks: 1 })
    .returning({ id: s.questions.id })
  await db.insert(s.questionOptions).values([
    { questionId: q2.id, text: "Waterfall", isCorrect: false, position: 0 },
    { questionId: q2.id, text: "Scrum", isCorrect: true, position: 1 },
  ])

  console.log("Creating exams")
  const now = Date.now()
  const marksOf = (id: string) => marksById.get(id)!
  async function exam(opts: {
    title: string
    owner: string
    status: "draft" | "published" | "completed"
    start: number
    end: number
    duration: number
    qs: string[]
    enroll: string[]
    instructions: string
  }) {
    const total = opts.qs.reduce((sum, id) => sum + marksOf(id), 0)
    const [e] = await db
      .insert(s.exams)
      .values({
        ownerId: opts.owner,
        title: opts.title,
        instructions: opts.instructions,
        startsAt: new Date(opts.start),
        endsAt: new Date(opts.end),
        durationMin: opts.duration,
        totalMarks: total,
        passMark: Math.round(total * 0.5),
        status: opts.status,
        publishedAt: opts.status === "draft" ? null : new Date(opts.start - D),
      })
      .returning({ id: s.exams.id })
    if (opts.qs.length)
      await db.insert(s.examQuestions).values(opts.qs.map((questionId, position) => ({ examId: e.id, questionId, position, marks: marksOf(questionId) })))
    if (opts.enroll.length)
      await db.insert(s.enrollments).values(opts.enroll.map((candidateId) => ({ examId: e.id, candidateId, enrolledBy: opts.owner })))
    return e.id
  }

  const all = (handles: string[]) => handles.map((h) => candidates[h])
  await exam({
    title: "Web Engineering Quiz",
    owner: examiner,
    status: "published",
    start: now - 2 * H,
    end: now + 6 * H,
    duration: 30,
    qs: qIds["Web Engineering"],
    enroll: all(["ayesha", "bilal", "usman", "fatima", "hassan"]),
    instructions:
      "Answer all questions. Answers save automatically, even if your connection drops. You may flag questions to review before submitting. The timer is kept by the server and continues if you close the tab.",
  })
  await exam({
    title: "Database Systems Final",
    owner: examiner,
    status: "published",
    start: now + 2 * D,
    end: now + 2 * D + 3 * H,
    duration: 90,
    qs: qIds["Databases"],
    enroll: all(["ayesha", "bilal", "sara", "zainab", "omar"]),
    instructions: "Closed book. Written answers are graded manually against the published rubric.",
  })
  await exam({
    title: "Data Structures Midterm",
    owner: examiner,
    status: "published",
    start: now - 30 * 60 * 1000,
    end: now + 10 * H,
    duration: 45,
    qs: qIds["Data Structures"],
    enroll: all(["ayesha", "bilal", "usman", "fatima", "hassan", "zainab", "omar"]),
    instructions: "45 minutes. Multiple-select questions marked partial credit award marks per correct choice minus wrong choices.",
  })
  await exam({
    title: "Computer Networks Practice",
    owner: examiner,
    status: "draft",
    start: now + 1 * D,
    end: now + 1 * D + 2 * H,
    duration: 20,
    qs: qIds["Computer Networks"],
    enroll: [],
    instructions: "",
  })

  await db.insert(s.auditLog).values({ actorId: admin, action: "system.seeded", entityType: "system", entityId: "seed", meta: {} })
  console.log("Done. Accounts: admin@, examiner@, examiner2@, ayesha@, bilal@, sara@ ... @examvault.test")
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
