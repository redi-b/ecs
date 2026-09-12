import { headers } from "next/headers";

import { OperationsPageHeader } from "@/components/operations-page-header";
import { OperatorReadError } from "@/components/operator-read-error";
import { EmailTemplateWorkspace } from "@/features/superadmin/email-template-workspace";
import { getOpsAccess } from "@/lib/ops-access";
import { getEmailTemplates } from "@/lib/platform-api/superadmin/email-templates";

export default async function EmailTemplatesPage() {
  const requestHeaders = await headers();
  const access = await getOpsAccess();
  const result = await getEmailTemplates({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL,
  }).catch(() => ({ message: "email_templates_unavailable", ok: false as const, status: 503 }));

  return (
    <div className="flex flex-col gap-6">
      <OperationsPageHeader
        description="Edit the account emails ECS sends and review every published version."
        title="Email templates"
      />
      {!result.ok ? (
        <OperatorReadError
          resource="Email templates"
          status={result.status}
          unavailableDescription="Email templates could not be loaded."
        />
      ) : (
        <EmailTemplateWorkspace
          canPublish={access.ok && access.permissions.includes("email.templates.publish")}
          canSendTest={access.ok && access.permissions.includes("email.templates.test")}
          canUpdate={access.ok && access.permissions.includes("email.templates.update")}
          catalog={result.data}
        />
      )}
    </div>
  );
}
