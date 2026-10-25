CREATE TYPE "public"."capital_movement_type" AS ENUM('ADDITION', 'WITHDRAWAL');--> statement-breakpoint
CREATE TYPE "public"."financial_record_status" AS ENUM('ACTIVE', 'VOIDED');--> statement-breakpoint
CREATE TABLE "capital_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "capital_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" "capital_movement_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"status" "financial_record_status" DEFAULT 'ACTIVE' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" bigint NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" bigint,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capital_movements_amount_positive" CHECK ("capital_movements"."amount" > 0),
	CONSTRAINT "capital_movements_void_state_consistent" CHECK (("capital_movements"."status" = 'ACTIVE' and "capital_movements"."voided_at" is null and "capital_movements"."voided_by" is null) or ("capital_movements"."status" = 'VOIDED' and "capital_movements"."voided_at" is not null and "capital_movements"."voided_by" is not null and length(trim(coalesce("capital_movements"."void_reason", ''))) > 0))
);
--> statement-breakpoint
CREATE TABLE "supplier_payments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"supplier_id" bigint NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reference" text,
	"note" text,
	"status" "financial_record_status" DEFAULT 'ACTIVE' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" bigint NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" bigint,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_payments_amount_positive" CHECK ("supplier_payments"."amount" > 0),
	CONSTRAINT "supplier_payments_void_state_consistent" CHECK (("supplier_payments"."status" = 'ACTIVE' and "supplier_payments"."voided_at" is null and "supplier_payments"."voided_by" is null) or ("supplier_payments"."status" = 'VOIDED' and "supplier_payments"."voided_at" is not null and "supplier_payments"."voided_by" is not null and length(trim(coalesce("supplier_payments"."void_reason", ''))) > 0))
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "suppliers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone" text,
	"contact_person" text,
	"address" text,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" bigint NOT NULL,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppliers_name_non_empty" CHECK (length(trim("suppliers"."name")) > 0)
);
--> statement-breakpoint
ALTER TABLE "medicines" ADD COLUMN "average_cost" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "unit_cost" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "supplier_id" bigint;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "unit_cost" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD COLUMN "total_cost" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "capital_movements" ADD CONSTRAINT "capital_movements_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_movements" ADD CONSTRAINT "capital_movements_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "capital_movements_operator_id_idx" ON "capital_movements" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "capital_movements_voided_by_idx" ON "capital_movements" USING btree ("voided_by");--> statement-breakpoint
CREATE INDEX "capital_movements_status_occurred_at_idx" ON "capital_movements" USING btree ("status","occurred_at");--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_id_idx" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_operator_id_idx" ON "supplier_payments" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "supplier_payments_voided_by_idx" ON "supplier_payments" USING btree ("voided_by");--> statement-breakpoint
CREATE INDEX "supplier_payments_status_occurred_at_idx" ON "supplier_payments" USING btree ("status","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_active_name_unique" ON "suppliers" USING btree (lower(trim("name"))) WHERE "suppliers"."is_active";--> statement-breakpoint
CREATE INDEX "suppliers_created_by_idx" ON "suppliers" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "suppliers_updated_by_idx" ON "suppliers" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "suppliers_active_name_idx" ON "suppliers" USING btree ("is_active","name");--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_receipts_supplier_id_idx" ON "stock_receipts" USING btree ("supplier_id");--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_average_cost_non_negative" CHECK ("medicines"."average_cost" >= 0);--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_unit_cost_non_negative" CHECK ("sale_items"."unit_cost" >= 0);--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_cost_fields_consistent" CHECK (("stock_receipts"."supplier_id" is null and "stock_receipts"."unit_cost" is null and "stock_receipts"."total_cost" is null) or ("stock_receipts"."supplier_id" is not null and "stock_receipts"."unit_cost" > 0 and "stock_receipts"."total_cost" = "stock_receipts"."unit_cost" * "stock_receipts"."quantity"));
