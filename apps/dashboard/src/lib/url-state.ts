import { z } from "zod";

export const listSearchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
  q: z.string().trim().catch(""),
  sort: z.string().trim().catch(""),
  status: z.string().trim().catch(""),
  view: z.string().trim().catch(""),
});

export type ListSearchParams = z.infer<typeof listSearchParamsSchema>;

export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function parseListSearchParams(input: SearchParamsInput): ListSearchParams {
  if (input instanceof URLSearchParams) {
    const normalized: Record<string, string> = {};

    for (const [key, value] of input.entries()) {
      normalized[key] ??= value;
    }

    return listSearchParamsSchema.parse(normalized);
  }

  const normalized = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  return listSearchParamsSchema.parse(normalized);
}
