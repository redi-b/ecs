import { dashboardRoutes } from "@/lib/routes";

export type ProductImportExecution = {
  cursor: number;
  failedProducts: number;
  id: string;
  outcomes: Array<{
    errorCode: string | null;
    errorMessage: string | null;
    productId: string | null;
    productKey: string;
    sourceRows: number[];
    status: "failed" | "pending" | "succeeded";
  }>;
  status: string;
  succeededProducts: number;
  totalProducts: number;
};

export const RECENT_PRODUCT_IMPORT_KEY = "ecs:products:recent-import";

export async function loadProductImportExecution(executionId: string, signal?: AbortSignal) {
  const response = await fetch(dashboardRoutes.productImportExecutionAction(executionId), {
    cache: "no-store",
    headers: { accept: "application/json" },
    ...(signal ? { signal } : {}),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("product_import_progress_unavailable");
  const data = (await response.json().catch(() => null)) as {
    execution?: ProductImportExecution;
  } | null;
  return data?.execution ?? null;
}
