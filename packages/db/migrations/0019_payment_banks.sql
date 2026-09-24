CREATE TABLE "payment_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'bank' NOT NULL,
	"logo_url" text,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payment_banks_code_uidx" ON "payment_banks" USING btree ("code");
--> statement-breakpoint
-- logo_url is filled by `pnpm seed:bank-logos` (media storage). Leave null here.
INSERT INTO "payment_banks" ("code", "name", "kind", "logo_url", "sort_order") VALUES
	('telebirr', 'Telebirr', 'wallet', NULL, 10),
	('cbe_birr', 'CBE Birr', 'wallet', NULL, 20),
	('cbe', 'Commercial Bank of Ethiopia', 'bank', NULL, 30),
	('awash', 'Awash Bank', 'bank', NULL, 40),
	('dashen', 'Dashen Bank', 'bank', NULL, 50),
	('abyssinia', 'Bank of Abyssinia', 'bank', NULL, 60),
	('coop', 'Cooperative Bank of Oromia', 'bank', NULL, 70),
	('wegagen', 'Wegagen Bank', 'bank', NULL, 80),
	('united', 'United Bank', 'bank', NULL, 90),
	('nib', 'Nib International Bank', 'bank', NULL, 100),
	('zemen', 'Zemen Bank', 'bank', NULL, 110),
	('hibret', 'Hibret Bank', 'bank', NULL, 120),
	('bunna', 'Bunna International Bank', 'bank', NULL, 130),
	('enat', 'Enat Bank', 'bank', NULL, 140),
	('oromia', 'Oromia Bank', 'bank', NULL, 150),
	('siinqee', 'Siinqee Bank', 'bank', NULL, 160),
	('amhara', 'Amhara Bank', 'bank', NULL, 170),
	('amole', 'Amole', 'wallet', NULL, 180),
	('other', 'Other bank', 'other', NULL, 900);
