import { opsList } from './TestData';

/**
 * Operators that need quoting in YAML because they start with a character that
 * YAML interprets specially:
 *   `!`  → tag indicator  (value silently loses the operator)
 *   `>`  → block-scalar indicator  (parse error)
 * We pre-quote these inside `expect:` blocks before YAML.parse sees them.
 */
const YAML_UNSAFE_OPS = opsList.filter(op => op.startsWith('!') || op.startsWith('>'));

const FUZZY_PERCENT_OP_RE = /^[!](?:0|[1-9][0-9]?|100)%(?:\s|$)/;

/**
 * Pre-process raw YAML text to double-quote `expect:` map values and array
 * items whose leading characters would be mangled by the YAML parser.
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
  }

  return lines.join('\n');
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

function quoteLineIfNeeded(line: string): string {
  const trimmed = line.trimStart();
  const mapMatch = trimmed.match(/^([\w.]+:\s+)(.+)$/);
  if (mapMatch) {
    const [, prefix, value] = mapMatch;
    if (needsOperatorQuoting(value)) {
      const leadingWS = line.slice(0, line.length - trimmed.length);
      return leadingWS + prefix + quoteValue(value);
    }
    return line;
  }
  const arrayMatch = trimmed.match(/^(-\s+)(.+)$/);
  if (arrayMatch) {
    const [, prefix, value] = arrayMatch;
    if (needsOperatorQuoting(value)) {
      const leadingWS = line.slice(0, line.length - trimmed.length);
      return leadingWS + prefix + quoteValue(value);
    }
  }
  return line;
}
