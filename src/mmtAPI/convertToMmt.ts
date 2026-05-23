import * as vscode from 'vscode';

import {importConvertor} from 'mmt-core';

type ConvertedMmtFile = importConvertor.ConvertedMmtFile;
type CollisionPolicy = 'skip' | 'overwrite' | 'rename';

interface FilePick extends vscode.QuickPickItem {
  file: ConvertedMmtFile;
}

export async function convertUriToMmt(uri?: vscode.Uri): Promise<void> {
  const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
  if (!targetUri) {
    vscode.window.showErrorMessage('Select a Postman, OpenAPI, WSDL, HTTP, or Bruno file to convert.');
    return;
  }

  let result: importConvertor.ConvertToMmtResult;
  try {
    const bytes = await vscode.workspace.fs.readFile(targetUri);
    const rawFile = Buffer.from(bytes).toString('utf8');
    result = importConvertor.convertToMmt(rawFile, {sourcePath: targetUri.fsPath});
  } catch (error) {
    vscode.window.showErrorMessage(formatError(error));
    return;
  }

  if (result.files.length === 0) {
    vscode.window.showWarningMessage('No MMT files were generated from the selected file.');
    return;
  }

  if (result.warnings.length > 0) {
    vscode.window.showWarningMessage(
        `Converted with ${result.warnings.length} warning(s). Review generated files before running them.`);
  }

  const selected = await chooseGeneratedFiles(result.files);
  if (!selected || selected.length === 0) {
    return;
  }

  const folders = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Save converted MMT files here',
  });
  const targetFolder = folders?.[0];
  if (!targetFolder) {
    return;
  }

  const collisionPolicy = await chooseCollisionPolicy(targetFolder, selected);
  if (!collisionPolicy) {
    return;
  }

  const written = await writeConvertedFiles(targetFolder, selected, collisionPolicy);
  if (written.length === 0) {
    vscode.window.showInformationMessage('No files were written.');
    return;
  }

  const choice = await vscode.window.showInformationMessage(
      `Saved ${written.length} MMT file(s) to ${targetFolder.fsPath}.`,
      'Open Folder', 'Open First File');
  if (choice === 'Open Folder') {
    await vscode.commands.executeCommand('revealFileInOS', targetFolder);
  } else if (choice === 'Open First File') {
    await vscode.commands.executeCommand('vscode.openWith', written[0], 'mmt.editor');
  }
}

async function chooseGeneratedFiles(files: ConvertedMmtFile[]): Promise<ConvertedMmtFile[] | undefined> {
  const picks: FilePick[] = files.map(file => ({
    label: file.path,
    description: file.kind,
    detail: file.warnings && file.warnings.length > 0 ? file.warnings.join('\n') : undefined,
    picked: true,
    file,
  }));
  const selected = await vscode.window.showQuickPick(picks, {
    canPickMany: true,
    ignoreFocusOut: true,
    placeHolder: 'Select generated files to save',
    title: 'Convert to MMT',
  });
  return selected?.map(item => item.file);
}

async function chooseCollisionPolicy(targetFolder: vscode.Uri, files: ConvertedMmtFile[]): Promise<CollisionPolicy | undefined> {
  const hasCollision = await hasAnyCollision(targetFolder, files);
  if (!hasCollision) {
    return 'overwrite';
  }
  const choice = await vscode.window.showQuickPick([
    {label: 'Skip existing files', value: 'skip' as CollisionPolicy},
    {label: 'Overwrite existing files', value: 'overwrite' as CollisionPolicy},
    {label: 'Rename new files', value: 'rename' as CollisionPolicy},
  ], {
    ignoreFocusOut: true,
    placeHolder: 'Some generated files already exist. Choose how to continue.',
    title: 'Convert to MMT',
  });
  return choice?.value;
}

async function hasAnyCollision(targetFolder: vscode.Uri, files: ConvertedMmtFile[]): Promise<boolean> {
  for (const file of files) {
    if (await exists(joinConvertedPath(targetFolder, file.path))) {
      return true;
    }
  }
  return false;
}

async function writeConvertedFiles(
    targetFolder: vscode.Uri, files: ConvertedMmtFile[], collisionPolicy: CollisionPolicy): Promise<vscode.Uri[]> {
  const written: vscode.Uri[] = [];
  for (const file of files) {
    let fileUri = joinConvertedPath(targetFolder, file.path);
    if (await exists(fileUri)) {
      if (collisionPolicy === 'skip') {
        continue;
      }
      if (collisionPolicy === 'rename') {
        fileUri = await nextAvailableUri(targetFolder, file.path);
      }
    }
    const parent = parentUri(fileUri);
    if (parent) {
      await vscode.workspace.fs.createDirectory(parent);
    }
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(file.content, 'utf8'));
    written.push(fileUri);
  }
  return written;
}

function joinConvertedPath(targetFolder: vscode.Uri, relativePath: string): vscode.Uri {
  const parts = relativePath.split('/').filter(Boolean);
  return vscode.Uri.joinPath(targetFolder, ...parts);
}

async function nextAvailableUri(targetFolder: vscode.Uri, relativePath: string): Promise<vscode.Uri> {
  const slash = relativePath.lastIndexOf('/');
  const dir = slash >= 0 ? relativePath.slice(0, slash + 1) : '';
  const name = slash >= 0 ? relativePath.slice(slash + 1) : relativePath;
  const dot = name.lastIndexOf('.');
  const base = dot >= 0 ? name.slice(0, dot) : name;
  const ext = dot >= 0 ? name.slice(dot) : '';
  let index = 2;
  while (true) {
    const candidate = joinConvertedPath(targetFolder, `${dir}${base}-${index}${ext}`);
    if (!await exists(candidate)) {
      return candidate;
    }
    index++;
  }
}

function parentUri(uri: vscode.Uri): vscode.Uri | undefined {
  const index = uri.path.lastIndexOf('/');
  if (index <= 0) {
    return undefined;
  }
  return uri.with({path: uri.path.slice(0, index)});
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String((error as any).message) : String(error);
  return message.startsWith('Unsupported import file') ? message : `Failed to convert file: ${message}`;
}
