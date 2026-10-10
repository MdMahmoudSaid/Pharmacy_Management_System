CREATE TABLE "expense_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expense_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expense_categories_name_non_empty" CHECK (length(trim("expense_categories"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "expenses" DROP CONSTRAINT "expenses_description_non_empty";--> statement-breakpoint
ALTER TABLE "expenses" ALTER COLUMN "description" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "category_id" bigint;--> statement-breakpoint
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "expense_categories_active_name_unique" ON "expense_categories" USING btree (lower("name")) WHERE "expense_categories"."is_active";--> statement-breakpoint
CREATE INDEX "expense_categories_created_by_idx" ON "expense_categories" USING btree ("created_by");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_category_id_idx" ON "expenses" USING btree ("category_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_or_description" CHECK ("expenses"."category_id" is not null or length(trim(coalesce("expenses"."description", ''))) > 0);