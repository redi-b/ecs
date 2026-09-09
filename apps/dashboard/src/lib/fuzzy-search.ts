function normalizeSearchText(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const current = [leftIndex + 1];
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      current[rightIndex + 1] = Math.min(
        (current[rightIndex] ?? 0) + 1,
        (previous[rightIndex + 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + (left[leftIndex] === right[rightIndex] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length] ?? Number.POSITIVE_INFINITY;
}

function subsequenceScore(candidate: string, query: string) {
  let queryIndex = 0;
  let firstMatch = -1;
  let lastMatch = -1;
  for (let index = 0; index < candidate.length && queryIndex < query.length; index += 1) {
    if (candidate[index] !== query[queryIndex]) continue;
    if (firstMatch < 0) firstMatch = index;
    lastMatch = index;
    queryIndex += 1;
  }
  if (queryIndex !== query.length) return null;
  return 6 + (lastMatch - firstMatch + 1 - query.length) / Math.max(query.length, 1);
}

function tokenScore(candidate: string, query: string) {
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  const words = candidate.split(" ");
  if (words.some((word) => word.startsWith(query))) return 2;
  const substringIndex = candidate.indexOf(query);
  if (substringIndex >= 0) return 3 + substringIndex / Math.max(candidate.length, 1);
  const allowedDistance = query.length < 4 ? 0 : Math.max(1, Math.floor(query.length * 0.3));
  const closestDistance = words.reduce(
    (closest, word) => Math.min(closest, editDistance(word, query)),
    Number.POSITIVE_INFINITY,
  );
  if (closestDistance <= allowedDistance) return 4 + closestDistance / query.length;
  return subsequenceScore(candidate, query);
}

export function fuzzySearchScore(searchableText: unknown, query: string) {
  const candidate = normalizeSearchText(searchableText);
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return 0;
  if (!candidate) return null;
  const queryTokens = normalizedQuery.split(" ");
  let score = 0;
  for (const token of queryTokens) {
    const current = tokenScore(candidate, token);
    if (current === null) return null;
    score += current;
  }
  return score / queryTokens.length;
}

export function fuzzyMatches(searchableText: unknown, query: string) {
  return fuzzySearchScore(searchableText, query) !== null;
}

export function rankFuzzyItems<T>(
  items: readonly T[],
  query: string,
  getSearchableText: (item: T) => unknown,
) {
  if (!query.trim()) return [...items];
  return items
    .map((item, index) => ({
      item,
      index,
      score: fuzzySearchScore(getSearchableText(item), query),
    }))
    .filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ item }) => item);
}
