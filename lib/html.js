/** Lightweight HTML helpers for the service worker (no DOMParser). */

export function stripTags(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

export function matchOne(html, regex) {
  return String(html ?? "").match(regex)?.[1] ?? null;
}

export function extractByClass(html, className) {
  const openRe = new RegExp(
    `<([a-zA-Z0-9]+)([^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)>`,
    "i"
  );
  const open = openRe.exec(html);
  if (!open) return null;

  const tag = open[1];
  const start = open.index + open[0].length;
  const rest = html.slice(start);
  const tokenRe = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "gi");
  let depth = 1;
  let match;

  while ((match = tokenRe.exec(rest))) {
    if (match[0].startsWith("</")) depth -= 1;
    else depth += 1;
    if (depth === 0) return rest.slice(0, match.index);
  }

  return rest.slice(0, 8000);
}

export function extractAllByClass(html, className) {
  const blocks = [];
  const openRe = new RegExp(
    `<([a-zA-Z0-9]+)([^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)>`,
    "gi"
  );
  let open;

  while ((open = openRe.exec(html))) {
    const tag = open[1];
    const start = open.index + open[0].length;
    const rest = html.slice(start);
    const tokenRe = new RegExp(`<${tag}\\b[^>]*>|</${tag}>`, "gi");
    let depth = 1;
    let match;
    let inner = rest.slice(0, 4000);

    while ((match = tokenRe.exec(rest))) {
      if (match[0].startsWith("</")) depth -= 1;
      else depth += 1;
      if (depth === 0) {
        inner = rest.slice(0, match.index);
        break;
      }
    }

    blocks.push(inner);
    openRe.lastIndex = open.index + open[0].length;
  }

  return blocks;
}

export function extractLinks(html) {
  const links = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = re.exec(html))) {
    const href = matchOne(match[1], /href=["']([^"']+)["']/i) ?? "";
    links.push({
      href,
      text: stripTags(match[2]),
      attrs: match[1],
    });
  }

  return links;
}
