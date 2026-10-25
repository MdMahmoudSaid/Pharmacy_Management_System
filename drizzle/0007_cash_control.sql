ALTER TABLE "capital_movements" ADD COLUMN "profit_portion" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "capital_movements" ADD COLUMN "capital_portion" numeric(14, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
UPDATE "capital_movements"
SET "capital_portion" = "amount"
WHERE "type" = 'WITHDRAWAL';--> statement-breakpoint
ALTER TABLE "capital_movements" ADD CONSTRAINT "capital_movements_allocation_consistent" CHECK (("capital_movements"."type" = 'ADDITION' and "capital_movements"."profit_portion" = 0 and "capital_movements"."capital_portion" = 0) or ("capital_movements"."type" = 'WITHDRAWAL' and "capital_movements"."profit_portion" >= 0 and "capital_movements"."capital_portion" >= 0 and "capital_movements"."profit_portion" + "capital_movements"."capital_portion" = "capital_movements"."amount"));
