"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { FailureState } from "@/components/app/failure-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <FailureState
      actionLabel={t("common.tryAgain")}
      description={t("common.errors.unavailableDescription")}
      eyebrow={t("common.errors.unavailableEyebrow")}
      onRetry={reset}
      retryingLabel={t("common.errors.retrying")}
      title={t("common.errors.unavailableTitle")}
    />
  );
}
