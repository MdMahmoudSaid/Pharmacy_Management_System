CREATE TYPE "public"."audit_action" AS ENUM('CREATE', 'UPDATE', 'CORRECT', 'CANCEL', 'ARCHIVE', 'RESTORE', 'REOPEN', 'RESET_PIN', 'PERMISSION_CHANGE', 'PRICE_OVERRIDE');--> statement-breakpoint
CREATE TYPE "public"."app_locale" AS ENUM('ar', 'fr');--> statement-breakpoint
CREATE TYPE "public"."permission_scope" AS ENUM('OWN', 'ALL', 'NONE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'EMPLOYEE');--> statement-breakpoint
CREATE TYPE "public"."active_status" AS ENUM('ACTIVE', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."related_entity_type" AS ENUM('STOCK_RECEIPT', 'SALE', 'MEDICINE');--> statement-breakpoint
CREATE TYPE "public"."sale_status" AS ENUM('COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."shift_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('STOCK_RECEIVED', 'SALE', 'SALE_CANCELLATION', 'SALE_CORRECTION', 'STOCK_RECEIPT_CORRECTION', 'MANUAL_CORRECTION', 'OTHER_ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"actor_id" bigint NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" bigint NOT NULL,
	"action" "audit_action" NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"reason" text,
	"related_shift_id" bigint,
	"related_transaction_type" text,
	"related_transaction_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_sensitive_reason_required" CHECK ("audit_logs"."action" not in ('CORRECT', 'CANCEL', 'ARCHIVE', 'RESTORE', 'REOPEN', 'RESET_PIN', 'PERMISSION_CHANGE', 'PRICE_OVERRIDE') or length(trim("audit_logs"."reason")) > 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"pharmacy_name" text DEFAULT 'Pharmacy' NOT NULL,
	"default_locale" "app_locale" DEFAULT 'ar' NOT NULL,
	"receipt_preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "login_attempts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"phone_fingerprint" text NOT NULL,
	"origin_fingerprint" text NOT NULL,
	"success" boolean NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"action" text NOT NULL,
	"scope" "permission_scope" DEFAULT 'NONE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" bigint NOT NULL,
	"permission_key" text NOT NULL,
	"granted_by" bigint NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_key_pk" PRIMARY KEY("user_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "users_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"phone_e164" text NOT NULL,
	"pin_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"preferred_locale" "app_locale" DEFAULT 'ar' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" bigint,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_e164_unique" UNIQUE("phone_e164")
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "medicines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"code" text,
	"selling_price" numeric(14, 2) NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" bigint,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "medicines_price_positive" CHECK ("medicines"."selling_price" > 0),
	CONSTRAINT "medicines_stock_non_negative" CHECK ("medicines"."current_stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "expenses_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"amount" numeric(14, 2) NOT NULL,
	"description" text NOT NULL,
	"shift_id" bigint NOT NULL,
	"operator_id" bigint NOT NULL,
	"status" "active_status" DEFAULT 'ACTIVE' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" bigint,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_positive" CHECK ("expenses"."amount" > 0),
	CONSTRAINT "expenses_description_non_empty" CHECK (length(trim("expenses"."description")) > 0)
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sale_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sale_id" bigint NOT NULL,
	"medicine_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(14, 2) NOT NULL,
	"line_total" numeric(14, 2) NOT NULL,
	CONSTRAINT "sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "sale_items_unit_price_positive" CHECK ("sale_items"."unit_price" > 0),
	CONSTRAINT "sale_items_line_total_positive" CHECK ("sale_items"."line_total" > 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"sale_number" text NOT NULL,
	"shift_id" bigint NOT NULL,
	"operator_id" bigint NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"status" "sale_status" DEFAULT 'COMPLETED' NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_by" bigint,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_sale_number_unique" UNIQUE("sale_number"),
	CONSTRAINT "sales_total_non_negative" CHECK ("sales"."total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "shifts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" bigint NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"status" "shift_status" DEFAULT 'OPEN' NOT NULL,
	"created_by" bigint,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shifts_closed_state_consistent" CHECK (("shifts"."status" = 'OPEN' and "shifts"."closed_at" is null) or ("shifts"."status" = 'CLOSED' and "shifts"."closed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"medicine_id" bigint NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity_before" integer NOT NULL,
	"quantity_change" integer NOT NULL,
	"quantity_after" integer NOT NULL,
	"related_entity_type" "related_entity_type" NOT NULL,
	"related_entity_id" bigint NOT NULL,
	"shift_id" bigint,
	"actor_id" bigint NOT NULL,
	"note" text,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_before_non_negative" CHECK ("stock_movements"."quantity_before" >= 0),
	CONSTRAINT "stock_movements_after_non_negative" CHECK ("stock_movements"."quantity_after" >= 0),
	CONSTRAINT "stock_movements_math_consistent" CHECK ("stock_movements"."quantity_after" = "stock_movements"."quantity_before" + "stock_movements"."quantity_change")
);
--> statement-breakpoint
CREATE TABLE "stock_receipts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_receipts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"medicine_id" bigint NOT NULL,
	"quantity" integer NOT NULL,
	"status" "active_status" DEFAULT 'ACTIVE' NOT NULL,
	"shift_id" bigint NOT NULL,
	"operator_id" bigint NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" bigint NOT NULL,
	"updated_by" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_receipts_quantity_positive" CHECK ("stock_receipts"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_related_shift_id_shifts_id_fk" FOREIGN KEY ("related_shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_medicine_id_medicines_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicines"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_receipts" ADD CONSTRAINT "stock_receipts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_related_shift_id_idx" ON "audit_logs" USING btree ("related_shift_id");--> statement-breakpoint
CREATE INDEX "settings_updated_by_idx" ON "settings" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "login_attempts_phone_time_idx" ON "login_attempts" USING btree ("phone_fingerprint","attempted_at");--> statement-breakpoint
CREATE INDEX "login_attempts_origin_time_idx" ON "login_attempts" USING btree ("origin_fingerprint","attempted_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_active_user_idx" ON "sessions" USING btree ("user_id","expires_at") WHERE "sessions"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "user_permissions_permission_key_idx" ON "user_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE INDEX "user_permissions_granted_by_idx" ON "user_permissions" USING btree ("granted_by");--> statement-breakpoint
CREATE INDEX "users_created_by_idx" ON "users" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "users_updated_by_idx" ON "users" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "medicines_name_idx" ON "medicines" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "medicines_code_unique_idx" ON "medicines" USING btree ("code") WHERE "medicines"."code" is not null;--> statement-breakpoint
CREATE INDEX "medicines_created_by_idx" ON "medicines" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "medicines_updated_by_idx" ON "medicines" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "expenses_shift_id_idx" ON "expenses" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "expenses_operator_id_idx" ON "expenses" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "expenses_created_by_idx" ON "expenses" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "expenses_updated_by_idx" ON "expenses" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "expenses_status_occurred_at_idx" ON "expenses" USING btree ("status","occurred_at");--> statement-breakpoint
CREATE INDEX "sale_items_sale_id_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_medicine_id_idx" ON "sale_items" USING btree ("medicine_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_operator_idempotency_unique" ON "sales" USING btree ("operator_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "sales_shift_id_idx" ON "sales" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "sales_operator_id_idx" ON "sales" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "sales_created_by_idx" ON "sales" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "sales_updated_by_idx" ON "sales" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "sales_status_created_at_idx" ON "sales" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shifts_one_open_per_user" ON "shifts" USING btree ("user_id") WHERE "shifts"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "shifts_user_id_idx" ON "shifts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shifts_status_opened_at_idx" ON "shifts" USING btree ("status","opened_at");--> statement-breakpoint
CREATE INDEX "shifts_created_by_idx" ON "shifts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "shifts_updated_by_idx" ON "shifts" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "stock_movements_medicine_id_idx" ON "stock_movements" USING btree ("medicine_id");--> statement-breakpoint
CREATE INDEX "stock_movements_shift_id_idx" ON "stock_movements" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "stock_movements_actor_id_idx" ON "stock_movements" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "stock_movements_type_created_at_idx" ON "stock_movements" USING btree ("type","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_related_idx" ON "stock_movements" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "stock_receipts_medicine_id_idx" ON "stock_receipts" USING btree ("medicine_id");--> statement-breakpoint
CREATE INDEX "stock_receipts_shift_id_idx" ON "stock_receipts" USING btree ("shift_id");--> statement-breakpoint
CREATE INDEX "stock_receipts_operator_id_idx" ON "stock_receipts" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "stock_receipts_created_by_idx" ON "stock_receipts" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "stock_receipts_updated_by_idx" ON "stock_receipts" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "stock_receipts_status_occurred_at_idx" ON "stock_receipts" USING btree ("status","occurred_at");