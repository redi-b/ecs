import Fuse from "fuse.js";

export type FuzzySearchField<T> = {
  getValue: (item: T) => unknown;
  weight?: number;
};

const DEFAULT_OPTIONS = {
  ignoreDiacritics: true,
  ignoreLocation: true,
  includeScore: true,
  shouldSort: true,
  threshold: 0.36,
} as const;

function asFields<T>(
  source: ((item: T) => unknown) | readonly FuzzySearchField<T>[],
): readonly FuzzySearchField<T>[] {
  return typeof source === "function" ? [{ getValue: source }] : source;
}

export function rankFuzzyItems<T>(
  items: readonly T[],
  query: string,
  source: ((item: T) => unknown) | readonly FuzzySearchField<T>[],
) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [...items];

  const fields = asFields(source);
  const records = items.map((item, index) => ({
    ...Object.fromEntries(
      fields.map(({ getValue }, fieldIndex) => [
        `field${fieldIndex}`,
        String(getValue(item) ?? ""),
      ]),
    ),
    index,
    item,
  }));
  const keys = fields.map((field, index) => ({
    name: `field${index}`,
    weight: field.weight ?? 1,
  }));
  const fuse = new Fuse(records, {
    ...DEFAULT_OPTIONS,
    keys,
    minMatchCharLength: normalizedQuery.length === 1 ? 1 : 2,
  });

  return fuse
    .search(normalizedQuery)
    .sort((left, right) =>
      (left.score ?? 1) === (right.score ?? 1)
        ? left.item.index - right.item.index
        : (left.score ?? 1) - (right.score ?? 1),
    )
    .map((result) => result.item.item);
}

export function fuzzyMatches(searchableText: unknown, query: string) {
  if (!query.trim()) return true;
  return rankFuzzyItems([searchableText], query, (value) => value).length > 0;
}
