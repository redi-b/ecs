CREATE TABLE "platform_system_secrets" (
	"key" text PRIMARY KEY NOT NULL,
	"value_encrypted" text NOT NULL,
	"fingerprint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
