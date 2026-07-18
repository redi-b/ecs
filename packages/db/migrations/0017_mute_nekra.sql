CREATE TABLE "telegram_operator_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"telegram_user_id" text NOT NULL,
	"telegram_chat_id" text NOT NULL,
	"username" text,
	"label" text DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_operator_link_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"status" "telegram_connect_session_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telegram_operator_bindings" ADD CONSTRAINT "telegram_operator_bindings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_operator_link_sessions" ADD CONSTRAINT "telegram_operator_link_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_operator_bindings_tenant_tg_user_uidx" ON "telegram_operator_bindings" USING btree ("tenant_id","telegram_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_operator_bindings_tenant_user_uidx" ON "telegram_operator_bindings" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "telegram_operator_bindings_tg_user_idx" ON "telegram_operator_bindings" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "telegram_operator_bindings_tg_chat_idx" ON "telegram_operator_bindings" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_operator_link_sessions_token_uidx" ON "telegram_operator_link_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "telegram_operator_link_sessions_tenant_status_idx" ON "telegram_operator_link_sessions" USING btree ("tenant_id","status");