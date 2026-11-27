CREATE TYPE "public"."delivery_mode" AS ENUM('standard', 'secure');--> statement-breakpoint
ALTER TYPE "public"."attempt_event_type" ADD VALUE 'secure_locked';--> statement-breakpoint
ALTER TYPE "public"."attempt_event_type" ADD VALUE 'secure_released';--> statement-breakpoint
ALTER TYPE "public"."attempt_event_type" ADD VALUE 'question_closed';--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "cursor" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "item_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "lock_reason" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "unlock_code_hash" text;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "unlock_code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attempts" ADD COLUMN "unlock_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD COLUMN "time_limit_sec" integer;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "delivery_mode" "delivery_mode" DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_time_limit_range" CHECK ("exam_questions"."time_limit_sec" is null or ("exam_questions"."time_limit_sec" between 10 and 3600));