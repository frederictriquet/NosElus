CREATE TABLE "law_cosignatories" (
	"law_id" varchar(50) NOT NULL,
	"actor_id" varchar(20) NOT NULL,
	"role" varchar(30) NOT NULL,
	"signature_order" integer,
	CONSTRAINT "law_cosignatories_law_id_actor_id_pk" PRIMARY KEY("law_id","actor_id")
);
--> statement-breakpoint
ALTER TABLE "law_cosignatories" ADD CONSTRAINT "law_cosignatories_law_id_laws_id_fk" FOREIGN KEY ("law_id") REFERENCES "public"."laws"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "law_cosignatories" ADD CONSTRAINT "law_cosignatories_actor_id_actors_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."actors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "law_cosignatories_law_idx" ON "law_cosignatories" USING btree ("law_id");--> statement-breakpoint
CREATE INDEX "law_cosignatories_actor_idx" ON "law_cosignatories" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "law_cosignatories_role_idx" ON "law_cosignatories" USING btree ("role");