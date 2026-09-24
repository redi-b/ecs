import { Badge } from "@/components/ui/badge";

const labels: Record<string, string> = {
  active: "Active",
  approved: "Approved",
  cancelled: "Cancelled",
  completed: "Completed",
  disabled: "Disabled",
  failed: "Failed",
  needs_review: "Needs review",
  paid: "Paid",
  pending: "Pending",
  pending_review: "Ready for review",
  rejected: "Rejected",
  suspended: "Suspended",
  void: "Void",
};

export function OperationsStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant = normalized === "active" || normalized === "approved" || normalized === "completed" || normalized === "paid"
    ? "success"
    : normalized === "pending" || normalized === "pending_review" || normalized === "needs_review"
      ? "warning"
      : normalized === "failed" || normalized === "rejected" || normalized === "suspended" || normalized === "void" || normalized === "cancelled" || normalized === "disabled"
        ? "destructive"
        : "outline";
  return <Badge variant={variant}>{labels[normalized] ?? "Unknown"}</Badge>;
}
