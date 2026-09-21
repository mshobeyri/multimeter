/** Absolute http(s) base for relative assets in an HTML preview. */
export function resolveHtmlPreviewBase(url: string | undefined | null): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined;
    }
    return parsed.href;
  } catch {
    return undefined;
  }
}

/** Inject `<base href>` so relative links resolve against the request URL. */
export function htmlWithBaseHref(html: string, baseHref: string | undefined): string {
  if (!baseHref) {
    return html;
  }
  if (/<base\b/i.test(html)) {
    return html;
  }
  const safeHref = baseHref.replace(/"/g, "%22");
  const tag = `<base href="${safeHref}">`;
  const headMatch = html.match(/<head\b[^>]*>/i);
  if (headMatch && headMatch.index !== undefined) {
    const insertAt = headMatch.index + headMatch[0].length;
    return html.slice(0, insertAt) + tag + html.slice(insertAt);
  }
  const htmlMatch = html.match(/<html\b[^>]*>/i);
  if (htmlMatch && htmlMatch.index !== undefined) {
    const insertAt = htmlMatch.index + htmlMatch[0].length;
    return html.slice(0, insertAt) + tag + html.slice(insertAt);
  }
  return tag + html;
}
