import type { createPlatformDb } from "@ecs/db";
import { tenantOnboarding } from "@ecs/db";
import { eq } from "drizzle-orm";

import type { TenantOnboardingResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createTenantOnboardingService(db: PlatformDb) {
  return {
    getTenantOnboarding: async (input: { tenantId: string }): Promise<TenantOnboardingResult> => {
      const [row] = await db
        .select({
          tenantId: tenantOnboarding.tenantId,
          status: tenantOnboarding.status,
          currentStep: tenantOnboarding.currentStep,
          completedSteps: tenantOnboarding.completedSteps,
        })
        .from(tenantOnboarding)
        .where(eq(tenantOnboarding.tenantId, input.tenantId))
        .limit(1);

      if (!row) {
        return { ok: false, error: "onboarding_not_found" };
      }

      return {
        ok: true,
        onboarding: row,
      };
    },
  };
}
