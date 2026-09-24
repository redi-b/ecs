"use client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

export function TaxonomyLoadNotice({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: boolean;
  retry: () => void;
}) {
  const { t } = useI18n();
  if (error)
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex items-center justify-between gap-2">
          {t("products.filter.categoriesError")}
          <Button variant="outline" size="sm" type="button" onClick={retry}>
            {t("media.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  if (pending)
    return <output className="text-sm text-muted-foreground">{t("common.loading")}</output>;
  return null;
}
