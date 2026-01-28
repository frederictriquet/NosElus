CREATE TABLE "actors" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"uid" varchar(50),
	"civility" varchar(10),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"birth_date" date,
	"birth_place" varchar(200),
	"death_date" date,
	"profession" text,
	"photo_url" text,
	"chamber" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "actors_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "amendments" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"uid" varchar(100),
	"number" varchar(20) NOT NULL,
	"law_id" varchar(50),
	"author_id" varchar(20),
	"legislature" varchar(10) NOT NULL,
	"article" varchar(50),
	"position" varchar(50),
	"status" varchar(50),
	"dispositif" text,
	"expose_sommaire" text,
	"deposit_date" date,
	"exam_date" date,
	"sort_order" integer,
	"chamber" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amendments_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "laws" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"uid" varchar(100),
	"number" varchar(50),
	"legislature" varchar(10) NOT NULL,
	"title" text NOT NULL,
	"short_title" varchar(300),
	"type" varchar(50) NOT NULL,
	"status" varchar(50),
	"deposit_date" date,
	"adoption_date_an" date,
	"adoption_date_senat" date,
	"promulgation_date" date,
	"publication_date" date,
	"theme" varchar(200),
	"sub_themes" jsonb,
	"initiator" varchar(50),
	"description" text,
	"source_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "laws_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "mandates" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"organ_id" varchar(20) NOT NULL,
	"type" varchar(50) NOT NULL,
	"quality" varchar(100),
	"start_date" date NOT NULL,
	"end_date" date,
	"legislature" varchar(10),
	"department" varchar(100),
	"department_code" varchar(5),
	"constituency" varchar(100),
	"constituency_number" varchar(5),
	"election_cause" varchar(100),
	"mandate_end_cause" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organs" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"uid" varchar(50),
	"type" varchar(50) NOT NULL,
	"name" varchar(300) NOT NULL,
	"short_name" varchar(100),
	"color" varchar(7),
	"chamber" varchar(20) NOT NULL,
	"legislature" varchar(10),
	"start_date" date,
	"end_date" date,
	"parent_id" varchar(20),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organs_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "scrutins" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"uid" varchar(50),
	"number" integer NOT NULL,
	"legislature" varchar(10) NOT NULL,
	"session_ordinary" varchar(50),
	"session_extraordinary" varchar(50),
	"date" date NOT NULL,
	"title" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"sort_type" varchar(50),
	"total_voters" integer DEFAULT 0 NOT NULL,
	"total_for" integer DEFAULT 0 NOT NULL,
	"total_against" integer DEFAULT 0 NOT NULL,
	"total_abstention" integer DEFAULT 0 NOT NULL,
	"total_non_voting" integer DEFAULT 0 NOT NULL,
	"result" varchar(20),
	"group_results" jsonb,
	"law_id" varchar(20),
	"amendment_ref" varchar(50),
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "scrutins_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"scrutin_id" varchar(20) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"group_id" varchar(20),
	"position" varchar(20) NOT NULL,
	"delegation" varchar(20),
	"delegator_id" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_law_id_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_author_id_actors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mandates" ADD CONSTRAINT "mandates_organ_id_organs_id_fk" FOREIGN KEY ("organ_id") REFERENCES "public"."organs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organs" ADD CONSTRAINT "organs_parent_id_organs_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."organs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_scrutin_id_scrutins_id_fk" FOREIGN KEY ("scrutin_id") REFERENCES "public"."scrutins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_group_id_organs_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."organs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_delegator_id_actors_id_fk" FOREIGN KEY ("delegator_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "actors_chamber_idx" ON "actors" USING btree ("chamber");--> statement-breakpoint
CREATE INDEX "actors_last_name_idx" ON "actors" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "actors_full_name_idx" ON "actors" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "amendments_law_id_idx" ON "amendments" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "amendments_author_id_idx" ON "amendments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "amendments_legislature_idx" ON "amendments" USING btree ("legislature");--> statement-breakpoint
CREATE INDEX "amendments_status_idx" ON "amendments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "amendments_deposit_date_idx" ON "amendments" USING btree ("deposit_date");--> statement-breakpoint
CREATE INDEX "laws_legislature_idx" ON "laws" USING btree ("legislature");--> statement-breakpoint
CREATE INDEX "laws_type_idx" ON "laws" USING btree ("type");--> statement-breakpoint
CREATE INDEX "laws_status_idx" ON "laws" USING btree ("status");--> statement-breakpoint
CREATE INDEX "laws_deposit_date_idx" ON "laws" USING btree ("deposit_date");--> statement-breakpoint
CREATE INDEX "mandates_actor_id_idx" ON "mandates" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "mandates_organ_id_idx" ON "mandates" USING btree ("organ_id");--> statement-breakpoint
CREATE INDEX "mandates_type_idx" ON "mandates" USING btree ("type");--> statement-breakpoint
CREATE INDEX "mandates_legislature_idx" ON "mandates" USING btree ("legislature");--> statement-breakpoint
CREATE INDEX "mandates_dates_idx" ON "mandates" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "organs_type_idx" ON "organs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "organs_chamber_idx" ON "organs" USING btree ("chamber");--> statement-breakpoint
CREATE INDEX "organs_legislature_idx" ON "organs" USING btree ("legislature");--> statement-breakpoint
CREATE INDEX "scrutins_legislature_idx" ON "scrutins" USING btree ("legislature");--> statement-breakpoint
CREATE INDEX "scrutins_date_idx" ON "scrutins" USING btree ("date");--> statement-breakpoint
CREATE INDEX "scrutins_type_idx" ON "scrutins" USING btree ("type");--> statement-breakpoint
CREATE INDEX "scrutins_number_idx" ON "scrutins" USING btree ("number");--> statement-breakpoint
CREATE INDEX "scrutins_law_id_idx" ON "scrutins" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "votes_scrutin_id_idx" ON "votes" USING btree ("scrutin_id");--> statement-breakpoint
CREATE INDEX "votes_actor_id_idx" ON "votes" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "votes_group_id_idx" ON "votes" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "votes_position_idx" ON "votes" USING btree ("position");--> statement-breakpoint
CREATE INDEX "votes_scrutin_actor_idx" ON "votes" USING btree ("scrutin_id","actor_id");