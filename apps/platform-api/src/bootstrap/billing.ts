import type { createPlatformDb } from "@ecs/db";
import type { createLogger } from "@ecs/logger";
import { createLinksEtBillingPaymentVerifier } from "../modules/billing/links-et-payment-verifier.js";
import { createBillingPaymentVerificationChain } from "../modules/billing/payment-verification.js";
import { createPlanAdministrationService } from "../modules/billing/plan-administration.js";
import { createBillingProviderEventInbox } from "../modules/billing/provider-event-inbox.js";
import { createBillingService } from "../modules/billing/service.js";

type PlatformDatabase = ReturnType<typeof createPlatformDb>["db"];
type PlatformLogger = Pick<ReturnType<typeof createLogger>, "info">;

type BillingBootstrapOptions = {
  db: PlatformDatabase;
  env: NodeJS.ProcessEnv;
  logger: PlatformLogger;
};

export function createBillingRuntime(options: BillingBootstrapOptions) {
  const paymentDestinations = [
    {
      provider: "telebirr",
      label: "Telebirr",
      accountName: options.env.PLATFORM_BILLING_TELEBIRR_NAME?.trim() ?? "",
      accountNumber: options.env.PLATFORM_BILLING_TELEBIRR_ACCOUNT?.trim() ?? "",
    },
    {
      provider: "cbe",
      label: "CBE",
      accountName: options.env.PLATFORM_BILLING_CBE_NAME?.trim() ?? "",
      accountNumber: options.env.PLATFORM_BILLING_CBE_ACCOUNT?.trim() ?? "",
    },
  ].filter((destination) => destination.accountName && destination.accountNumber);
  const linksEtApiKey = options.env.LINKS_ET_API_KEY?.trim() ?? "";

  options.logger.info(
    {
      configured: Boolean(linksEtApiKey),
      paymentDestinations: paymentDestinations.map((item) => item.provider),
    },
    "Platform billing payment verification configured.",
  );

  const billingService = createBillingService(options.db, {
    paymentDestinations,
    onPaymentVerification: (result) =>
      options.logger.info(result, "Platform billing payment evidence checked."),
    verifyPaymentEvidence: createBillingPaymentVerificationChain(
      linksEtApiKey ? [createLinksEtBillingPaymentVerifier({ apiKey: linksEtApiKey })] : [],
    ),
  });

  return {
    billingProviderEventInbox: createBillingProviderEventInbox(
      options.db,
      billingService.completeChapaInvoicePayment,
    ),
    billingService,
    planAdministrationService: createPlanAdministrationService(options.db),
  };
}
