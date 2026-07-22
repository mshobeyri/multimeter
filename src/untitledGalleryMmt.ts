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
