const SCOPE_MARKER = "ecs-css-scope:";

function templateScopeFromId(id: string): string | null {
  const file = id.split("?")[0]!.replaceAll("\\", "/");
  const match = file.match(/\/src\/templates\/(luvia|nexahub|afro)\/v1\//);
  return match ? match[1]! : null;
}

/** Split a selector list on top-level commas only (ignore `:is(a, b)`, attributes, strings). */
function splitSelectorList(selector: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";

  for (let i = 0; i < selector.length; i += 1) {
    const ch = selector[i]!;

    if (quote) {
      current += ch;
      if (ch === "\\" && i + 1 < selector.length) {
        i += 1;
        current += selector[i]!;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === "(" || ch === "[") depth += 1;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);

    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  parts.push(current);
  return parts;
}

function prefixOneSelector(sel: string, scope: string): string {
  if (!sel) return sel;
  if (sel === ":root" || sel === "html") return scope;
  if (sel === "*" ) return `${scope} ${sel}`;
  if (sel === "body" || sel.startsWith("body ")) return `${scope} ${sel}`;
  if (sel.startsWith("html.") || sel.startsWith("html[") || sel.startsWith("html:")) {
    return `${scope}${sel.slice(4)}`;
  }
  if (sel.startsWith(":root.") || sel.startsWith(":root[")) {
    return `${scope}${sel.slice(5)}`;
  }
  if (sel === scope || sel.startsWith(`${scope} `) || sel.startsWith(`${scope}.`) || sel.startsWith(`${scope}[`) || sel.startsWith(`${scope}:`)) {
    return sel;
  }
  return `${scope} ${sel}`;
}

function prefixSelectorList(selector: string, scope: string): string {
  return splitSelectorList(selector)
    .map((part) => prefixOneSelector(part.trim(), scope))
    .filter(Boolean)
    .join(", ");
}

function isGlobalAtRuleAncestor(node: { type?: string; name?: string; parent?: unknown } | null | undefined): boolean {
  let current = node?.parent as { type?: string; name?: string; parent?: unknown } | null | undefined;
  while (current && current.type !== "root") {
    if (current.type === "atrule" && current.name) {
      const name = current.name.replace(/^-.*?-/, "").toLowerCase();
      if (name.includes("keyframes") || name === "page") return true;
    }
    current = current.parent as typeof current;
  }
  return false;
}

type PostcssRule = { selector?: string; parent?: unknown };
type PostcssRoot = {
  raws: Record<string, unknown>;
  walkRules(cb: (rule: PostcssRule) => void): void;
  toString(): string;
};

/**
 * PostCSS plugin: rewrite selectors under `.template-<name>` (class on `<html>`).
 * Mutates the AST — no string re-parse (avoids CssSyntaxError on `:is(a, b)` etc.).
 */
export function templateCssScopePostcss() {
  return {
    postcssPlugin: "ecs-template-css-scope",
    Once(root: PostcssRoot, helpers: { result: { opts: { from?: string; to?: string } } }) {
      const from = String(helpers.result.opts.from ?? helpers.result.opts.to ?? "").replaceAll("\\", "/");
      const match = from.match(/\/src\/templates\/(luvia|nexahub|afro)\/v1\//);
      if (!match) return;
      const scope = `.template-${match[1]!}`;

      if (root.raws[SCOPE_MARKER] === scope) return;
      if (root.toString().includes(SCOPE_MARKER)) return;

      root.walkRules((rule) => {
        if (!rule.selector) return;
        if (isGlobalAtRuleAncestor(rule as never)) return;
        rule.selector = prefixSelectorList(rule.selector, scope);
      });

      root.raws[SCOPE_MARKER] = scope;
    },
  };
}

/** Text scoper used by unit tests (same rules as the AST walker). */
export function scopeCssText(css: string, scope: string): string {
  if (css.includes(SCOPE_MARKER)) return css;
  const marker = `/* ${SCOPE_MARKER}${scope} */`;

  // Lightweight top-level split: prefix non-at-rule selectors; recurse into media-like blocks.
  const chunks: string[] = [];
  let buf = "";
  let depth = 0;
  let i = 0;

  while (i < css.length) {
    const ch = css[i]!;
    if (ch === "/" && css[i + 1] === "*") {
      const end = css.indexOf("*/", i + 2);
      const stop = end === -1 ? css.length : end + 2;
      buf += css.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      while (j < css.length) {
        if (css[j] === "\\") {
          j += 2;
          continue;
        }
        if (css[j] === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      buf += css.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "{") {
      depth += 1;
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      buf += ch;
      i += 1;
      if (depth === 0) {
        chunks.push(buf);
        buf = "";
      }
      continue;
    }
    buf += ch;
    i += 1;
  }
  if (buf.trim()) chunks.push(buf);

  const out: string[] = [marker];
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("@")) {
      const name = (trimmed.match(/^@([-\w]+)/)?.[1] ?? "").toLowerCase();
      const isWrap =
        name === "media" ||
        name === "supports" ||
        name === "container" ||
        (name === "layer" && trimmed.includes("{"));
      const isSkip =
        name === "charset" ||
        name === "import" ||
        name === "namespace" ||
        name === "font-face" ||
        name.includes("keyframes") ||
        name === "property" ||
        name === "counter-style" ||
        name === "font-feature-values" ||
        name === "layer";

      if (isWrap && trimmed.includes("{")) {
        const open = trimmed.indexOf("{");
        const last = trimmed.lastIndexOf("}");
        const head = trimmed.slice(0, open + 1);
        const inner = trimmed.slice(open + 1, last);
        const close = trimmed.slice(last);
        // Do not re-inject the scope marker inside nested blocks.
        const scopedInner = scopeCssText(inner, scope).replace(/^\/\* ecs-css-scope:[^*]+\*\/\s*/, "");
        out.push(`${head}${scopedInner}${close}`);
        continue;
      }
      if (isSkip) {
        out.push(chunk);
        continue;
      }
      if (trimmed.includes("{")) {
        const open = trimmed.indexOf("{");
        const last = trimmed.lastIndexOf("}");
        const head = trimmed.slice(0, open + 1);
        const inner = trimmed.slice(open + 1, last);
        const close = trimmed.slice(last);
        const scopedInner = scopeCssText(inner, scope).replace(/^\/\* ecs-css-scope:[^*]+\*\/\s*/, "");
        out.push(`${head}${scopedInner}${close}`);
        continue;
      }
      out.push(chunk);
      continue;
    }

    const open = trimmed.indexOf("{");
    if (open === -1) {
      out.push(chunk);
      continue;
    }
    const selector = trimmed.slice(0, open).trim();
    const body = trimmed.slice(open);
    if (selector.startsWith("@")) {
      out.push(chunk);
      continue;
    }
    out.push(`${prefixSelectorList(selector, scope)}${body}`);
  }

  return out.join("\n");
}

export { prefixSelectorList, splitSelectorList, templateScopeFromId };
