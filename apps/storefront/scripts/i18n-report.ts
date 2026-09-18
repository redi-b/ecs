import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Messages = Record<string, string>;

const intentionallyShared = new Set(["language_english"]);

function placeholders(value: string) {
  return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => match[1]).sort();
}

function namespace(key: string) {
  return key.split("_", 1)[0] || "other";
}

export function createTranslationCoverage(base: Messages, translation: Messages) {
  const keys = Object.keys(base).filter((key) => key !== "$schema").sort();
  const missing = keys.filter((key) => !(key in translation));
  const extra = Object.keys(translation).filter((key) => key !== "$schema" && !(key in base)).sort();
  const empty = keys.filter((key) => !translation[key]?.trim());
  const placeholderMismatch = keys.filter(
    (key) => JSON.stringify(placeholders(base[key] ?? "")) !== JSON.stringify(placeholders(translation[key] ?? "")),
  );
  const untranslatedClones = keys.filter(
    (key) => base[key] === translation[key] && !intentionallyShared.has(key),
  );
  const namespaces = Object.fromEntries(
    [...new Set(keys.map(namespace))].sort().map((name) => {
      const namespaceKeys = keys.filter((key) => namespace(key) === name);
      const incomplete = new Set([...missing, ...empty, ...placeholderMismatch, ...untranslatedClones]);
      const translated = namespaceKeys.filter((key) => !incomplete.has(key)).length;
      return [name, { total: namespaceKeys.length, translated, fallback: namespaceKeys.length - translated }];
    }),
  );
  return {
    locale: "am",
    sourceLocale: "en",
    total: keys.length,
    translated: keys.length - new Set([...missing, ...empty, ...placeholderMismatch, ...untranslatedClones]).size,
    missing,
    extra,
    empty,
    placeholderMismatch,
    untranslatedClones,
    namespaces,
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const root = resolve(import.meta.dirname, "..");
  const [base, translation] = await Promise.all([
    readFile(resolve(root, "messages/en.json"), "utf8").then(JSON.parse) as Promise<Messages>,
    readFile(resolve(root, "messages/am.json"), "utf8").then(JSON.parse) as Promise<Messages>,
  ]);
  const report = createTranslationCoverage(base, translation);
  console.log(JSON.stringify(report, null, 2));
  if (report.missing.length || report.extra.length || report.empty.length || report.placeholderMismatch.length || report.untranslatedClones.length) {
    process.exitCode = 1;
  }
}
