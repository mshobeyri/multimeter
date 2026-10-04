import {reviveDisplayRuntimeTokensInValue} from './bodyRuntimeTokens';
import {isPlainTokenScalar} from './literalToken';
import {detectNewline, joinLines, splitNormalizedLines} from './textLines';

/**
 * Keep the file the user wrote when a resave does not change the parsed model.
 * Dynamic expects (`c:day`, `"xc:not_a_tokeny"`, `> 1700000000`) must not be
 * rewritten just because the UI loaded them.
 */
export function yamlModelsUnchanged(originalJs: unknown, packedJs: unknown): boolean {
  if (originalJs == null || packedJs == null) {
    return false;
  }
  try {
    return JSON.stringify(originalJs) === JSON.stringify(packedJs);
  } catch {
    return false;
  }
}

const PLAIN_KEYWORD_OR_NUMBER =
    /^(?:true|false|null|omit|~|-?(?:0|[1-9]\d*)(?:\.\d+)?)$/i;

function isQuotedScalar(raw: string): boolean {
  const t = raw.trim();
  return (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) ||
      (t.length >= 2 && t.startsWith('\'') && t.endsWith('\''));
}

function unquoteScalar(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (t.startsWith('\'') && t.endsWith('\'')) {
    return t.slice(1, -1).replace(/''/g, '\'');
  }
  return t;
}

/**
 * Same parsed meaning, so `<<c:day>>`, `"{{c:day}}"`, and `c:day` match.
 * `"112"` does not match `112`. Quoted bare `"c:day"` is literal text, so it
 * does not match the live token `c:day`.
 */
export function scalarFingerprint(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return 'empty';
  }
  const quoted = isQuotedScalar(trimmed);
  const inner = unquoteScalar(trimmed);
  if (PLAIN_KEYWORD_OR_NUMBER.test(inner)) {
    return `${quoted ? 'q' : 'p'}:${inner}`;
  }
  // Quoted bare `prefix:name` stays text. Quoted `<< >>` / `{{ }}` still resolve.
  if (quoted && isPlainTokenScalar(inner)) {
    return `lit:${inner}`;
  }
  const revived = reviveDisplayRuntimeTokensInValue(inner);
  const text = typeof revived === 'string' ? revived : JSON.stringify(revived);
  return `t:${text}`;
}

type ScalarParts = {head: string; raw: string; tail: string};

function indexOfUnquotedHash(line: string): number {
  let quote: '"'|'\''|null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === '\\' && quote === '"') {
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '#') {
      return i;
    }
  }
  return -1;
}

function splitScalarLine(line: string): ScalarParts|null {
  const hash = indexOfUnquotedHash(line);
  const code = hash >= 0 ? line.slice(0, hash) : line;
  const comment = hash >= 0 ? line.slice(hash) : '';
  const match = /^(\s*(?:-\s+)?[^:#\n][^:\n]*?:\s+)(\S(?:.*\S)?)\s*$/.exec(code);
  if (!match) {
    return null;
  }
  const raw = match[2];
  if (!raw || /^[|>][+-]?$/.test(raw)) {
    return null;
  }
  const spaces = code.slice(match[1].length + raw.length);
  return {head: match[1], raw, tail: spaces + comment};
}

function scalarQueueKey(head: string): string {
  const match = /^(\s*)(-\s+)?([^:]+):\s+$/.exec(head);
  if (!match) {
    return head;
  }
  return `${match[1].length}|${match[2] ? '-' : ''}|${match[3].trim()}`;
}

/**
 * After a real edit, put back scalar spellings the edit did not change.
 * `<<c:epoch>>`, `"{{c:day}}"`, `"xc:not_a_tokeny"`, and `"!= null"` stay
 * as authored when their parsed value is the same.
 */
export function restoreUnchangedScalarSpellings(packed: string, original: string): string {
  const originalLines = splitNormalizedLines(original);
  const queues = new Map<string, string[]>();
  for (const line of originalLines) {
    const parts = splitScalarLine(line);
    if (!parts) {
      continue;
    }
    const key = scalarQueueKey(parts.head);
    const list = queues.get(key);
    if (list) {
      list.push(parts.raw);
    } else {
      queues.set(key, [parts.raw]);
    }
  }

  const packedLines = splitNormalizedLines(packed);
  let changed = false;
  const next = packedLines.map((line) => {
    const parts = splitScalarLine(line);
    if (!parts) {
      return line;
    }
    const key = scalarQueueKey(parts.head);
    const list = queues.get(key);
    if (!list || list.length === 0) {
      return line;
    }
    const authored = list.shift() as string;
    if (scalarFingerprint(authored) !== scalarFingerprint(parts.raw)) {
      return line;
    }
    if (authored === parts.raw) {
      return line;
    }
    changed = true;
    return parts.head + authored + parts.tail;
  });
  if (!changed) {
    return packed;
  }
  return joinLines(next, detectNewline(packed));
}
