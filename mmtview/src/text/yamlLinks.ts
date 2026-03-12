import { parseYamlDoc } from "mmt-core/markupConvertor";

export type YamlLinkTarget = { path: string; range: any } | null;

const FILE_EXT_REGEX = /\.(mmt|svg|png|jpg|jpeg|gif|bmp|tiff|webp|csv)$/i;
const MD_REF_REGEX = /\S*\.md\/?#\S*/;

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

  // Detect bare .md# ref pattern (e.g. description: README.md#section)
  const refMatch = MD_REF_REGEX.exec(lineContent);
  if (refMatch) {
    const refPath = refMatch[0];
    // Strip fragment (#...) when opening the file; also strip trailing slash before #
    const filePath = refPath.replace(/\/?#.*$/, '');
    const startColumn = refMatch.index + 1;
    const endColumn = startColumn + refPath.length;
    if (pos.column >= startColumn && pos.column <= endColumn) {
      return {
        path: filePath,
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
