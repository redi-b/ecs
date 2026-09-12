import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformDb,
  inAppNotificationEvents,
  inAppNotifications,
  organizationMembers,
  organizationRoles,
  organizations,
  tenants,
  users,
} from "@ecs/db";
import { eq, inArray } from "drizzle-orm";

import { createInAppNotificationService } from "./inbox.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

test(
  "in-app inbox materializes permission audiences and keeps receipt state personal",
  { skip: connectionString ? false : "PLATFORM_AUTH_INTEGRATION_DATABASE_URL is not set" },
  async () => {
    const { db, pool } = createPlatformDb({ connectionString: connectionString as string, max: 1 });
    const suffix = crypto.randomUUID();
    const organizationId = `inbox-org-${suffix}`;
    const ownerId = `inbox-owner-${suffix}`;
    const viewerId = `inbox-viewer-${suffix}`;
    const productUserId = `inbox-product-${suffix}`;
    const userIds = [ownerId, viewerId, productUserId];

    try {
      await db.insert(organizations).values({
        id: organizationId,
        name: "Inbox test shop",
        slug: `inbox-${suffix}`,
      });
      const [tenant] = await db
        .insert(tenants)
        .values({ handle: `inbox-${suffix}`, name: "Inbox test shop", organizationId })
        .returning({ id: tenants.id });
      assert.ok(tenant);
      await db.insert(users).values([
        { email: `${ownerId}@example.test`, id: ownerId, name: "Owner" },
        { email: `${viewerId}@example.test`, id: viewerId, name: "Viewer" },
        { email: `${productUserId}@example.test`, id: productUserId, name: "Product editor" },
      ]);
      await db.insert(organizationRoles).values({
        id: `inbox-role-${suffix}`,
        organizationId,
        permission: JSON.stringify({ products: ["read"] }),
        role: "product-only",
      });
      await db.insert(organizationMembers).values([
        { id: `inbox-member-owner-${suffix}`, organizationId, role: "owner", userId: ownerId },
        { id: `inbox-member-viewer-${suffix}`, organizationId, role: "viewer", userId: viewerId },
        {
          id: `inbox-member-product-${suffix}`,
          organizationId,
          role: "product-only",
          userId: productUserId,
        },
      ]);

      const inbox = createInAppNotificationService(db);
      const materialized = await inbox.createFromEvent({
        eventType: "order.created",
        payload: { orderId: `order-${suffix}` },
        tenantId: tenant.id,
      });
      assert.equal(materialized.recipients, 2);

      const ownerPage = await inbox.list({ actorUserId: ownerId, tenantId: tenant.id });
      const viewerPage = await inbox.list({ actorUserId: viewerId, tenantId: tenant.id });
      const productPage = await inbox.list({ actorUserId: productUserId, tenantId: tenant.id });
      assert.equal(ownerPage.items.length, 1);
      assert.equal(viewerPage.items.length, 1);
      assert.equal(productPage.items.length, 0);

      const notificationId = ownerPage.items[0]?.id;
      assert.ok(notificationId);
      assert.equal(
        (
          await inbox.setRead({
            actorUserId: ownerId,
            id: notificationId,
            read: true,
            tenantId: tenant.id,
          })
        ).ok,
        true,
      );
      assert.equal(
        (await inbox.unreadCount({ actorUserId: ownerId, tenantId: tenant.id })).count,
        0,
      );
      assert.equal(
        (await inbox.unreadCount({ actorUserId: viewerId, tenantId: tenant.id })).count,
        1,
      );

      assert.equal(
        (await inbox.archive({ actorUserId: viewerId, id: notificationId, tenantId: tenant.id }))
          .ok,
        true,
      );
      assert.equal(
        (await inbox.list({ actorUserId: viewerId, tenantId: tenant.id })).items.length,
        0,
      );
      assert.equal(
        (await inbox.list({ actorUserId: ownerId, tenantId: tenant.id })).items.length,
        1,
      );

      await inbox.createFromEvent({
        eventType: "payment.failed",
        payload: { orderId: `failed-${suffix}` },
        tenantId: tenant.id,
      });
      await inbox.createFromEvent({
        eventType: "payment.paid",
        payload: { orderId: `paid-${suffix}` },
        tenantId: tenant.id,
      });
      const first = await inbox.list({ actorUserId: ownerId, limit: 2, tenantId: tenant.id });
      assert.equal(first.count, 3);
      assert.equal(first.items.length, 2);
      assert.ok(first.nextCursor);
      const second = await inbox.list({
        actorUserId: ownerId,
        cursor: first.nextCursor ?? undefined,
        limit: 2,
        tenantId: tenant.id,
      });
      assert.equal(second.items.length, 1);
      assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 3);

      const offsetPage = await inbox.list({
        actorUserId: ownerId,
        limit: 2,
        offset: 2,
        tenantId: tenant.id,
      });
      assert.equal(offsetPage.count, 3);
      assert.equal(offsetPage.items.length, 1);

      const searchPage = await inbox.list({
        actorUserId: ownerId,
        q: `paid-${suffix}`,
        tenantId: tenant.id,
      });
      assert.equal(searchPage.count, 1);
      assert.equal(searchPage.items.length, 1);
      assert.match(searchPage.items[0]?.body ?? "", new RegExp(`paid-${suffix}`, "i"));

      const groupedOrderId = `grouped-${suffix}`;
      const firstFailure = await inbox.recordEvent({
        eventType: "payment.failed",
        payload: { eventId: `payment-attempt-1-${suffix}`, orderId: groupedOrderId },
        tenantId: tenant.id,
      });
      assert.ok(firstFailure);
      assert.equal((await inbox.materializeEvent(firstFailure.id)).alreadyProcessed, false);

      const groupedAfterFirst = (
        await inbox.list({ actorUserId: ownerId, limit: 20, tenantId: tenant.id })
      ).items.find((item) => item.href === `/admin/orders/${groupedOrderId}`);
      assert.ok(groupedAfterFirst);
      assert.equal(groupedAfterFirst.occurrenceCount, 1);
      assert.equal(
        (
          await inbox.setRead({
            actorUserId: ownerId,
            id: groupedAfterFirst.id,
            read: true,
            tenantId: tenant.id,
          })
        ).ok,
        true,
      );

      const secondFailure = await inbox.recordEvent({
        eventType: "payment.failed",
        payload: { eventId: `payment-attempt-2-${suffix}`, orderId: groupedOrderId },
        tenantId: tenant.id,
      });
      assert.ok(secondFailure);
      assert.notEqual(secondFailure.id, firstFailure.id);
      assert.equal((await inbox.materializeEvent(secondFailure.id)).alreadyProcessed, false);
      assert.equal((await inbox.materializeEvent(secondFailure.id)).alreadyProcessed, true);

      const groupedAfterSecond = (
        await inbox.list({ actorUserId: ownerId, limit: 20, tenantId: tenant.id })
      ).items.filter((item) => item.href === `/admin/orders/${groupedOrderId}`);
      assert.equal(groupedAfterSecond.length, 1);
      assert.equal(groupedAfterSecond[0]?.id, groupedAfterFirst.id);
      assert.equal(groupedAfterSecond[0]?.occurrenceCount, 2);
      assert.equal(groupedAfterSecond[0]?.readAt, null);

      const durableEvent = await inbox.recordEvent({
        eventType: "inventory.low",
        payload: { productId: `product-${suffix}` },
        tenantId: tenant.id,
      });
      const duplicateEvent = await inbox.recordEvent({
        eventType: "inventory.low",
        payload: { productId: `product-${suffix}` },
        tenantId: tenant.id,
      });
      assert.ok(durableEvent);
      assert.equal(duplicateEvent?.id, durableEvent.id);
      assert.equal((await inbox.materializeEvent(durableEvent.id)).alreadyProcessed, false);
      assert.equal((await inbox.materializeEvent(durableEvent.id)).alreadyProcessed, true);
      assert.equal(
        (await inbox.list({ actorUserId: productUserId, tenantId: tenant.id })).items.length,
        1,
      );
    } finally {
      const [tenant] = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.organizationId, organizationId))
        .limit(1);
      if (tenant) {
        await db
          .delete(inAppNotificationEvents)
          .where(eq(inAppNotificationEvents.tenantId, tenant.id));
        await db.delete(inAppNotifications).where(eq(inAppNotifications.tenantId, tenant.id));
        await db.delete(tenants).where(eq(tenants.id, tenant.id));
      }
      await db.delete(organizations).where(eq(organizations.id, organizationId));
      await db.delete(users).where(inArray(users.id, userIds));
      await pool.end();
    }
  },
);
