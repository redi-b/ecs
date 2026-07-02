import { z } from "zod";

export const listSearchParamsSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(10).max(100).catch(20),
  q: z.string().trim().catch(""),
  sort: z.string().trim().catch(""),
  view: z.string().trim().catch(""),
});

export type ListSearchParams = z.infer<typeof listSearchParamsSchema>;

export type SearchParamsInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

export function parseListSearchParams(input: SearchParamsInput): ListSearchParams {
  if (input instanceof URLSearchParams) {
    return listSearchParamsSchema.parse(Object.fromEntries(input.entries()));
  }

  const normalized = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );

  return listSearchParamsSchema.parse(normalized);
}
