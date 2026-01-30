CREATE TABLE "sync_metadata" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"source" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"legislature" varchar(10),
	"last_sync_at" timestamp NOT NULL,
	"last_sync_status" varchar(20) NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_updated" integer DEFAULT 0,
	"records_skipped" integer DEFAULT 0,
	"records_errored" integer DEFAULT 0,
	"last_modified_filter" timestamp,
	"last_cursor" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
