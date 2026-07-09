import {offsetToLineNumber} from './validator';

export type CompatibilityFix = {
  kind: 'renameYamlKey';
  from: string;
  to: string;
};

export type CompatibilityIssue = {
  id: string;
  message: string;
  line: number;
  column: number;
  endColumn: number;
  applyFix: CompatibilityFix;
};

export type CompatibilityProblem = {
  message: string;
  severity: 'warning';
  category: 'compatibility';
  line: number;
  column: number;
  endColumn: number;
  applyFix: CompatibilityFix;
};

function offsetToColumn(content: string, offset: number): number {
  const pre = content.slice(0, Math.max(0, offset));
  const lastNl = pre.lastIndexOf('\n');
  return lastNl >= 0 ? pre.length - lastNl : pre.length + 1;
}

function findRootYamlKey(content: string, yamlDoc: any, key: string): {line: number; column: number; endColumn: number} | null {
  const rootItems: any[] = Array.isArray(yamlDoc?.contents?.items) ? yamlDoc.contents.items : [];
  const pair = rootItems.find((item) => item?.key?.value === key);
  if (!pair?.key) {
    return null;
  }
  const keyText = String(pair.key.value ?? key);
  const offset = Array.isArray(pair.key.range) && typeof pair.key.range[0] === 'number' ? pair.key.range[0] : undefined;
  if (typeof offset !== 'number') {
    return null;
  }
  const line = offsetToLineNumber(content, offset);
  const column = offsetToColumn(content, offset);
  return {line, column, endColumn: column + keyText.length};
}

function findSuiteTestsDeprecatedIssue(content: string, yamlDoc: any): CompatibilityIssue | null {
  if (!yamlDoc || yamlDoc.errors?.length) {
    return null;
  }
  const rootItems: any[] = Array.isArray(yamlDoc?.contents?.items) ? yamlDoc.contents.items : [];
  const hasItems = rootItems.some((item) => item?.key?.value === 'items');
  if (hasItems) {
    return null;
  }
  const position = findRootYamlKey(content, yamlDoc, 'tests');
  if (!position) {
    return null;
  }
  return {
    id: 'suite-tests-deprecated',
    message: '`tests:` is deprecated. Rename it to `items:`',
    line: position.line,
    column: position.column,
    endColumn: position.endColumn,
    applyFix: {kind: 'renameYamlKey', from: 'tests', to: 'items'},
  };
}

export function findCompatibilityIssues(content: string, yamlDoc: any, docType: string | null): CompatibilityIssue[] {
  if (!docType || !yamlDoc || yamlDoc.errors?.length) {
    return [];
  }
  const issues: CompatibilityIssue[] = [];
  if (docType === 'suite') {
    const suiteIssue = findSuiteTestsDeprecatedIssue(content, yamlDoc);
    if (suiteIssue) {
      issues.push(suiteIssue);
    }
  }
  return issues;
}

export function findCompatibilityProblems(content: string, yamlDoc: any, docType: string | null): CompatibilityProblem[] {
  return findCompatibilityIssues(content, yamlDoc, docType).map((issue) => ({
    message: issue.message,
    severity: 'warning' as const,
    category: 'compatibility' as const,
    line: issue.line,
    column: issue.column,
    endColumn: issue.endColumn,
    applyFix: issue.applyFix,
  }));
}

export function getCompatibilityDecorations(
  monaco: any,
  model: any,
  content: string,
  yamlDoc: any,
  docType: string | null,
  inlineClassName: string
): any[] {
  if (!model || !yamlDoc) {
    return [];
  }
  const issues = findCompatibilityIssues(content, yamlDoc, docType);
  return issues.map((issue) => ({
    range: new monaco.Range(issue.line, issue.column, issue.line, issue.endColumn),
    options: {
      inlineClassName,
      hoverMessage: {value: issue.message},
    },
  }));
}

export function applyRenameYamlKeyOnLine(lineText: string, from: string, to: string): string | null {
  const pattern = new RegExp(`^(\\s*)${from}(\\s*):`);
  if (!pattern.test(lineText)) {
    return null;
  }
  return lineText.replace(pattern, `$1${to}$2:`);
}

export function applyCompatibilityFix(content: string, fix: CompatibilityFix, line: number): string | null {
  if (fix.kind !== 'renameYamlKey') {
    return null;
  }
  const lines = content.split('\n');
  const index = line - 1;
  if (index < 0 || index >= lines.length) {
    return null;
  }
  const nextLine = applyRenameYamlKeyOnLine(lines[index], fix.from, fix.to);
  if (nextLine == null) {
    return null;
  }
  lines[index] = nextLine;
  return lines.join('\n');
}
