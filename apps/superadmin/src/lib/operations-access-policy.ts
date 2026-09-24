export type OperationsAccessFailure =
  | "forbidden"
  | "unauthenticated"
  | "unavailable"
  | "wrong_host";

export function resolveOperationsAccessAction(kind: OperationsAccessFailure) {
  if (kind === "wrong_host") return "not_found" as const;
  if (kind === "unavailable") return "show_unavailable" as const;
  return "sign_in" as const;
}
