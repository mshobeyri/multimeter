import {js2xml, xml2js} from 'xml-js';
import {normalizeNewlines} from './textLines';

const HTML_VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

const HTML_RAW_TEXT_ELEMENTS = new Set(['script', 'style']);

/** Indent HTML without requiring well-formed XML (real pages like google.com). */
export function formatHtmlLenient(html: string): string {
  const normalized = normalizeNewlines(html);
  const lines: string[] = [];
  let indent = 0;
  let i = 0;

  const pushLine = (text: string, level = indent) => {
    const trimmed = text.trim();
    if (trimmed) {
      lines.push(`${'  '.repeat(level)}${trimmed}`);
    }
  };

  while (i < normalized.length) {
    if (normalized.slice(i, i + 4) === '<!--') {
      const commentEnd = normalized.indexOf('-->', i + 4);
      if (commentEnd === -1) {
        pushLine(normalized.slice(i));
        break;
      }
      pushLine(normalized.slice(i, commentEnd + 3));
      i = commentEnd + 3;
      continue;
    }

    if (normalized[i] !== '<') {
      const next = normalized.indexOf('<', i);
      const text = normalized.slice(i, next === -1 ? undefined : next);
      pushLine(text);
      i = next === -1 ? normalized.length : next;
      continue;
    }

    const tagEnd = normalized.indexOf('>', i);
    if (tagEnd === -1) {
      pushLine(normalized.slice(i));
      break;
    }

    const tag = normalized.slice(i, tagEnd + 1);
    const tagName = tag.match(/^<\/?([a-zA-Z0-9-]+)/)?.[1]?.toLowerCase();
    const isClosing = tag.startsWith('</');
    const isSelfClosing = /\/>\s*$/.test(tag);
    const isSpecial = tag.startsWith('<!') || tag.startsWith('<?');

    if (!isClosing && tagName && HTML_RAW_TEXT_ELEMENTS.has(tagName)) {
      const closeTag = `</${tagName}>`;
      const closeIdx = normalized.toLowerCase().indexOf(closeTag, tagEnd + 1);
      pushLine(tag);
      if (closeIdx !== -1) {
        pushLine(normalized.slice(tagEnd + 1, closeIdx), indent + 1);
        pushLine(closeTag);
        i = closeIdx + closeTag.length;
        continue;
      }
    }

    if (isClosing && tagName) {
      indent = Math.max(0, indent - 1);
      pushLine(tag);
      i = tagEnd + 1;
      continue;
    }

    pushLine(tag);
    if (!isSelfClosing && !isSpecial && tagName && !HTML_VOID_ELEMENTS.has(tagName)) {
      indent++;
    }
    i = tagEnd + 1;
  }

  return lines.join('\n');
}

function formatHtmlStrict(html: string): string {
  const normalized = normalizeNewlines(html);
  const xmlObj = xml2js(normalized, {compact: true});
  return js2xml(xmlObj, {
    compact: true,
    spaces: 2,
    fullTagEmptyElement: true,
  });
}

/** Pretty-print HTML; strict XML first, then lenient indentation, else unchanged. */
export function formatHtmlBody(html: string): string {
  try {
    return formatHtmlStrict(html);
  } catch {
    try {
      return formatHtmlLenient(html);
    } catch {
      return html;
    }
  }
}
