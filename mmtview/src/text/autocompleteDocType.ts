const TYPE_LINE = /^type:\s*['"]?([A-Za-z]+)['"]?\s*(?:#.*)?$/;

/** Root `type:` value for YAML completions. Ignores comments and leading blank lines. */
export function detectAutocompleteDocType(content: string): string | null {
  for (const raw of String(content ?? '').split(/\r?\n/)) {
    if (raw.search(/\S|$/) !== 0) {
      continue;
    }
    const match = raw.match(TYPE_LINE);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return null;
}
