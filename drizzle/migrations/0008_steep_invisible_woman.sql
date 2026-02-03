CREATE TABLE "law_summaries" (
	"law_id" varchar(50) PRIMARY KEY NOT NULL,
	"summary" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" varchar(100) NOT NULL,
	"model_version" varchar(50),
	"is_reviewed" boolean DEFAULT false,
	"reviewed_at" timestamp,
	"analyzed_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "law_summaries" ADD CONSTRAINT "law_summaries_law_id_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "law_summaries_tags_idx" ON "law_summaries" USING gin ("tags");