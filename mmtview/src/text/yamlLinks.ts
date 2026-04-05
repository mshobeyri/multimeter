import { parseYamlDoc } from "mmt-core/markupConvertor";

export type YamlLinkTarget = { path: string; fragment?: string; range: any } | null;

const FILE_EXT_REGEX = /\.(mmt|svg|png|jpg|jpeg|gif|bmp|tiff|webp|csv)$/i;
const MD_REF_REGEX = /\S*\.md\/?#\S*/;

/**
 * Parse the import: block from YAML content and return a map of alias → file path.
 */
function parseImportAliases(content: string): Map<string, string> {
  const imports = new Map<string, string>();
  const lines = content.split('\n');
  let inImport = false;
  let importIndent = -1;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (trimmed === 'import:') {
      inImport = true;
      importIndent = line.length - trimmed.length;
      continue;
    }
    if (inImport) {
      if (trimmed === '' || trimmed.startsWith('#')) {
        continue;
      }
      const currentIndent = line.length - trimmed.length;
      if (currentIndent <= importIndent) {
        inImport = false;
        continue;
      }
      const match = trimmed.match(/^(\w[\w.-]*)\s*:\s*(.+)$/);
      if (match) {
        imports.set(match[1], match[2].trim());
      }
    }
  }
  return imports;
}

export function getFileLinkTargetAtPosition(
  monaco: any,
  model: any,
  content: string,
  pos: any,
): YamlLinkTarget {
  if (!pos || !model) {
    return null;
  }

  const lineNumber = pos.lineNumber;
  const lineContent: string = model.getLineContent(lineNumber);
  if (!lineContent) {
    return null;
  }

  // Detect call: alias and resolve via import: block
  const callMatch = lineContent.match(/^(\s*-?\s*)call\s*:\s*(\S+)/);
  if (callMatch) {
    const alias = callMatch[2];
    const aliasStart = lineContent.indexOf(alias, callMatch[1].length + 4);
    const startColumn = aliasStart + 1; // Monaco columns are 1-based
    const endColumn = startColumn + alias.length;
    if (pos.column >= startColumn && pos.column <= endColumn) {
      const imports = parseImportAliases(content);
      const importPath = imports.get(alias);
      if (importPath) {
        return {
          path: importPath,
          range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
        };
      }
    }
  }

  // Detect bare .md# ref pattern (e.g. description: README.md#section)
  const refMatch = MD_REF_REGEX.exec(lineContent);
  if (refMatch) {
    const refPath = refMatch[0];
    // Strip fragment (#...) when opening the file; also strip trailing slash before #
    const filePath = refPath.replace(/\/?#.*$/, '');
    const hashIdx = refPath.indexOf('#');
    const fragment = hashIdx >= 0 ? refPath.slice(hashIdx + 1) : undefined;
    const startColumn = refMatch.index + 1;
    const endColumn = startColumn + refPath.length;
    if (pos.column >= startColumn && pos.column <= endColumn) {
      return {
        path: filePath,
        fragment,
        range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
      };
    }
  }

  // First try to use Monaco's word detection
  const word = model.getWordAtPosition(pos);
  if (word && FILE_EXT_REGEX.test(word.word)) {
    const path = word.word;
    return {
      path,
      range: new monaco.Range(lineNumber, word.startColumn, lineNumber, word.endColumn),
    };
  }

  // Fallback: scan the line for a quoted or bare value containing a known extension
  const match = findFileLikeValueInLine(lineContent, pos.column);
  if (!match) {
    return null;
  }

  const { value, startColumn, endColumn } = match;
  const trimmed = value.trim();
  if (!FILE_EXT_REGEX.test(trimmed)) {
    return null;
  }

  // Optionally, validate that YAML parses without fatal errors
  try {
    const doc: any = parseYamlDoc(content);
    if (doc && doc.errors && doc.errors.length > 0) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    path: trimmed,
    range: new monaco.Range(lineNumber, startColumn, lineNumber, endColumn),
  };
}

function findFileLikeValueInLine(lineContent: string, cursorColumn: number): {
  value: string;
  startColumn: number;
  endColumn: number;
} | null {
  // Handle list items: "- value" or "- 'value'" / "- \"value\""
  const trimmed = lineContent.trimStart();
  const leadingWhitespaceLength = lineContent.length - trimmed.length;

  if (trimmed.startsWith("- ")) {
    const afterDash = trimmed.slice(2);
    const rawValueMatch = afterDash.match(/^['"]?([^'"#]+?)['"]?\s*(#.*)?$/);
    if (rawValueMatch) {
      const value = rawValueMatch[1];
      const valueIndex = lineContent.indexOf(value, leadingWhitespaceLength + 2);
      if (valueIndex !== -1) {
        const startColumn = valueIndex + 1;
        const endColumn = startColumn + value.length;
        if (cursorColumn >= startColumn && cursorColumn <= endColumn) {
          return { value, startColumn, endColumn };
        }
      }
    }
  }

  // Handle key: value on same line
  const colonIndex = lineContent.indexOf(":");
  if (colonIndex !== -1 && cursorColumn > colonIndex) {
    const afterColon = lineContent.slice(colonIndex + 1);
    const valueMatch = afterColon.match(/['"]?([^'"#]+?)['"]?\s*(#.*)?$/);
    if (valueMatch) {
      const value = valueMatch[1];
      const valueIndex = lineContent.indexOf(value, colonIndex + 1);
      if (valueIndex !== -1) {
        const startColumn = valueIndex + 1;
        const endColumn = startColumn + value.length;
        if (cursorColumn >= startColumn && cursorColumn <= endColumn) {
          return { value, startColumn, endColumn };
        }
      }
    }
  }

  return null;
}
