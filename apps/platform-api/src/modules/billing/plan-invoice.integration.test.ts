import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createPlatformDb,
  invoices,
  organizations,
  plans,
  planVersions,
  subscriptions,
  tenants,
} from "@ecs/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createBillingService } from "./service.js";

const connectionString = process.env.ECS_BILLING_REGRESSION_DATABASE_URL;

test(
  "Growth upgrade does not repurpose a same-amount seeded Starter invoice",
  {
    skip: !connectionString && "Use an isolated ecs_billing_regression database",
  },
  async () => {
    assert.ok(connectionString);
    assert.equal(new URL(connectionString).pathname, "/ecs_billing_regression");
    const { db, pool } = createPlatformDb({ connectionString });
    const rollback = new Error("rollback fixtures");
    try {
      await migrate(db, {
        migrationsFolder: fileURLToPath(
          new URL("../../../../../packages/db/migrations", import.meta.url),
        ),
      });
      try {
        await db.transaction(async (tx) => {
          const tenantId = randomUUID();
          const organizationId = `org_${tenantId}`;
          const starter = randomUUID();
          const growth = randomUUID();
          const starterVersion = randomUUID();
          const growthVersion = randomUUID();
          const subscriptionId = randomUUID();
          const seedId = randomUUID();
          await tx
            .insert(organizations)
            .values({ id: organizationId, name: "Regression", slug: organizationId });
          await tx.insert(tenants).values({
            id: tenantId,
            organizationId,
            name: "Regression",
            handle: `reg-${tenantId}`,
          });
          await tx.insert(plans).values([
            { id: starter, name: "Starter", price: "0", status: "active", visibility: "public" },
            { id: growth, name: "Growth", price: "499", status: "active", visibility: "public" },
          ]);
          await tx.insert(planVersions).values([
            {
              id: starterVersion,
              planId: starter,
              version: 1,
              fingerprint: starterVersion,
              name: "Starter",
              price: "0",
            },
            {
              id: growthVersion,
              planId: growth,
              version: 1,
              fingerprint: growthVersion,
              name: "Growth",
              price: "499",
            },
          ]);
          await tx.insert(subscriptions).values({
            id: subscriptionId,
            tenantId,
            planId: starter,
            planVersionId: starterVersion,
            status: "active",
          });
          await tx.insert(invoices).values({
            id: seedId,
            tenantId,
            subscriptionId,
            planVersionId: starterVersion,
            amount: "499",
            currency: "ETB",
            status: "pending",
            provider: "manual",
            providerReference: "demo-next",
          });
          const billing = createBillingService(tx as unknown as typeof db);
          const input = {
            tenantId,
            subscriptionId,
            planId: growth,
            planVersionId: growthVersion,
            planPrice: "499",
          };
          const result = await billing.ensurePendingPlanInvoice(input);
          assert.equal(result.created, true);
          assert.notEqual(result.invoiceId, seedId);
          const [original] = await tx.select().from(invoices).where(eq(invoices.id, seedId));
          assert.equal(original?.planVersionId, starterVersion);
          assert.equal(original?.provider, "manual");
          assert.equal(original?.providerReference, "demo-next");
          const replay = await billing.ensurePendingPlanInvoice(input);
          assert.equal(replay.created, false);
          assert.equal(replay.invoiceId, result.invoiceId);
          assert.ok(result.invoiceId);
          const [issued] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.id, result.invoiceId));
          assert.equal(issued?.planVersionId, growthVersion);
          const upgrade = await billing.createPlanUpgradeInvoice({ tenantId, planId: growth });
          assert.equal(upgrade.ok, true);
          if (upgrade.ok) assert.equal(upgrade.invoice.id, result.invoiceId);
          // Changing payment providers must not make this look like a planless invoice.
          const txRef = `ecs_bill_${randomUUID()}`;
          await tx
            .update(invoices)
            .set({ provider: "chapa", providerReference: txRef })
            .where(eq(invoices.id, result.invoiceId));
          const status = await billing.getBillingStatus({ tenantId });
          assert.equal(status.ok, true);
          if (status.ok) {
            assert.equal(
              status.billing.invoices.find((invoice) => invoice.id === result.invoiceId)?.planId,
              growth,
            );
            assert.equal(
              status.billing.invoices.find((invoice) => invoice.id === seedId)?.planId,
              starter,
            );
          }
          const paid = await billing.completeChapaInvoicePayment({ tenantId, txRef });
          assert.deepEqual(paid, { ok: true, applied: true });
          const [subscription] = await tx
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, subscriptionId));
          assert.equal(subscription?.planId, growth);
          assert.equal(subscription?.planVersionId, growthVersion);
          assert.deepEqual(await billing.completeChapaInvoicePayment({ tenantId, txRef }), {
            ok: true,
            applied: false,
          });
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    } finally {
      await pool.end();
    }
  },
);
