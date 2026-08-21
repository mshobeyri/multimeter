import * as path from 'path';
import * as vscode from 'vscode';

import {TempFileStore, parseTempMmtUri} from './TempFileStore';
import {TempMmtFileSystemProvider} from './TempMmtFileSystemProvider';
import {TEMP_MMT_SCHEME} from './tempMmtUri';
import {parseTempFileMeta, sanitizeTempFileName} from './tempFileMeta';

let instance: TempFilesController|undefined;

export function getTempFilesController(): TempFilesController {
  if (!instance) {
    throw new Error('Temp files controller is not initialized');
  }
  return instance;
}

export class TempFilesController {
  readonly store: TempFileStore;
  readonly provider: TempMmtFileSystemProvider;

  constructor(context: vscode.ExtensionContext) {
    this.store = new TempFileStore(context.globalStorageUri);
    this.provider = new TempMmtFileSystemProvider(this.store);
    instance = this;

    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider(
            TEMP_MMT_SCHEME, this.provider,
            {isCaseSensitive: true, isReadonly: false}));

    void this.store.ensureLoaded();
  }

  async createAndOpen(options?: {
    content?: string;
    suggestedName?: string;
    viewColumn?: vscode.ViewColumn;
    onlyIfMissing?: boolean;
  }): Promise<vscode.Uri> {
    await this.store.ensureLoaded();
    if (options?.onlyIfMissing && hasOpenTempMmt()) {
      const openUri = firstOpenTempMmtUri();
      if (openUri) {
        return openUri;
      }
    }
    const record = await this.store.create({
      content: options?.content,
      fileName: options?.suggestedName,
    });
    const uri = vscode.Uri.parse(record.uri);
    this.provider.notifyCreated(uri);
    await vscode.commands.executeCommand(
        'vscode.openWith', uri, 'mmt.editor', {
          preview: false,
          viewColumn: options?.viewColumn ?? vscode.ViewColumn.Active,
        });
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.languages.setTextDocumentLanguage(document, 'mmt');
    } catch {
      // Language mode is best-effort; the custom editor still opens.
    }
    return uri;
  }

  activeId(): string|undefined {
    const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
    const uri = (tab?.input as {uri?: vscode.Uri}|undefined)?.uri;
    if (!uri) {
      return undefined;
    }
    return parseTempMmtUri(uri)?.id;
  }

  async open(id: string): Promise<void> {
    await this.store.ensureLoaded();
    const record = this.store.get(id);
    if (!record) {
      return;
    }
    const uri = vscode.Uri.parse(record.uri);
    await vscode.commands.executeCommand(
        'vscode.openWith', uri, 'mmt.editor', {preview: false});
  }

  async togglePin(id: string): Promise<void> {
    await this.store.ensureLoaded();
    const record = this.store.get(id);
    if (!record) {
      return;
    }
    await this.store.setPinned(id, !record.pinned);
  }

  async archive(id: string): Promise<void> {
    await this.store.ensureLoaded();
    const record = this.store.get(id);
    if (!record) {
      return;
    }
    const uri = vscode.Uri.parse(record.uri);
    await saveOpenDocument(uri);
    await closeTabsForUri(uri);
    await this.store.setArchived(id, true);
  }

  async unarchive(id: string): Promise<void> {
    await this.store.ensureLoaded();
    if (!this.store.get(id)) {
      return;
    }
    await this.store.setArchived(id, false);
  }

  async remove(id: string): Promise<void> {
    await this.store.ensureLoaded();
    const record = this.store.get(id);
    if (!record) {
      return;
    }
    const uri = vscode.Uri.parse(record.uri);
    await saveOpenDocument(uri);
    await closeTabsForUri(uri);
    await this.store.remove(id);
    this.provider.notifyDeleted(uri);
  }

  async saveAsFile(id: string): Promise<void> {
    await this.store.ensureLoaded();
    const record = this.store.get(id);
    if (!record) {
      return;
    }
    const uri = vscode.Uri.parse(record.uri);
    await saveOpenDocument(uri);
    const latest = this.store.get(id) || record;
    const meta = parseTempFileMeta(
        latest.content, latest.fileName.replace(/\.mmt$/i, ''));
    const defaultName = sanitizeTempFileName(meta.title || latest.fileName);
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
    const defaultUri = folder ?
        vscode.Uri.joinPath(folder, defaultName) :
        vscode.Uri.file(path.join(process.cwd(), defaultName));
    const target = await vscode.window.showSaveDialog({
      defaultUri,
      filters: {MMT: ['mmt']},
      saveLabel: 'Save as File',
    });
    if (!target) {
      return;
    }
    await vscode.workspace.fs.writeFile(
        target, Buffer.from(latest.content, 'utf8'));
    await this.remove(id);
    await vscode.commands.executeCommand(
        'vscode.openWith', target, 'mmt.editor', {preview: false});
  }
}

function hasOpenTempMmt(): boolean {
  return firstOpenTempMmtUri() !== undefined;
}

function firstOpenTempMmtUri(): vscode.Uri|undefined {
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      const input = tab.input as {uri?: vscode.Uri}|undefined;
      if (input?.uri?.scheme === TEMP_MMT_SCHEME) {
        return input.uri;
      }
    }
  }
  return undefined;
}

async function saveOpenDocument(uri: vscode.Uri): Promise<void> {
  const document = vscode.workspace.textDocuments.find(
      item => item.uri.toString() === uri.toString());
  if (document?.isDirty) {
    await document.save();
  }
}

async function closeTabsForUri(uri: vscode.Uri): Promise<void> {
  const tabs = vscode.window.tabGroups.all.flatMap(group => group.tabs)
                   .filter(tab => {
                     const input = tab.input as {uri?: vscode.Uri}|undefined;
                     return !!input?.uri &&
                         input.uri.toString() === uri.toString();
                   });
  for (const tab of tabs) {
    await vscode.window.tabGroups.close(tab, true);
  }
}
