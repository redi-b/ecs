import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getPaginationValue, getRequiredBodyString } from "../shared.js";
import { getPlatformAccess } from "./operator-access.js";

type OperatorOperationsOptions = Pick<
  PlatformAppOptions,
  | "authorizePlatformPermission"
  | "cancelQueuedJob"
  | "getJobOperations"
  | "getPlatformHealth"
  | "getPlatformPrincipalAccess"
  | "getSession"
  | "getSuperadminOverview"
  | "listPlatformOperators"
  | "listSuperadminAudit"
  | "listSuperadminWork"
  | "recoverSuperadminWork"
  | "retryFailedJob"
>;

export function registerPlatformOperatorOperationsRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: OperatorOperationsOptions,
) {
  app.get("/platform/operator/session", async (context) => {
    const session = await options.getSession?.(context.req.raw.headers);
    if (!session) return context.json({ error: "auth_required" }, 401);
    const access = await options.getPlatformPrincipalAccess?.(session.user.id);
    if (!access) return context.json({ error: "operator_forbidden" }, 403);
    return context.json({
      operator: { id: session.user.id, email: session.user.email, name: session.user.name },
      principalId: access.principal.id,
      permissions: access.permissions,
    });
  });

  app.get("/platform/operator/overview", async (context) => {
    if (!options.getSuperadminOverview) {
      return context.json({ error: "operator_overview_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "platform.overview.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.getSuperadminOverview());
  });

  app.get("/platform/operator/work", async (context) => {
    if (!options.listSuperadminWork)
      return context.json({ error: "operator_work_unavailable" }, 503);
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(
      await options.listSuperadminWork({
        kind: context.req.query("kind") === "background_job" ? "background_job" : "shop_setup",
        limit: getPaginationValue(context.req.query("limit"), 20, 100),
        offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
      }),
    );
  });

  app.post("/platform/operator/work/:attemptId/recover", async (context) => {
    if (!options.recoverSuperadminWork) {
      return context.json({ error: "operator_recovery_unavailable" }, 503);
    }
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.retry");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const body = await getJsonBody(context.req.raw);
    const reason = getRequiredBodyString(body, "reason");
    if (!reason || reason.length < 10) {
      return context.json({ error: "recovery_reason_required" }, 400);
    }
    const result = await options.recoverSuperadminWork({
      attemptId: context.req.param("attemptId"),
      operatorUserId: access.session.user.id,
      platformPrincipalId: access.authorization.principal.id,
      reason,
    });
    return result.ok
      ? context.json({ tenant: result.tenant })
      : context.json({ error: result.error }, result.status);
  });

  app.get("/platform/operator/audit", async (context) => {
    if (!options.listSuperadminAudit)
      return context.json({ error: "operator_audit_unavailable" }, 503);
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.audit.read");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const category = getAuditCategory(context.req.query("category"));
    const from = getAuditDate(context.req.query("from"));
    const to = getAuditDate(context.req.query("to"), true);
    return context.json(
      await options.listSuperadminAudit({
        ...getBoundedAuditFilter("action", context.req.query("action")),
        ...getBoundedAuditFilter("actor", context.req.query("actor")),
        ...(category ? { category } : {}),
        ...(from ? { from } : {}),
        limit: getPaginationValue(context.req.query("limit"), 20, 100),
        ...getBoundedAuditFilter("merchant", context.req.query("merchant")),
        offset: getPaginationValue(context.req.query("offset"), 0, 10_000),
        ...getAuditOutcome(context.req.query("outcome")),
        ...getBoundedAuditFilter("resource", context.req.query("resource")),
        ...(to ? { to } : {}),
      }),
    );
  });

  app.get("/platform/operator/operators", async (context) => {
    if (!options.listPlatformOperators)
      return context.json({ error: "operators_unavailable" }, 503);
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "platform.operators.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.listPlatformOperators());
  });

  app.get("/platform/operator/health", async (context) => {
    if (!options.getPlatformHealth) {
      return context.json({ error: "operator_health_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "platform.health.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.getPlatformHealth());
  });

  app.get("/platform/operator/jobs", async (context) => {
    if (!options.getJobOperations) {
      return context.json({ error: "job_operations_unavailable" }, 503);
    }
    const access = await getPlatformAccess(
      options,
      context.req.raw.headers,
      "platform.health.read",
    );
    if (!access.ok) return context.json({ error: access.error }, access.status);
    return context.json(await options.getJobOperations());
  });

  app.post("/platform/operator/jobs/:jobRunId/retry", async (context) => {
    if (!options.retryFailedJob) {
      return context.json({ error: "job_operations_unavailable" }, 503);
    }
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.retry");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const result = await options.retryFailedJob(context.req.param("jobRunId"));
    return result.ok
      ? context.json(result)
      : context.json(
          { error: result.error },
          result.error === "job_not_found" ? 404 : result.error === "job_state_changed" ? 409 : 422,
        );
  });

  app.post("/platform/operator/jobs/:jobRunId/cancel", async (context) => {
    if (!options.cancelQueuedJob) {
      return context.json({ error: "job_operations_unavailable" }, 503);
    }
    const access = await getPlatformAccess(options, context.req.raw.headers, "platform.work.retry");
    if (!access.ok) return context.json({ error: access.error }, access.status);
    const result = await options.cancelQueuedJob(context.req.param("jobRunId"));
    return result.ok
      ? context.json(result)
      : context.json(
          { error: result.error },
          result.error === "job_not_found" ? 404 : result.error === "job_state_changed" ? 409 : 422,
        );
  });
}

function getAuditCategory(value: string | undefined) {
  return value === "billing" ||
    value === "merchant" ||
    value === "provisioning" ||
    value === "support"
    ? value
    : undefined;
}

function getAuditOutcome(
  value: string | undefined,
): { outcome: "accepted" | "completed" | "failed" | "unknown" } | Record<string, never> {
  return value === "accepted" || value === "completed" || value === "failed" || value === "unknown"
    ? { outcome: value }
    : {};
}

function getBoundedAuditFilter<K extends "action" | "actor" | "merchant" | "resource">(
  key: K,
  value: string | undefined,
): Partial<Record<K, string>> {
  const normalized = value?.trim().slice(0, 100);
  return normalized ? ({ [key]: normalized } as Partial<Record<K, string>>) : {};
}

function getAuditDate(value: string | undefined, exclusiveEnd = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00+03:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  if (exclusiveEnd) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
