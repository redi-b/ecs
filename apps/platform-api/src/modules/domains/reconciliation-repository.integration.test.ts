import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  auditLogs,
  createPlatformDb,
  domainLifecycleEvents,
  domains,
  domainVerificationChallenges,
  organizations,
  tenants,
} from "@ecs/db";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDomainTenantLookup } from "../../context/domain-tenant-lookup.js";
import { createDomainReconciler } from "./reconciler.js";
import { createDomainReconciliationRepository } from "./reconciliation-repository.js";
import { createDomainRoutePublisher } from "./route-publisher.js";
import { renderDomainRoutes } from "./route-renderer.js";
import { createDomainManagementService } from "./service.js";

test(
  "serializes domain reconciliation across database sessions and writes tenant-safe readiness",
  {
    skip: process.env.ECS_DOMAIN_REPOSITORY_TEST !== "1",
    timeout: 60_000,
  },
  async (t) => {
    const adminUrl = new URL(
      process.env.PLATFORM_DOMAIN_TEST_ADMIN_URL ?? "postgres://ecs:ecs@localhost:5432/postgres",
    );
    if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(adminUrl.hostname))
      throw new Error("Local PostgreSQL required");
    const name = `ecs_domain_repo_${randomUUID().replaceAll("-", "")}`;
    const admin = createPlatformDb({ connectionString: adminUrl.toString(), max: 1 });
    let created = false;
    let database: ReturnType<typeof createPlatformDb> | undefined;
    t.after(async () => {
      await database?.pool.end();
      try {
        if (created) await admin.pool.query(`DROP DATABASE "${name}"`);
      } finally {
        await admin.pool.end();
      }
    });
    await admin.pool.query(`CREATE DATABASE "${name}"`);
    created = true;
    const url = new URL(adminUrl);
    url.pathname = `/${name}`;
    database = createPlatformDb({ connectionString: url.toString(), max: 3 });
    await migrate(database.db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../../packages/db/migrations", import.meta.url),
      ),
    });
    await migrate(database.db, {
      migrationsFolder: fileURLToPath(
        new URL("../../../../../packages/db/migrations", import.meta.url),
      ),
    });
    await database.db.insert(organizations).values({ id: "org_1", name: "Shop", slug: "shop" });
    const [tenant] = await database.db
      .insert(tenants)
      .values({ organizationId: "org_1", name: "Shop", handle: "shop", status: "active" })
      .returning();
    assert.ok(tenant);
    const [domain] = await database.db
      .insert(domains)
      .values({
        tenantId: tenant.id,
        hostname: "shop.example.com",
        type: "custom_domain",
        status: "pending_dns",
        verificationStatus: "verified",
      })
      .returning();
    assert.ok(domain);
    const first = createDomainReconciliationRepository(database.db);
    const second = createDomainReconciliationRepository(database.db);
    let release!: () => void;
    let entered!: () => void;
    const enteredPromise = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const running = first.runExclusive(async () => {
      entered();
      await hold;
      return "first";
    });
    await enteredPromise;
    try {
      const overlap = await second.runExclusive(async () => {
        throw new Error("Overlapping run acquired lock");
      });
      assert.deepEqual(overlap, { acquired: false });
    } finally {
      release();
    }
    assert.deepEqual(await running, { acquired: true, value: "first" });
    const now = Date.now();
    const result = await first.runExclusive(async (store) =>
      store.apply({
        domainId: domain.id,
        tenantId: tenant.id,
        evidence: { ownership: true, dns: "ready", https: "valid" },
        now,
      }),
    );
    assert.equal(result.acquired, true);
    if (!result.acquired) return;
    assert.equal(result.value.ok, true);
    if (!result.value.ok) return;
    assert.equal(result.value.domain.status, "active");
    assert.equal(result.value.domain.activatedAt?.getTime(), now);
    assert.equal(result.value.changed, true);
    const activatedDomain = result.value.domain;
    const denied = await second.runExclusive((store) =>
      store.apply({
        domainId: domain.id,
        tenantId: randomUUID(),
        evidence: { ownership: true, dns: "ready", https: "valid" },
        now,
      }),
    );
    assert.deepEqual(denied, { acquired: true, value: { ok: false, error: "domain_not_found" } });
    await first.runExclusive((store) =>
      store.apply({
        domainId: domain.id,
        tenantId: tenant.id,
        evidence: { ownership: true, dns: "ready", https: "valid" },
        now: now + 1000,
      }),
    );
    const events = await database.db
      .select()
      .from(domainLifecycleEvents)
      .where(eq(domainLifecycleEvents.domainId, domain.id));
    assert.equal(events.length, 1);
    const audits = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetId, domain.id));
    assert.equal(audits.length, 1);
    const broken = { ownership: false, dns: "ready" as const, https: "valid" as const };
    const warning = await first.runExclusive((store) =>
      store.apply({ domainId: domain.id, tenantId: tenant.id, evidence: broken, now: now + 2000 }),
    );
    assert.ok(warning.acquired && warning.value.ok);
    if (!warning.acquired || !warning.value.ok) return;
    assert.equal(warning.value.domain.warningSince?.getTime(), now + 2000);
    assert.equal(warning.value.routeDesired, true);
    const warnedDomain = warning.value.domain;
    await assert.rejects(
      first.runExclusive(async (store) => {
        await store.apply({
          domainId: domain.id,
          tenantId: tenant.id,
          evidence: { ownership: true, dns: "ready", https: "valid" },
          now: now + 3000,
        });
        throw new Error("Injected failure before commit");
      }),
      /Injected failure/,
    );
    const replay = await second.runExclusive((store) =>
      store.apply({ domainId: domain.id, tenantId: tenant.id, evidence: broken, now: now + 4000 }),
    );
    assert.ok(replay.acquired && replay.value.ok);
    if (!replay.acquired || !replay.value.ok) return;
    assert.equal(replay.value.changed, false);
    assert.equal(replay.value.domain.warningSince?.getTime(), now + 2000);
    const afterRollback = await database.db
      .select()
      .from(domainLifecycleEvents)
      .where(eq(domainLifecycleEvents.domainId, domain.id));
    assert.equal(afterRollback.length, 2);
    const auditsAfterRollback = await database.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetId, domain.id));
    assert.equal(auditsAfterRollback.length, 2);
    const routeHosts = (at: number) =>
      first.runExclusive(async (store) =>
        (await store.listRouteDomains(at)).map((row) => row.hostname),
      );
    const desired = await routeHosts(now + 4000);
    assert.deepEqual(desired, { acquired: true, value: [domain.hostname] });
    const expired = await routeHosts(now + 2000 + 7 * 86400000);
    assert.deepEqual(expired, { acquired: true, value: [] });

    // Observations taken before the warning must not overwrite newer durable state.
    const stale = await first.runExclusive((store) =>
      store.apply({
        domainId: domain.id,
        tenantId: tenant.id,
        expectedDomain: activatedDomain,
        evidence: { ownership: true, dns: "ready", https: "valid" },
        now: now + 5000,
      }),
    );
    assert.deepEqual(stale, { acquired: true, value: { ok: false, error: "domain_changed" } });
    // Timestamp precision alone is insufficient: state can change within a millisecond.
    const sameTimestampStale = await first.runExclusive((store) =>
      store.apply({
        domainId: domain.id,
        tenantId: tenant.id,
        expectedDomain: {
          ...activatedDomain,
          updatedAt: warnedDomain.updatedAt,
        },
        evidence: { ownership: true, dns: "ready", https: "valid" },
        now: now + 5000,
      }),
    );
    assert.deepEqual(sameTimestampStale, {
      acquired: true,
      value: { ok: false, error: "domain_changed" },
    });
    assert.deepEqual(await routeHosts(now + 5000), {
      acquired: true,
      value: [domain.hostname],
    });
    await database.db.update(tenants).set({ status: "suspended" }).where(eq(tenants.id, tenant.id));
    assert.deepEqual(await routeHosts(now + 5000), {
      acquired: true,
      value: [],
    });
    await database.db.update(tenants).set({ status: "active" }).where(eq(tenants.id, tenant.id));
    await database.db.update(domains).set({ status: "removing" }).where(eq(domains.id, domain.id));
    assert.deepEqual(await routeHosts(now + 5000), { acquired: true, value: [] });
    const [counter] = await database.db
      .insert(domains)
      .values({
        tenantId: tenant.id,
        hostname: "counter.example.com",
        type: "custom_domain",
        status: "pending_dns",
        verificationStatus: "verified",
      })
      .returning();
    assert.ok(counter);
    await database.db.insert(domainVerificationChallenges).values({
      domainId: counter.id,
      recordName: `_ecs-verification.${counter.hostname}`,
      recordValue: "ecs-domain-verification=test",
      verifiedAt: new Date(now),
      expiresAt: new Date(now + 10000),
    });
    const directory = await mkdtemp(join(tmpdir(), "ecs-reconciler-test-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const routeOptions = { service: "ecs-custom-storefront@file", resolver: "letsencrypt" };
    const liveDb = database.db;
    let httpsCalls = 0;
    let enabled = true;
    let entitled = true;
    let dnsFailure = false;
    let httpsFailure = false;
    let ownership = true;
    let caaAllowed = false;
    let providerFailure = false;
    let clock = now + 6000;
    const reconciler = createDomainReconciler({
      repository: first,
      publisher: createDomainRoutePublisher({ directory }),
      routeOptions,
      enabled: () => enabled,
      hasEntitlement: async () => entitled,
      now: () => clock,
      probeDns: async () =>
        dnsFailure
          ? { ok: false, error: "dns_lookup_failed" }
          : {
              ok: true,
              ownership,
              dns: "ready",
              addresses: ["178.238.224.27"],
              readyAddresses: ["178.238.224.27"],
            },
      probeCaa: async () => ({
        ok: true,
        allowed: caaAllowed,
        reason: caaAllowed ? "allowed" : "issuer_not_allowed",
        checkedHostname: null,
      }),
      probeHttps: async () => {
        const [committed] = await liveDb.select().from(domains).where(eq(domains.id, counter.id));
        if (httpsCalls === 0) assert.equal(committed?.status, "pending_certificate");
        httpsCalls++;
        if (httpsFailure) return { ok: false, error: "https_probe_failed" };
        return { ok: true, https: "valid" };
      },
      verifyRoutes: async (hostnames) => {
        if (providerFailure) throw new Error("provider_unavailable");
        assert.equal(
          await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
          renderDomainRoutes(hostnames, routeOptions),
        );
      },
    });
    const input = { domainId: counter.id, tenantId: tenant.id };
    assert.equal((await reconciler.reconcileOne(input)).outcome, "caa_restricted");
    const diagnosticManagement = createDomainManagementService(liveDb, {
      evaluateEntitlement: async () => ({
        allowed: true,
        key: "customDomains",
        source: "plan",
        subscriptionStatus: "active",
      }),
    });
    assert.deepEqual(
      (await diagnosticManagement.listTenantDomains({ tenantId: tenant.id })).domains.find(
        (row) => row.id === counter.id,
      )?.diagnostics,
      {
        checkedAt: new Date(clock).toISOString(),
        reason: "caa_restricted",
        detail: "issuer_not_allowed",
      },
    );
    assert.doesNotMatch(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      /counter.example.com/,
    );
    caaAllowed = true;
    const prepared = await reconciler.reconcileOne(input);
    assert.equal(prepared.outcome, "updated");
    assert.equal(httpsCalls, 0);
    assert.match(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      /counter.example.com/,
    );
    const activated = await reconciler.reconcileOne({ domainId: counter.id, tenantId: tenant.id });
    assert.equal(activated.outcome, "updated");
    assert.equal(httpsCalls, 1);
    const [completed] = await liveDb.select().from(domains).where(eq(domains.id, counter.id));
    assert.equal(completed?.status, "active");
    assert.equal(
      (await reconciler.reconcileOne({ ...input, tenantId: randomUUID() })).outcome,
      "domain_not_found",
    );
    const replayed = await reconciler.reconcileOne(input);
    assert.ok(replayed.outcome === "updated" && replayed.changed === false);
    assert.equal(
      (await diagnosticManagement.listTenantDomains({ tenantId: tenant.id })).domains.find(
        (row) => row.id === counter.id,
      )?.diagnostics?.reason,
      "ready",
    );
    dnsFailure = true;
    assert.equal((await reconciler.reconcileOne(input)).outcome, "retry");
    assert.equal(
      (await liveDb.select().from(domains).where(eq(domains.id, counter.id)))[0]?.status,
      "active",
    );
    assert.equal(
      (await diagnosticManagement.listTenantDomains({ tenantId: tenant.id })).domains.find(
        (row) => row.id === counter.id,
      )?.diagnostics?.reason,
      "dns_lookup_failed",
    );
    const auditBeforeRetryReplay = (
      await liveDb.select().from(auditLogs).where(eq(auditLogs.targetId, counter.id))
    ).length;
    assert.equal((await reconciler.reconcileOne(input)).outcome, "retry");
    assert.equal(
      (await liveDb.select().from(auditLogs).where(eq(auditLogs.targetId, counter.id))).length,
      auditBeforeRetryReplay,
    );
    dnsFailure = false;
    entitled = false;
    assert.equal((await reconciler.reconcileOne(input)).outcome, "entitlement_required");
    assert.doesNotMatch(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      /counter.example.com/,
    );
    entitled = true;
    enabled = false;
    assert.equal((await reconciler.reconcileOne(input)).outcome, "disabled");
    enabled = true;
    ownership = false;
    httpsFailure = true;
    clock += 1000;
    assert.equal((await reconciler.reconcileOne(input)).outcome, "updated");
    const [warnedAfterOutage] = await liveDb
      .select()
      .from(domains)
      .where(eq(domains.id, counter.id));
    assert.equal(warnedAfterOutage?.status, "misconfigured");
    assert.equal(warnedAfterOutage?.warningSince?.getTime(), clock);
    assert.equal(warnedAfterOutage?.sslStatus, "active");
    assert.equal(
      (await diagnosticManagement.listTenantDomains({ tenantId: tenant.id })).domains.find(
        (row) => row.id === counter.id,
      )?.warningGraceExpiresAt,
      new Date(clock + 7 * 86400000).toISOString(),
    );
    httpsFailure = false;
    assert.match(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      /counter.example.com/,
    );
    clock += 7 * 86400000;
    dnsFailure = true;
    assert.equal((await reconciler.reconcileOne(input)).outcome, "retry");
    assert.doesNotMatch(
      await readFile(join(directory, "ecs-custom-domains.yml"), "utf8"),
      /counter.example.com/,
    );
    const removalInput = { ...input, userId: "merchant", now: clock };
    assert.deepEqual(
      await first.runExclusive((store) =>
        store.markRemoving({
          ...removalInput,
          tenantId: randomUUID(),
        }),
      ),
      { acquired: true, value: { ok: false, error: "domain_not_found" } },
    );
    const beforeRemoval = (
      await liveDb.select().from(domains).where(eq(domains.id, counter.id))
    )[0];
    assert.ok(beforeRemoval);
    await liveDb
      .update(tenants)
      .set({ primaryDomainId: counter.id })
      .where(eq(tenants.id, input.tenantId));
    providerFailure = true;
    assert.equal((await reconciler.remove(removalInput)).outcome, "removing");
    const removedRow = (await liveDb.select().from(domains).where(eq(domains.id, counter.id)))[0];
    assert.equal(removedRow?.status, "removing");
    assert.equal(removedRow?.isPrimary, false);
    assert.deepEqual(
      await first.runExclusive((store) =>
        store.recordDiagnostic({
          ...input,
          expectedDomain: beforeRemoval,
          diagnostic: { checkedAt: new Date(clock).toISOString(), reason: "ready", detail: null },
        }),
      ),
      { acquired: true, value: { ok: false, error: "domain_changed" } },
    );
    assert.equal(
      (await liveDb.select().from(tenants).where(eq(tenants.id, input.tenantId)))[0]
        ?.primaryDomainId,
      null,
    );
    assert.equal(await first.findProbeCandidate(input), undefined);
    const staleAfterRemoval = await first.runExclusive((store) =>
      store.apply({
        ...input,
        expectedDomain: beforeRemoval,
        now: clock + 1,
        evidence: { ownership: true, dns: "ready", https: "valid" },
      }),
    );
    assert.deepEqual(staleAfterRemoval, {
      acquired: true,
      value: { ok: false, error: "domain_changed" },
    });
    providerFailure = false;
    const repeatRemoval = await reconciler.remove(removalInput);
    assert.equal(repeatRemoval.outcome, "removed");
    assert.equal("changed" in repeatRemoval && repeatRemoval.changed, false);
    const removedDomains = await createDomainManagementService(liveDb, {
      evaluateEntitlement: async () => ({
        allowed: true,
        key: "customDomains",
        source: "plan",
        subscriptionStatus: "active",
      }),
    }).listTenantDomains({ tenantId: input.tenantId });
    assert.equal(
      removedDomains.domains.some((row) => row.id === counter.id),
      false,
    );
    await liveDb
      .insert(organizations)
      .values({ id: "org_claim", name: "Claim shop", slug: "claim-shop" });
    const [claimShop] = await liveDb
      .insert(tenants)
      .values({
        organizationId: "org_claim",
        name: "Claim shop",
        handle: "claim-shop",
        status: "active",
      })
      .returning();
    assert.ok(claimShop);
    const management = createDomainManagementService(liveDb, {
      customDomainsAvailable: true,
      evaluateEntitlement: async () => ({
        allowed: true,
        key: "customDomains",
        source: "plan",
        subscriptionStatus: "active",
      }),
    });
    const claimInput = { tenantId: claimShop.id, userId: "merchant", hostname: "BÜCHER.de" };
    const claim = await management.createTenantDomain(claimInput);
    assert.equal(claim.ok, true);
    const replayClaim = await management.createTenantDomain(claimInput);
    assert.ok(claim.ok && replayClaim.ok);
    assert.equal(claim.domain.id, replayClaim.domain.id);
    assert.equal(replayClaim.domain.hostname, "xn--bcher-kva.de");
    assert.deepEqual(await management.createTenantDomain({ ...claimInput, tenantId: tenant.id }), {
      ok: false,
      error: "domain_unavailable",
      status: 409,
    });
    assert.deepEqual(
      await management.createTenantDomain({ ...claimInput, hostname: "app.ecset.dev" }),
      {
        ok: false,
        error: "domain_invalid",
        status: 400,
      },
    );
    const claimWithRetry = async (hostname: string) => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const result = await management.createTenantDomain({ ...claimInput, hostname });
        if (result.ok || result.error !== "domain_reconciliation_busy") return result;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error("Claim retry budget exceeded");
    };
    const competing = await Promise.all([
      claimWithRetry("one.example.com"),
      claimWithRetry("two.example.com"),
    ]);
    assert.equal(competing.filter((result) => result.ok).length, 1);
    assert.deepEqual(
      competing.filter((result) => !result.ok),
      [{ ok: false, error: "domain_limit_reached", status: 409 }],
    );
    assert.equal(
      (await management.listTenantDomains({ tenantId: claimShop.id })).domains.length,
      2,
    );
    await liveDb
      .update(domains)
      .set({
        status: "active",
        verificationStatus: "verified",
        sslStatus: "active",
        activatedAt: null,
      })
      .where(eq(domains.id, claim.domain.id));
    assert.deepEqual(
      await management.setTenantPrimaryDomain({
        domainId: claim.domain.id,
        tenantId: claimShop.id,
        userId: "merchant",
      }),
      {
        ok: false,
        error: "domain_not_verified",
        status: 409,
      },
    );
    await liveDb
      .update(domains)
      .set({ activatedAt: new Date(Date.now() + 60_000) })
      .where(eq(domains.id, claim.domain.id));
    assert.deepEqual(
      await management.setTenantPrimaryDomain({
        domainId: claim.domain.id,
        tenantId: claimShop.id,
        userId: "merchant",
      }),
      {
        ok: false,
        error: "domain_not_verified",
        status: 409,
      },
    );
    await liveDb
      .update(domains)
      .set({ activatedAt: new Date(Date.now() - 1_000) })
      .where(eq(domains.id, claim.domain.id));
    const primaryInput = { domainId: claim.domain.id, tenantId: claimShop.id, userId: "merchant" };
    const primary = await management.setTenantPrimaryDomain(primaryInput);
    assert.equal(primary.ok, true);
    const auditsBeforeReplay = await liveDb
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.targetId, claim.domain.id));
    assert.deepEqual(await management.setTenantPrimaryDomain(primaryInput), primary);
    assert.equal(
      (await liveDb.select().from(auditLogs).where(eq(auditLogs.targetId, claim.domain.id))).length,
      auditsBeforeReplay.length,
    );
    await liveDb
      .update(domains)
      .set({ status: "pending_verification", verificationStatus: "pending", sslStatus: "pending" })
      .where(eq(domains.id, claim.domain.id));
    let enteredDns!: () => void;
    let releaseDns!: () => void;
    const dnsEntered = new Promise<void>((resolve) => {
      enteredDns = resolve;
    });
    const dnsReleased = new Promise<void>((resolve) => {
      releaseDns = resolve;
    });
    const verification = createDomainManagementService(liveDb, {
      evaluateEntitlement: async () => ({
        allowed: true,
        key: "customDomains",
        source: "plan",
        subscriptionStatus: "active",
      }),
      resolveTxt: async () => {
        enteredDns();
        await dnsReleased;
        return [[claim.domain.verificationChallenge?.recordValue ?? ""]];
      },
    }).verifyTenantDomainOwnership({
      domainId: claim.domain.id,
      tenantId: claimShop.id,
      userId: "merchant",
    });
    await dnsEntered;
    try {
      await first.runExclusive((store) =>
        store.markRemoving({
          domainId: claim.domain.id,
          tenantId: claimShop.id,
          userId: "merchant",
          now: Date.now(),
        }),
      );
    } finally {
      releaseDns();
    }
    assert.deepEqual(await verification, { ok: false, error: "domain_not_found", status: 404 });
    assert.equal(
      (await management.listTenantDomains({ tenantId: claimShop.id })).domains.find(
        (row) => row.id === claim.domain.id,
      )?.status,
      "removing",
    );
    assert.equal(
      (await liveDb.select().from(tenants).where(eq(tenants.id, claimShop.id)))[0]?.primaryDomainId,
      null,
    );
    // A pending withdrawal still consumes its slot. Only verified provider
    // withdrawal releases it; old identity/evidence remains permanently inert.
    assert.deepEqual(
      await management.createTenantDomain({ ...claimInput, hostname: "replacement.example.com" }),
      {
        ok: false,
        error: "domain_limit_reached",
        status: 409,
      },
    );
    await reconciler.publishDesired();
    const reclaimed = await management.createTenantDomain({
      ...claimInput,
      hostname: claim.domain.hostname,
    });
    assert.equal(reclaimed.ok, true);
    if (!reclaimed.ok) return;
    assert.notEqual(reclaimed.domain.id, claim.domain.id);
    assert.notEqual(
      reclaimed.domain.verificationChallenge?.recordValue,
      claim.domain.verificationChallenge?.recordValue,
    );
    assert.equal(reclaimed.domain.status, "pending_verification");
    assert.equal(
      (await createDomainTenantLookup(liveDb)(claim.domain.hostname))?.domainId,
      reclaimed.domain.id,
    );
    assert.deepEqual(await management.verifyTenantDomainOwnership(primaryInput), {
      ok: false,
      error: "domain_not_found",
      status: 404,
    });
    assert.equal(
      (
        await liveDb
          .select()
          .from(domainLifecycleEvents)
          .where(eq(domainLifecycleEvents.domainId, claim.domain.id))
      ).some((row) => row.event === "removal_completed"),
      true,
    );
    await liveDb
      .update(domainVerificationChallenges)
      .set({ expiresAt: new Date(0) })
      .where(eq(domainVerificationChallenges.domainId, reclaimed.domain.id));
    const renewed = await management.createTenantDomain({
      ...claimInput,
      hostname: claim.domain.hostname,
    });
    assert.equal(renewed.ok, true);
    if (!renewed.ok) return;
    assert.equal(renewed.domain.id, reclaimed.domain.id);
    assert.notEqual(
      renewed.domain.verificationChallenge?.recordValue,
      reclaimed.domain.verificationChallenge?.recordValue,
    );
    assert.deepEqual(
      await management.createTenantDomain({ ...claimInput, hostname: claim.domain.hostname }),
      renewed,
    );
  },
);
