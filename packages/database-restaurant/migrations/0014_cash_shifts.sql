CREATE TABLE "cash_shift_events" (
	"id" text PRIMARY KEY NOT NULL,
	"shiftId" text NOT NULL,
	"branchId" text NOT NULL,
	"type" text NOT NULL,
	"staffId" text,
	"toStaffId" text,
	"authorizedById" text,
	"amount" numeric(12, 2),
	"expectedAmount" numeric(12, 2),
	"countedAmount" numeric(12, 2),
	"difference" numeric(12, 2),
	"notes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"branchId" text NOT NULL,
	"registerId" text DEFAULT 'MAIN' NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"openedByStaffId" text NOT NULL,
	"currentStaffId" text NOT NULL,
	"openingFloat" numeric(12, 2) NOT NULL,
	"openedAt" timestamp DEFAULT now() NOT NULL,
	"closedAt" timestamp,
	"closedByStaffId" text,
	"authorizedByStaffId" text,
	"expectedCash" numeric(12, 2),
	"countedCash" numeric(12, 2),
	"difference" numeric(12, 2),
	"closeNotes" text
);
--> statement-breakpoint
CREATE TABLE "pin_attempts" (
	"scopeKey" text PRIMARY KEY NOT NULL,
	"failCount" integer DEFAULT 0 NOT NULL,
	"lastFailAt" timestamp DEFAULT now() NOT NULL,
	"lockedUntil" timestamp
);
--> statement-breakpoint
ALTER TABLE "cash_drops" ALTER COLUMN "amount" SET DATA TYPE numeric(12, 2);--> statement-breakpoint
ALTER TABLE "branches" ADD COLUMN "cashDropManagerThreshold" real DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_drops" ADD COLUMN "shiftId" text;--> statement-breakpoint
ALTER TABLE "cash_shift_events" ADD CONSTRAINT "cash_shift_events_shiftId_cash_shifts_id_fk" FOREIGN KEY ("shiftId") REFERENCES "public"."cash_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shift_events" ADD CONSTRAINT "cash_shift_events_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shift_events" ADD CONSTRAINT "cash_shift_events_staffId_staff_id_fk" FOREIGN KEY ("staffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shift_events" ADD CONSTRAINT "cash_shift_events_toStaffId_staff_id_fk" FOREIGN KEY ("toStaffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shift_events" ADD CONSTRAINT "cash_shift_events_authorizedById_staff_id_fk" FOREIGN KEY ("authorizedById") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_branchId_branches_id_fk" FOREIGN KEY ("branchId") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_openedByStaffId_staff_id_fk" FOREIGN KEY ("openedByStaffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_currentStaffId_staff_id_fk" FOREIGN KEY ("currentStaffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_closedByStaffId_staff_id_fk" FOREIGN KEY ("closedByStaffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_shifts" ADD CONSTRAINT "cash_shifts_authorizedByStaffId_staff_id_fk" FOREIGN KEY ("authorizedByStaffId") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_shift_events_shift_idx" ON "cash_shift_events" USING btree ("shiftId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_shifts_one_open_per_register" ON "cash_shifts" USING btree ("branchId","registerId") WHERE "cash_shifts"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "cash_shifts_branch_opened_idx" ON "cash_shifts" USING btree ("branchId","openedAt");--> statement-breakpoint
ALTER TABLE "cash_drops" ADD CONSTRAINT "cash_drops_shiftId_cash_shifts_id_fk" FOREIGN KEY ("shiftId") REFERENCES "public"."cash_shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cash_drops_shift_idx" ON "cash_drops" USING btree ("shiftId");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION cash_shift_events_immutable() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'cash_shift_events es una bitácora inmutable (solo INSERT)'; END; $$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER cash_shift_events_no_update_delete BEFORE UPDATE OR DELETE ON "cash_shift_events" FOR EACH ROW EXECUTE FUNCTION cash_shift_events_immutable();
