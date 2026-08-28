DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "subscriptions"
    GROUP BY "tenant_id"
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one subscription per tenant: duplicate subscription rows require reviewed reconciliation.';
  END IF;
END
$$;
--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_tenant_id_unique" ON "subscriptions" USING btree ("tenant_id");
