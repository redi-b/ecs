import { FailureState } from "@/components/app/failure-state";
import { getTranslations } from "@/i18n/server";

export default async function NotFound() {
  const t = await getTranslations();

  return (
    <FailureState
      actionHref="/admin"
      actionLabel={t("common.errors.notFoundAction")}
      description={t("common.errors.notFoundDescription")}
      eyebrow={t("common.errors.notFoundEyebrow")}
      title={t("common.errors.notFoundTitle")}
    />
  );
}
