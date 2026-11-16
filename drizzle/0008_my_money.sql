CREATE TYPE "public"."payment_kind" AS ENUM('credit_card', 'debit_card', 'cash', 'upi', 'bank_transfer', 'other');--> statement-breakpoint
CREATE TABLE "emis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"lender" text,
	"amount_cents" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"frequency" "recurrence" NOT NULL,
	"starts_on" date NOT NULL,
	"next_due_on" date,
	"payments_left" integer,
	"payment_method_id" uuid,
	"category" text DEFAULT 'emi' NOT NULL,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "emis_amount_positive" CHECK ("emis"."amount_cents" > 0),
	CONSTRAINT "emis_frequency" CHECK ("emis"."frequency" in ('monthly', 'fortnightly'))
);
--> statement-breakpoint
CREATE TABLE "money_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_categories_user_name" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "money_report_prefs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent_month" char(7),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"label" text NOT NULL,
	"last4" char(4),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personal_expense_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expense_id" uuid NOT NULL,
	"name" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"category" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "personal_expense_items_non_negative" CHECK ("personal_expense_items"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "personal_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"date" date NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"payment_method_id" uuid,
	"notes" text,
	"halves_expense_id" uuid,
	"emi_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personal_expenses_amount_positive" CHECK ("personal_expenses"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "emis" ADD CONSTRAINT "emis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emis" ADD CONSTRAINT "emis_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_categories" ADD CONSTRAINT "money_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_report_prefs" ADD CONSTRAINT "money_report_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_expense_items" ADD CONSTRAINT "personal_expense_items_expense_id_personal_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."personal_expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_expenses" ADD CONSTRAINT "personal_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_expenses" ADD CONSTRAINT "personal_expenses_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_expenses" ADD CONSTRAINT "personal_expenses_halves_expense_id_expenses_id_fk" FOREIGN KEY ("halves_expense_id") REFERENCES "public"."expenses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personal_expenses" ADD CONSTRAINT "personal_expenses_emi_id_emis_id_fk" FOREIGN KEY ("emi_id") REFERENCES "public"."emis"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "emis_user_idx" ON "emis" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "emis_due_idx" ON "emis" USING btree ("next_due_on");--> statement-breakpoint
CREATE INDEX "payment_methods_user_idx" ON "payment_methods" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "personal_expense_items_expense_idx" ON "personal_expense_items" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "personal_expenses_user_date_idx" ON "personal_expenses" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "personal_expenses_halves_idx" ON "personal_expenses" USING btree ("halves_expense_id");