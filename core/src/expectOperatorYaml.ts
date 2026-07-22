import { opsList } from './TestData';

/**
 * Operators that need quoting in YAML because they start with a character that
 * YAML interprets specially:
 *   `!`  → tag indicator  (value silently loses the operator)
 *   `>`  → block-scalar indicator  (parse error)
 * We pre-quote these inside `expect:` / `debug:` blocks before YAML.parse sees them.
 *
 * Longer operators first so `>=` wins over `>` and `!=` is unambiguous.
 */
const YAML_UNSAFE_OPS = opsList
  .filter(op => op.startsWith('!') || op.startsWith('>'))
  .sort((a, b) => b.length - a.length);

const FUZZY_PERCENT_OP_RE = /^[!](?:0|[1-9][0-9]?|100)%(?:\s|$)/;

/**
 * Map key + value. Keys may include dots, underscores, hyphens, brackets
 * (e.g. `_.status`, `body.items[0]`, `Content-Type`).
 */
const MAP_ENTRY_RE = /^([^:]+?:\s+)(.+)$/;

/**
 * Pre-process raw YAML text to double-quote values whose leading characters would
 * be mangled by the YAML parser:
 * - `expect:` / `debug:` map values and list items (e.g. `status: != 200`)
 * - `operator:` fields on check/assert object forms (e.g. `operator: !=`)
 */
export function quoteExpectOperators(yaml: string): string {
  const lines = yaml.split('\n');
  let inExpect = false;
  let expectIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      continue;
    }
    const indent = line.search(/\S/);

    if (/^\s*(?:expect|debug):\s*$/.test(line)) {
      inExpect = true;
      expectIndent = indent;
      lines[i] = line;
      continue;
    }

    if (inExpect) {
      if (indent <= expectIndent) {
        inExpect = false;
      } else {
        lines[i] = quoteLineIfNeeded(line);
        continue;
      }
    }

    lines[i] = quoteOperatorFieldLine(line);
  }

  return lines.join('\n');
}

const YAML_BANG_UNSAFE_OPS = YAML_UNSAFE_OPS.filter(op => op.startsWith('!'));
const QUOTED_SCALAR_RE = /^"((?:\\.|[^"\\])*)"$/;

/**
 * After YAML.stringify, remove double quotes from `!` operator scalars that our
 * parser accepts unquoted via {@link quoteExpectOperators}. Keeps `>` / `>=`
 * quoted because unquoted block-scalar syntax breaks parsing.
 */
export function emitUnquotedOperators(yaml: string): string {
  const lines = yaml.split('\n');
  let inExpect = false;
  let expectIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      continue;
    }
    const indent = line.search(/\S/);

    if (/^\s*(?:expect|debug):\s*$/.test(line)) {
      inExpect = true;
      expectIndent = indent;
      continue;
    }

    if (inExpect) {
      if (indent <= expectIndent) {
        inExpect = false;
      } else {
        lines[i] = unquoteExpectLineIfNeeded(line);
        continue;
      }
    }

    lines[i] = unquoteOperatorFieldLine(line);
  }

  return lines.join('\n');
}

function unescapeQuotedScalar(value: string): string | undefined {
  const match = value.match(QUOTED_SCALAR_RE);
  if (!match) {
    return undefined;
  }
  return match[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function needsBangOperatorQuoting(value: string): boolean {
  if (/^["']/.test(value)) {
    return false;
  }
  if (FUZZY_PERCENT_OP_RE.test(value)) {
    return true;
  }
  for (const op of YAML_BANG_UNSAFE_OPS) {
    if (value === op || value.startsWith(op + ' ')) {
      return true;
    }
  }
  return false;
}

function canEmitUnquotedExactOperator(value: string): boolean {
  if (/^["']/.test(value)) {
    return false;
  }
  if (EXACT_FUZZY_PERCENT_OP_RE.test(value)) {
    return true;
  }
  return YAML_BANG_UNSAFE_OPS.some(op => op === value);
}

function unquoteExpectLineIfNeeded(line: string): string {
  const trimmed = line.trimStart();
  const leadingWS = line.slice(0, line.length - trimmed.length);

  const mapMatch = trimmed.match(MAP_ENTRY_RE);
  if (mapMatch) {
    const [, prefix, value] = mapMatch;
    const inner = unescapeQuotedScalar(value.trim());
    if (inner !== undefined && needsBangOperatorQuoting(inner)) {
      return leadingWS + prefix + inner;
    }
    return line;
  }

  const arrayMatch = trimmed.match(/^(-\s+)(.+)$/);
  if (arrayMatch) {
    const [, prefix, value] = arrayMatch;
    const inner = unescapeQuotedScalar(value.trim());
    if (inner !== undefined && needsBangOperatorQuoting(inner)) {
      return leadingWS + prefix + inner;
    }
  }
  return line;
}

function unquoteOperatorFieldLine(line: string): string {
  const trimmed = line.trimStart();
  const match = trimmed.match(/^operator:\s+(.+)$/);
  if (!match) {
    return line;
  }
  const rawValue = match[1].trim();
  const inner = unescapeQuotedScalar(rawValue);
  if (inner === undefined || !canEmitUnquotedExactOperator(inner)) {
    return line;
  }
  const leadingWS = line.slice(0, line.length - trimmed.length);
  return leadingWS + 'operator: ' + inner;
}

/** Suppress YAML parse errors on lines that quoteExpectOperators would fix. */
export function filterOperatorYamlErrors(content: string, errors: any[]): any[] {
  if (!errors?.length) {
    return errors;
  }
  const quoted = quoteExpectOperators(content);
  if (quoted === content) {
    return errors;
  }

  const modifiedLines = new Set<number>();
  const origLines = content.split('\n');
  const quotedLines = quoted.split('\n');
  for (let i = 0; i < origLines.length; i++) {
    if (origLines[i] !== quotedLines[i]) {
      modifiedLines.add(i + 1);
    }
  }

  return errors.filter(error => {
    const line = error?.linePos?.[0]?.line;
    return !line || !modifiedLines.has(line);
  });
}

function quoteValue(raw: string): string {
  return '"' + raw.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function needsOperatorQuoting(value: string): boolean {
  if (/^["']/.test(value)) {
    return false;
  }
  if (FUZZY_PERCENT_OP_RE.test(value)) {
    return true;
  }
  for (const op of YAML_UNSAFE_OPS) {
    if (value === op || value.startsWith(op + ' ')) {
      return true;
    }
  }
  return false;
}

const EXACT_FUZZY_PERCENT_OP_RE = /^[!](?:0|[1-9][0-9]?|100)%$/;

function needsExactOperatorQuoting(value: string): boolean {
  if (/^["']/.test(value)) {
    return false;
  }
  if (EXACT_FUZZY_PERCENT_OP_RE.test(value)) {
    return true;
  }
  for (const op of YAML_UNSAFE_OPS) {
    if (value === op) {
      return true;
    }
  }
  return false;
}

function quoteOperatorFieldLine(line: string): string {
  const trimmed = line.trimStart();
  const match = trimmed.match(/^operator:\s+(.+)$/);
  if (!match) {
    return line;
  }
  const rawValue = match[1].trim();
  if (!needsExactOperatorQuoting(rawValue)) {
    return line;
  }
  const leadingWS = line.slice(0, line.length - trimmed.length);
  return leadingWS + 'operator: ' + quoteValue(rawValue);
}

function quoteLineIfNeeded(line: string): string {
  const trimmed = line.trimStart();
  const leadingWS = line.slice(0, line.length - trimmed.length);

  const mapMatch = trimmed.match(MAP_ENTRY_RE);
  if (mapMatch) {
    const [, prefix, value] = mapMatch;
    if (needsOperatorQuoting(value)) {
      return leadingWS + prefix + quoteValue(value);
    }
    return line;
  }

  const arrayMatch = trimmed.match(/^(-\s+)(.+)$/);
  if (arrayMatch) {
    const [, prefix, value] = arrayMatch;
    if (needsOperatorQuoting(value)) {
      return leadingWS + prefix + quoteValue(value);
    }
  }
  return line;
}
