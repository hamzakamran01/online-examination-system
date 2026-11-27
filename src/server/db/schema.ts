import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import type { AnswerKey, AnswerResponse, Paper } from "../../lib/domain/paper"

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" })
const marks = (name: string) => numeric(name, { precision: 7, scale: 2, mode: "number" })
const createdAt = () => ts("created_at").notNull().defaultNow()
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/* ----------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */
export const roleEnum = pgEnum("role", ["admin", "examiner", "candidate"])
export const questionTypeEnum = pgEnum("question_type", ["single", "multi", "written"])
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"])
export const multiSchemeEnum = pgEnum("multi_scheme", ["all_or_nothing", "partial"])
export const examStatusEnum = pgEnum("exam_status", ["draft", "published", "completed"])
export const attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "submitted", "auto_submitted"])
export const submitReasonEnum = pgEnum("submit_reason", ["candidate", "timeout", "examiner"])
export const gradingStatusEnum = pgEnum("grading_status", ["pending", "graded"])
export const eventTypeEnum = pgEnum("attempt_event_type", [
  "started",
  "resumed",
  "tab_hidden",
  "fullscreen_exit",
  "offline",
  "reconnect",
  "connection_gap",
  "device_change",
  "late_save_rejected",
  "extension_granted",
  "submitted",
  "auto_submitted",
])
export const eventSourceEnum = pgEnum("event_source", ["client", "server"])
export const themePrefEnum = pgEnum("theme_pref", ["system", "light", "dark", "contrast"])
export const layoutPrefEnum = pgEnum("layout_pref", ["single", "scroll"])

/* ----------------------------------------------------------------------------
 * Better Auth core tables (field names follow Better Auth's model)
 * ------------------------------------------------------------------------- */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").notNull().default("candidate"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)]
)

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: ts("access_token_expires_at"),
    refreshTokenExpiresAt: ts("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)]
)

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
})

/* ----------------------------------------------------------------------------
 * Preferences (S-4.7)
 * ------------------------------------------------------------------------- */
export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fontScale: integer("font_scale").notNull().default(100),
  theme: themePrefEnum("theme").notNull().default("system"),
  layout: layoutPrefEnum("layout").notNull().default("single"),
  paletteSide: text("palette_side", { enum: ["left", "right"] }).notNull().default("right"),
  updatedAt: updatedAt(),
})

/* ----------------------------------------------------------------------------
 * Question bank (C-3.3)
 * ------------------------------------------------------------------------- */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("topics_owner_name_uq").on(t.ownerId, t.name)]
)

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id").references(() => topics.id, { onDelete: "set null" }),
    type: questionTypeEnum("type").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("medium"),
    stem: text("stem").notNull(),
    defaultMarks: marks("default_marks").notNull().default(1),
    multiScheme: multiSchemeEnum("multi_scheme").notNull().default("all_or_nothing"),
    rubric: text("rubric"),
    archivedAt: ts("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("questions_owner_idx").on(t.ownerId, t.archivedAt),
    check("questions_marks_positive", sql`${t.defaultMarks} > 0`),
  ]
)

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    position: integer("position").notNull(),
  },
  (t) => [index("question_options_question_idx").on(t.questionId, t.position)]
)

/* ----------------------------------------------------------------------------
 * Exams (C-3.2)
 * ------------------------------------------------------------------------- */
export const exams = pgTable(
  "exams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    startsAt: ts("starts_at").notNull(),
    endsAt: ts("ends_at").notNull(),
    durationMin: integer("duration_min").notNull(),
    totalMarks: marks("total_marks").notNull(),
    passMark: marks("pass_mark"),
    status: examStatusEnum("status").notNull().default("draft"),
    shuffleQuestions: boolean("shuffle_questions").notNull().default(true),
    shuffleOptions: boolean("shuffle_options").notNull().default(true),
    releaseAnswerReview: boolean("release_answer_review").notNull().default(false),
    publishedAt: ts("published_at"),
    closedAt: ts("closed_at"),
    resultsPublishedAt: ts("results_published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("exams_owner_idx").on(t.ownerId, t.status),
    check("exams_window_valid", sql`${t.endsAt} > ${t.startsAt}`),
    check("exams_duration_positive", sql`${t.durationMin} > 0`),
    check("exams_total_positive", sql`${t.totalMarks} > 0`),
  ]
)

export const examQuestions = pgTable(
  "exam_questions",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    marks: marks("marks").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.examId, t.questionId] }),
    check("exam_questions_marks_positive", sql`${t.marks} > 0`),
  ]
)

/* ----------------------------------------------------------------------------
 * Enrollment (C-3.4)
 * ------------------------------------------------------------------------- */
export const enrollments = pgTable(
  "enrollments",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    enrolledBy: text("enrolled_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.candidateId] }), index("enrollments_candidate_idx").on(t.candidateId)]
)

/* ----------------------------------------------------------------------------
 * Attempts (C-3.5, invariants 1 to 4, 6)
 * ------------------------------------------------------------------------- */
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    isSandbox: boolean("is_sandbox").notNull().default(false),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    startedAt: ts("started_at").notNull().defaultNow(),
    deadlineAt: ts("deadline_at").notNull(),
    extensionSec: integer("extension_sec").notNull().default(0),
    submittedAt: ts("submitted_at"),
    submitReason: submitReasonEnum("submit_reason"),
    /** Candidate-safe frozen paper. Never contains correct answers. */
    paper: jsonb("paper").$type<Paper>().notNull(),
    /** Server-only answer key, frozen with the paper. Never selected for candidates. */
    answerKey: jsonb("answer_key").$type<AnswerKey>().notNull(),
    maxMarks: marks("max_marks").notNull(),
    scoreAuto: marks("score_auto"),
    scoreManual: marks("score_manual"),
    scoreTotal: marks("score_total"),
    gradingStatus: gradingStatusEnum("grading_status").notNull().default("pending"),
    lastSeenAt: ts("last_seen_at"),
    lastClientId: text("last_client_id"),
    scratchpad: text("scratchpad").notNull().default(""),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("attempts_one_real_per_candidate_uq")
      .on(t.examId, t.candidateId)
      .where(sql`${t.isSandbox} = false`),
    index("attempts_exam_idx").on(t.examId, t.isSandbox, t.status),
    index("attempts_candidate_idx").on(t.candidateId),
  ]
)

export const answers = pgTable(
  "answers",
  {
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull(),
    response: jsonb("response").$type<AnswerResponse>(),
    flagged: boolean("flagged").notNull().default(false),
    clientSeq: integer("client_seq").notNull().default(0),
    savedAt: ts("saved_at").notNull().defaultNow(),
    autoScore: marks("auto_score"),
    manualScore: marks("manual_score"),
    feedback: text("feedback"),
    gradedBy: text("graded_by").references(() => user.id, { onDelete: "set null" }),
    gradedAt: ts("graded_at"),
  },
  (t) => [primaryKey({ columns: [t.attemptId, t.itemId] })]
)

export const attemptEvents = pgTable(
  "attempt_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    type: eventTypeEnum("type").notNull(),
    source: eventSourceEnum("source").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
    clientTs: ts("client_ts"),
    serverTs: ts("server_ts").notNull().defaultNow(),
  },
  (t) => [index("attempt_events_attempt_idx").on(t.attemptId, t.serverTs)]
)

/**
 * Declared incident (I-5.3): a server or network outage affecting many candidates at once.
 * The examiner declares a time window; each affected attempt is compensated with its own
 * server-measured overlap, under one audited reason. `requestKey` makes the grant idempotent.
 */
export const examIncidents = pgTable(
  "exam_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    windowFrom: ts("window_from").notNull(),
    windowTo: ts("window_to").notNull(),
    reason: text("reason").notNull(),
    declaredBy: text("declared_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    requestKey: text("request_key").notNull(),
    affected: integer("affected").notNull().default(0),
    totalSec: integer("total_sec").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("exam_incidents_request_uq").on(t.examId, t.requestKey),
    index("exam_incidents_exam_idx").on(t.examId, t.createdAt),
    check("exam_incidents_window_valid", sql`${t.windowTo} > ${t.windowFrom}`),
  ]
)

export const timeExtensions = pgTable("time_extensions", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  seconds: integer("seconds").notNull(),
  reason: text("reason").notNull(),
  grantedBy: text("granted_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  /** Set when the extension was granted as part of a declared incident. */
  incidentId: uuid("incident_id").references(() => examIncidents.id, { onDelete: "set null" }),
  createdAt: createdAt(),
})

/* ----------------------------------------------------------------------------
 * Disputes and voided questions (I-5.4)
 * ------------------------------------------------------------------------- */
export const disputeTypeEnum = pgEnum("dispute_type", ["grading_error", "ambiguous_question", "technical_incident"])
export const disputeStatusEnum = pgEnum("dispute_status", ["open", "regraded", "rejected", "voided", "withdrawn"])
export const voidPolicyEnum = pgEnum("void_policy", ["exclude", "full_marks"])

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    /** Paper item (question id frozen in the candidate's paper). */
    itemId: uuid("item_id").notNull(),
    candidateId: text("candidate_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: disputeTypeEnum("type").notNull(),
    statement: text("statement").notNull(),
    status: disputeStatusEnum("status").notNull().default("open"),
    marksBefore: marks("marks_before"),
    marksAfter: marks("marks_after"),
    resolutionNote: text("resolution_note"),
    resolvedBy: text("resolved_by").references(() => user.id, { onDelete: "set null" }),
    resolvedAt: ts("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One dispute per question per attempt: a decision is final, not re-litigated by spam.
    uniqueIndex("disputes_attempt_item_uq").on(t.attemptId, t.itemId),
    index("disputes_exam_idx").on(t.examId, t.status),
    index("disputes_candidate_idx").on(t.candidateId),
  ]
)

/** A question voided for every candidate of an exam, with one consistent rule (I-5.4). */
export const itemVoids = pgTable(
  "item_voids",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull(),
    policy: voidPolicyEnum("policy").notNull(),
    reason: text("reason").notNull(),
    disputeId: uuid("dispute_id").references(() => disputes.id, { onDelete: "set null" }),
    voidedBy: text("voided_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    affected: integer("affected").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.itemId] })]
)

/* ----------------------------------------------------------------------------
 * Monitoring (C-3.6)
 * ------------------------------------------------------------------------- */
export const announcements = pgTable(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_exam_idx").on(t.examId, t.createdAt)]
)

/* ----------------------------------------------------------------------------
 * Reports and verification (S-4.2, S-4.6)
 * ------------------------------------------------------------------------- */
export const resultReports = pgTable("result_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  attemptId: uuid("attempt_id")
    .notNull()
    .references(() => attempts.id, { onDelete: "cascade" }),
  code: text("code").notNull().unique(),
  scoreSnapshot: marks("score_snapshot").notNull(),
  maxSnapshot: marks("max_snapshot").notNull(),
  issuedBy: text("issued_by").references(() => user.id, { onDelete: "set null" }),
  issuedAt: createdAt(),
  revokedAt: ts("revoked_at"),
})

/* ----------------------------------------------------------------------------
 * Audit log
 * ------------------------------------------------------------------------- */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)]
)

export type Role = (typeof roleEnum.enumValues)[number]
export type QuestionType = (typeof questionTypeEnum.enumValues)[number]
export type Difficulty = (typeof difficultyEnum.enumValues)[number]
export type MultiScheme = (typeof multiSchemeEnum.enumValues)[number]
export type ExamStatus = (typeof examStatusEnum.enumValues)[number]
export type AttemptEventType = (typeof eventTypeEnum.enumValues)[number]
export type DisputeType = (typeof disputeTypeEnum.enumValues)[number]
export type DisputeStatus = (typeof disputeStatusEnum.enumValues)[number]
export type VoidPolicy = (typeof voidPolicyEnum.enumValues)[number]
