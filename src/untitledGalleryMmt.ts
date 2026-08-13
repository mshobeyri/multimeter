import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Open an empty untitled .mmt so the gallery (no-type) UI is shown. */
export async function openUntitledGalleryMmt(
    options?: {onlyIfMissing?: boolean}): Promise<void> {
  if (options?.onlyIfMissing && hasOpenUntitledMmt()) {
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const uri =
      getUniqueUntitledMmtUri(workspaceRoot || process.cwd(), 'untitled.mmt');
  const document = await vscode.workspace.openTextDocument(uri);

  await vscode.languages.setTextDocumentLanguage(document, 'mmt');
  await vscode.commands.executeCommand(
      'vscode.openWith', uri, 'mmt.editor', {preview: false});
}

/** Open an untitled .mmt custom editor prefilled with content. */
export async function openUntitledMmtWithContent(
    content: string,
    options?: {
      suggestedName?: string;
      viewColumn?: vscode.ViewColumn;
    }): Promise<vscode.Uri> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const filename = sanitizeUntitledFilename(options?.suggestedName || 'untitled.mmt');
  const uri =
      getUniqueUntitledMmtUri(workspaceRoot || process.cwd(), filename);
  const document = await vscode.workspace.openTextDocument(uri);
  const text = String(content ?? '');
  if (document.getText() !== text) {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, text);
    await vscode.workspace.applyEdit(edit);
  }
  await vscode.languages.setTextDocumentLanguage(document, 'mmt');
  const viewColumn = options?.viewColumn ?? vscode.ViewColumn.Active;
  await vscode.commands.executeCommand(
      'vscode.openWith', uri, 'mmt.editor', {preview: false, viewColumn});
  return uri;
}

function sanitizeUntitledFilename(name: string): string {
  const base = path.basename(String(name || 'untitled.mmt').trim() || 'untitled.mmt');
  if (base.toLowerCase().endsWith('.mmt')) {
    return base;
  }
  return `${base}.mmt`;
}

function hasOpenUntitledMmt(): boolean {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input;
      if (input instanceof vscode.TabInputCustom &&
          input.viewType === 'mmt.editor' &&
          input.uri.scheme === 'untitled' &&
          input.uri.path.toLowerCase().endsWith('.mmt')) {
        return true;
      }
      if (input instanceof vscode.TabInputText &&
          input.uri.scheme === 'untitled' &&
          input.uri.path.toLowerCase().endsWith('.mmt')) {
        return true;
      }
    }
  }
  return false;
}

function getUniqueUntitledMmtUri(rootDir: string, filename: string): vscode.Uri {
  const extension = path.extname(filename);
  const baseName = path.basename(filename, extension);
  let candidateName = filename;
  let candidatePath = path.join(rootDir, candidateName);
  let counter = 1;

  while (fs.existsSync(candidatePath)) {
    counter += 1;
    candidateName = `${baseName}${counter}${extension}`;
    candidatePath = path.join(rootDir, candidateName);
  }

  return vscode.Uri.from({scheme: 'untitled', path: candidatePath});
}
