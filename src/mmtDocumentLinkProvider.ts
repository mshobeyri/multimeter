import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

import {findProjectRootSync} from 'mmt-core/fileHelper';

function findProjectRoot(startPath: string): string | undefined {
  return findProjectRootSync(startPath, fs.existsSync, path.dirname, path.join)
      ?? undefined;
}

function resolveImportPath(basePath: string, importPath: string): string {
  const trimmed = (importPath || '').trim();
  if (trimmed.startsWith('+/')) {
    const root = findProjectRoot(basePath);
    if (!root) {
      return '';
    }
    return path.join(root, trimmed.slice(2));
  }
  return path.resolve(path.dirname(basePath), trimmed);
}

/**
 * Parse the `import:` block from the document text and return a map of alias → file path string.
 */
function parseImports(text: string): Map<string, {path: string; line: number; startCol: number; endCol: number}> {
  const imports = new Map<string, {path: string; line: number; startCol: number; endCol: number}>();
  const lines = text.split('\n');
  let inImport = false;
  let importIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    if (trimmed === 'import:' || trimmed.startsWith('import:')) {
      if (trimmed === 'import:') {
        inImport = true;
        importIndent = line.length - trimmed.length;
        continue;
      }
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
      // Parse "alias: path" or "alias: ./path.mmt"
      const match = trimmed.match(/^(\w[\w.-]*)\s*:\s*(.+)$/);
      if (match) {
        const alias = match[1];
        const filePath = match[2].trim();
        const pathStart = line.indexOf(filePath, line.indexOf(':') + 1);
        imports.set(alias, {
          path: filePath,
          line: i,
          startCol: pathStart,
          endCol: pathStart + filePath.length,
        });
      }
    }
  }
  return imports;
}

/**
 * Find all `call: xxx` occurrences and return their positions and alias name.
 */
function findCallReferences(text: string): Array<{alias: string; line: number; startCol: number; endCol: number}> {
  const refs: Array<{alias: string; line: number; startCol: number; endCol: number}> = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match "call: aliasName" as a YAML key-value — the alias part
    const match = line.match(/^(\s*-?\s*)call\s*:\s*(\S+)/);
    if (match) {
      const alias = match[2];
      const aliasStart = line.indexOf(alias, match[1].length + 4);
      refs.push({
        alias,
        line: i,
        startCol: aliasStart,
        endCol: aliasStart + alias.length,
      });
    }
  }
  return refs;
}

export class MmtDocumentLinkProvider implements vscode.DocumentLinkProvider {
  provideDocumentLinks(
      document: vscode.TextDocument,
      _token: vscode.CancellationToken): vscode.DocumentLink[] {
    const text = document.getText();
    const imports = parseImports(text);
    const callRefs = findCallReferences(text);
    const basePath = document.uri.fsPath;
    const links: vscode.DocumentLink[] = [];

    // Links for call: alias → resolved file
    for (const ref of callRefs) {
      const importEntry = imports.get(ref.alias);
      if (!importEntry) {
        continue;
      }
      const resolved = resolveImportPath(basePath, importEntry.path);
      if (!resolved || !fs.existsSync(resolved)) {
        continue;
      }
      const range = new vscode.Range(ref.line, ref.startCol, ref.line, ref.endCol);
      const link = new vscode.DocumentLink(range, vscode.Uri.file(resolved));
      link.tooltip = importEntry.path;
      links.push(link);
    }

    // Links for import: alias: path → resolved file
    for (const [, entry] of imports) {
      const resolved = resolveImportPath(basePath, entry.path);
      if (!resolved || !fs.existsSync(resolved)) {
        continue;
      }
      const range = new vscode.Range(entry.line, entry.startCol, entry.line, entry.endCol);
      const link = new vscode.DocumentLink(range, vscode.Uri.file(resolved));
      link.tooltip = resolved;
      links.push(link);
    }

    return links;
  }
}
