CREATE TYPE "public"."dispute_status" AS ENUM('open', 'regraded', 'rejected', 'voided', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."dispute_type" AS ENUM('grading_error', 'ambiguous_question', 'technical_incident');--> statement-breakpoint
CREATE TYPE "public"."void_policy" AS ENUM('exclude', 'full_marks');--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"candidate_id" text NOT NULL,
	"type" "dispute_type" NOT NULL,
	"statement" text NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"marks_before" numeric(7, 2),
	"marks_after" numeric(7, 2),
	"resolution_note" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"window_from" timestamp with time zone NOT NULL,
	"window_to" timestamp with time zone NOT NULL,
	"reason" text NOT NULL,
	"declared_by" text NOT NULL,
	"request_key" text NOT NULL,
	"affected" integer DEFAULT 0 NOT NULL,
	"total_sec" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_incidents_window_valid" CHECK ("exam_incidents"."window_to" > "exam_incidents"."window_from")
);
--> statement-breakpoint
CREATE TABLE "item_voids" (
	"exam_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"policy" "void_policy" NOT NULL,
	"reason" text NOT NULL,
	"dispute_id" uuid,
	"voided_by" text NOT NULL,
	"affected" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "item_voids_exam_id_item_id_pk" PRIMARY KEY("exam_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "time_extensions" ADD COLUMN "incident_id" uuid;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_candidate_id_user_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_incidents" ADD CONSTRAINT "exam_incidents_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_incidents" ADD CONSTRAINT "exam_incidents_declared_by_user_id_fk" FOREIGN KEY ("declared_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_voids" ADD CONSTRAINT "item_voids_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_voids" ADD CONSTRAINT "item_voids_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_voids" ADD CONSTRAINT "item_voids_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_attempt_item_uq" ON "disputes" USING btree ("attempt_id","item_id");--> statement-breakpoint
CREATE INDEX "disputes_exam_idx" ON "disputes" USING btree ("exam_id","status");--> statement-breakpoint
CREATE INDEX "disputes_candidate_idx" ON "disputes" USING btree ("candidate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_incidents_request_uq" ON "exam_incidents" USING btree ("exam_id","request_key");--> statement-breakpoint
CREATE INDEX "exam_incidents_exam_idx" ON "exam_incidents" USING btree ("exam_id","created_at");--> statement-breakpoint
ALTER TABLE "time_extensions" ADD CONSTRAINT "time_extensions_incident_id_exam_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."exam_incidents"("id") ON DELETE set null ON UPDATE no action;