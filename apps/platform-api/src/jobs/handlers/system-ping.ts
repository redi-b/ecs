import type { JobHandler } from "@ecs/jobs";

export type SystemPingPayload = {
  message?: string;
};

export const systemPingHandler: JobHandler<SystemPingPayload> = async (ctx) => {
  const raw = ctx.payload;
  const message =
    raw && typeof raw === "object" && "message" in raw && raw.message != null
      ? String((raw as SystemPingPayload).message)
      : undefined;

  const result: { pong: true; at: string; message?: string } = {
    pong: true,
    at: new Date().toISOString(),
  };
  if (message !== undefined && message !== "") {
    result.message = message;
  }
  return result;
};
