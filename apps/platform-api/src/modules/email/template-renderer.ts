import { type EmailTemplateDocument, emailTemplateDocumentSchema } from "./template-catalog.js";

const tokenPattern = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

export type RenderEmailTemplateInput = {
  content: unknown;
  locale?: "am" | "en" | undefined;
  preheader: string;
  subject: string;
  variables: Record<string, string>;
};

export type RenderedEmailTemplate = { html: string; subject: string; text: string };

export function renderEmailTemplate(input: RenderEmailTemplateInput): RenderedEmailTemplate {
  const content = emailTemplateDocumentSchema.parse(input.content);
  const subject = interpolate(input.subject, input.variables, false).trim();
  const preheader = interpolate(input.preheader, input.variables, false).trim();
  const rendered = renderNodes(content.content, input.variables);
  const text = renderText(content, input.variables);

  return {
    html: renderShell({ body: rendered, locale: input.locale ?? "en", preheader, subject }),
    subject,
    text,
  };
}

export function findTemplateVariables(value: unknown): string[] {
  const matches = new Set<string>();
  walkStrings(value, (text) => {
    for (const match of text.matchAll(tokenPattern)) {
      if (match[1]) matches.add(match[1]);
    }
  });
  return [...matches].sort();
}

export function validateTemplateVariables(input: {
  allowed: readonly string[];
  content: unknown;
  preheader: string;
  required: readonly string[];
  subject: string;
}) {
  const used = findTemplateVariables({
    content: input.content,
    preheader: input.preheader,
    subject: input.subject,
  });
  const unknown = used.filter((name) => !input.allowed.includes(name));
  const missing = input.required.filter((name) => !used.includes(name));
  return { missing, unknown, used };
}

function renderNodes(nodes: EmailTemplateDocument["content"], variables: Record<string, string>) {
  return nodes.map((node) => renderNode(node, variables)).join("");
}

function renderNode(
  node: EmailTemplateDocument["content"][number],
  variables: Record<string, string>,
): string {
  if (node.type === "text") {
    let value = escapeHtml(interpolate(node.text, variables, false));
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") value = `<strong>${value}</strong>`;
      if (mark.type === "italic") value = `<em>${value}</em>`;
      if (mark.type === "link") {
        value = `<a href="${escapeAttribute(resolveSafeHref(mark.attrs.href, variables))}" style="color:#175cd3;text-decoration:underline">${value}</a>`;
      }
    }
    return value;
  }
  if (node.type === "hardBreak") return "<br>";
  if (node.type === "emailButton") {
    const href = resolveSafeHref(node.attrs.href, variables);
    const label = escapeHtml(interpolate(node.attrs.label, variables, false));
    return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0"><tr><td style="border-radius:8px;background:#171717"><a href="${escapeAttribute(href)}" style="display:inline-block;padding:12px 18px;color:#ffffff;font-size:15px;font-weight:650;line-height:20px;text-decoration:none">${label}</a></td></tr></table>`;
  }
  const children = renderNodes(node.content ?? [], variables);
  if (node.type === "paragraph") return `<p style="margin:0 0 16px">${children || "&nbsp;"}</p>`;
  if (node.type === "heading") {
    const size = node.attrs.level === 2 ? 22 : 18;
    return `<h${node.attrs.level} style="margin:24px 0 12px;font-size:${size}px;line-height:1.3">${children}</h${node.attrs.level}>`;
  }
  if (node.type === "bulletList")
    return `<ul style="margin:0 0 16px;padding-left:24px">${children}</ul>`;
  if (node.type === "orderedList")
    return `<ol style="margin:0 0 16px;padding-left:24px">${children}</ol>`;
  if (node.type === "listItem") return `<li style="margin:0 0 8px">${children}</li>`;
  return "";
}

function renderText(content: EmailTemplateDocument, variables: Record<string, string>) {
  const blocks: string[] = [];
  const visit = (nodes: EmailTemplateDocument["content"]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        blocks.push(interpolate(node.text, variables, false));
      } else if (node.type === "hardBreak") {
        blocks.push("\n");
      } else if (node.type === "emailButton") {
        blocks.push(
          `${interpolate(node.attrs.label, variables, false)}: ${resolveSafeHref(node.attrs.href, variables)}\n\n`,
        );
      } else {
        visit(node.content ?? []);
        if (["paragraph", "heading", "listItem"].includes(node.type)) blocks.push("\n\n");
      }
    }
  };
  visit(content.content);
  return blocks
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderShell(input: {
  body: string;
  locale: "am" | "en";
  preheader: string;
  subject: string;
}) {
  return `<!doctype html><html lang="${input.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head><body style="margin:0;background:#f4f4f1;color:#20201e;font-family:Inter,Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f1"><tr><td style="padding:32px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #deded8;border-radius:12px"><tr><td style="padding:24px 28px 18px;border-bottom:1px solid #ecece7;font-size:18px;font-weight:750;letter-spacing:-.02em">ECS</td></tr><tr><td style="padding:28px;font-size:15px;line-height:1.65">${input.body}</td></tr><tr><td style="padding:18px 28px;border-top:1px solid #ecece7;color:#6b6b66;font-size:12px;line-height:1.5">ECS helps Ethiopian businesses sell and operate online.</td></tr></table></td></tr></table></body></html>`;
}

function interpolate(value: string, variables: Record<string, string>, preserveUnknown: boolean) {
  return value.replace(tokenPattern, (token, name: string) => {
    const replacement = variables[name];
    return replacement === undefined ? (preserveUnknown ? token : "") : replacement;
  });
}

function resolveSafeHref(value: string, variables: Record<string, string>) {
  const interpolated = interpolate(value, variables, false).trim();
  try {
    const parsed = new URL(interpolated);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error();
    return parsed.toString();
  } catch {
    return "https://app.ecs.example";
  }
}

function walkStrings(value: unknown, visit: (value: string) => void) {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => {
      walkStrings(item, visit);
    });
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => {
      walkStrings(item, visit);
    });
  }
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
