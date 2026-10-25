CREATE TABLE "supplier_debts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "supplier_debts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"supplier_id" bigint NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"note" text,
	"status" "financial_record_status" DEFAULT 'ACTIVE' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" bigint NOT NULL,
	"voided_at" timestamp with time zone,
	"voided_by" bigint,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supplier_debts_amount_positive" CHECK ("supplier_debts"."amount" > 0),
	CONSTRAINT "supplier_debts_void_state_consistent" CHECK (("supplier_debts"."status" = 'ACTIVE' and "supplier_debts"."voided_at" is null and "supplier_debts"."voided_by" is null) or ("supplier_debts"."status" = 'VOIDED' and "supplier_debts"."voided_at" is not null and "supplier_debts"."voided_by" is not null and length(trim(coalesce("supplier_debts"."void_reason", ''))) > 0))
);
--> statement-breakpoint
ALTER TABLE "stock_receipts" DROP CONSTRAINT "stock_receipts_cost_fields_consistent";--> statement-breakpoint
ALTER TABLE "supplier_debts" ADD CONSTRAINT "supplier_debts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_debts" ADD CONSTRAINT "supplier_debts_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_debts" ADD CONSTRAINT "supplier_debts_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_debts_supplier_id_idx" ON "supplier_debts" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_debts_operator_id_idx" ON "supplier_debts" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "supplier_debts_voided_by_idx" ON "supplier_debts" USING btree ("voided_by");--> statement-breakpoint
CREATE INDEX "supplier_debts_status_occurred_at_idx" ON "supplier_debts" USING btree ("status","occurred_at");--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_cost_fields_consistent" CHECK (("stock_receipts"."supplier_id" is null and "stock_receipts"."unit_cost" is null and "stock_receipts"."total_cost" is null) or ("stock_receipts"."supplier_id" is not null and "stock_receipts"."unit_cost" > 0 and "stock_receipts"."total_cost" > 0 and abs("stock_receipts"."total_cost" - "stock_receipts"."unit_cost" * "stock_receipts"."quantity") <= "stock_receipts"."quantity" * 0.005));