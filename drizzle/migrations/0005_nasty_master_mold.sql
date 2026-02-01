ALTER TABLE "scrutins" ADD COLUMN "category" varchar(30);--> statement-breakpoint
CREATE INDEX "scrutins_category_idx" ON "scrutins" USING btree ("category");