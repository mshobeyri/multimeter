/** Max choices before the In/Out picker is hidden (range expansion included). */
export const PARAM_CONSTRAINT_PICKER_MAX = 10;

export interface ParamConstraintOption {
  label: string;
  value: string | number;
}

/**
 * Parse the leading `[...]` block from a param description annotation.
 * Supports comma-separated options and integer ranges like `[1-5]`.
 * Returns undefined when no bracket block, invalid syntax, or too many values.
 */
export function parseBracketConstraintPrefix(text: string): ParamConstraintOption[] | undefined {
  const trimmed = text.trim();
  const match = /^\[([^\]]*)\](?:\s+|$)/.exec(trimmed);
  if (!match) {
    return undefined;
  }
  return parseBracketInner(match[1]);
}

function parseBracketInner(inner: string): ParamConstraintOption[] | undefined {
  const raw = inner.trim();
  if (!raw) {
    return undefined;
  }

  const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(raw);
  if (rangeMatch) {
    const min = Number.parseInt(rangeMatch[1], 10);
    const max = Number.parseInt(rangeMatch[2], 10);
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      return undefined;
    }
    const count = max - min + 1;
    if (count > PARAM_CONSTRAINT_PICKER_MAX) {
      return undefined;
    }
    const values: ParamConstraintOption[] = [];
    for (let i = min; i <= max; i++) {
      values.push({ label: String(i), value: i });
    }
    return values;
  }

  const values = splitBracketList(raw);
  if (!values.length || values.length > PARAM_CONSTRAINT_PICKER_MAX) {
    return undefined;
  }
  return values;
}

/** Split comma-separated list; supports double-quoted tokens. */
function splitBracketList(raw: string): ParamConstraintOption[] {
  if (raw.includes('"')) {
    try {
      const parsed = JSON.parse(`[${raw}]`);
      if (Array.isArray(parsed)) {
        return parsed.map(v => ({ label: String(v), value: typeof v === 'number' ? v : String(v) }));
      }
    } catch {
      // fall through to manual split
    }
  }

  const out: ParamConstraintOption[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      continue;
    }
    if (ch === ',') {
      const piece = current.trim();
      if (piece) {
        out.push(optionFromToken(piece));
      }
      current = '';
      continue;
    }
    current += ch;
  }

  const last = current.trim();
  if (last) {
    out.push(optionFromToken(last));
  }
  return out;
}

function optionFromToken(token: string): ParamConstraintOption {
  const trimmed = token.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const value = Number(trimmed);
    return { label: trimmed, value };
  }
  return { label: trimmed, value: trimmed };
}

/**
 * Extract input field picker options from API/test description annotations (`<<i:name>>`).
 */
export function extractInputConstraintsFromDescription(desc: string): Record<string, ParamConstraintOption[]> {
  const result: Record<string, ParamConstraintOption[]> = {};

  const tryAdd = (name: string, text: string) => {
    if (result[name]) {
      return;
    }
    const values = parseBracketConstraintPrefix(text);
    if (values && values.length > 0) {
      result[name] = values;
    }
  };

  if (!desc) {
    return result;
  }

  desc.replace(/^[ \t]*<<i:(\S+?)>>\s+(.*?)$/gm, (_match, name, text) => {
    tryAdd(name, text);
    return '';
  });

  desc.replace(/\s*<<i:(\S+?)>>\s+(.*?)(?=\s*<<[io]:|\s*$)/g, (_match, name, text) => {
    tryAdd(name, text);
    return '';
  });

  return result;
}
