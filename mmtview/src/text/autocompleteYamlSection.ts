export interface YamlSectionEntry {
  key: string;
  value: string;
}

export interface ParseYamlSectionOptions {
  /** Only match `section:` at column 0. */
  rootOnly?: boolean;
  /** Skip children that have no value after the colon. */
  requireValue?: boolean;
}

const CHILD_KEY = /^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)$/;

function unquote(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

/** Immediate `key: value` children of the first matching YAML section. */
export function parseYamlSectionEntries(
  content: string,
  sectionKey: string,
  options: ParseYamlSectionOptions = {},
): YamlSectionEntry[] {
  const sectionRe = new RegExp(`^${sectionKey}:\\s*$`);
  const lines = String(content ?? '').split(/\r?\n/);
  let inSection = false;
  let sectionIndent = 0;
  let childIndent: number | null = null;
  const entries: YamlSectionEntry[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();
    if (!inSection) {
      if (sectionRe.test(trimmed) && (!options.rootOnly || indent === 0)) {
        inSection = true;
        sectionIndent = indent;
        childIndent = null;
      }
      continue;
    }
    if (indent <= sectionIndent) {
      break;
    }
    if (childIndent === null) {
      childIndent = indent;
    }
    if (indent !== childIndent) {
      continue;
    }
    const match = trimmed.match(CHILD_KEY);
    if (!match) {
      continue;
    }
    const value = unquote(match[2]);
    if (options.requireValue && !value) {
      continue;
    }
    entries.push({key: match[1], value});
  }
  return entries;
}

export function parseYamlSectionKeys(content: string, sectionKey: string): string[] {
  const keys = parseYamlSectionEntries(content, sectionKey).map((entry) => entry.key);
  return Array.from(new Set(keys)).sort((a, b) => a.localeCompare(b));
}

export function parseYamlSectionMap(
  content: string,
  sectionKey: string,
  options: ParseYamlSectionOptions = {},
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const entry of parseYamlSectionEntries(content, sectionKey, options)) {
    map[entry.key] = entry.value;
  }
  return map;
}
