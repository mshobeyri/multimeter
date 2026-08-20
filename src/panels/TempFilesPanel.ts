import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {formatRelativeTime} from '../tempFiles/tempFileMeta';
import {TempFilesController} from '../tempFiles/tempFilesController';
import {parseTempMmtUri} from '../tempFiles/TempFileStore';
import {TEMP_MMT_SCHEME} from '../tempFiles/tempMmtUri';

export default class TempFilesPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'multimeter.tempFiles';
  private view?: vscode.WebviewView;
  private dirtySignature = '';

  constructor(
      private readonly context: vscode.ExtensionContext,
      private readonly controller: TempFilesController,
  ) {
    context.subscriptions.push(controller.store.onDidChange(() => {
      this.refresh();
    }));
    context.subscriptions.push(
        vscode.window.tabGroups.onDidChangeTabs(() => {
          this.refresh();
        }));
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
          if (event.document.uri.scheme === TEMP_MMT_SCHEME) {
            this.refreshIfDirtyChanged();
          }
        }));
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(document => {
          if (document.uri.scheme === TEMP_MMT_SCHEME) {
            this.refresh();
          }
        }));
  }

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken,
  ): void {
    this.view = webviewView;
    webviewView.webview.options = {enableScripts: true};
    webviewView.webview.html = this.getHtml();
    webviewView.webview.onDidReceiveMessage((message) => {
      void this.handleMessage(message);
    });
    void this.refresh();
  }

  private refreshIfDirtyChanged(): void {
    if (dirtySignature(dirtyTempFileIds()) === this.dirtySignature) {
      return;
    }
    void this.refresh();
  }

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    await this.controller.store.ensureLoaded();
    const dirtyIds = dirtyTempFileIds();
    this.dirtySignature = dirtySignature(dirtyIds);
    this.view.webview.postMessage({
      command: 'setFiles',
      files: this.controller.store.listItems().map(item => ({
        ...item,
        createdLabel: formatRelativeTime(item.createdAt),
        dirty: dirtyIds.has(item.id),
      })),
      activeId: this.controller.activeId(),
    });
  }

  private async handleMessage(message: {command?: string; id?: string}): Promise<void> {
    switch (message?.command) {
      case 'newFile':
        await this.controller.createAndOpen();
        break;
      case 'open':
        if (message.id) {
          await this.controller.open(message.id);
        }
        break;
      case 'pin':
        if (message.id) {
          await this.controller.togglePin(message.id);
        }
        break;
      case 'remove':
        if (message.id) {
          const record = this.controller.store.get(message.id);
          if (record?.archived) {
            await this.controller.remove(message.id);
          } else {
            await this.controller.archive(message.id);
          }
        }
        break;
      case 'unarchive':
        if (message.id) {
          await this.controller.unarchive(message.id);
        }
        break;
      case 'saveAs':
        if (message.id) {
          await this.controller.saveAsFile(message.id);
        }
        break;
      default:
        break;
    }
  }

  private getHtml(): string {
    const htmlPath =
        path.join(this.context.extensionPath, 'res', 'tempFiles.html');
    return fs.readFileSync(htmlPath, 'utf8');
  }
}

function dirtySignature(ids: Set<string>): string {
  return [...ids].sort().join(',');
}

function dirtyTempFileIds(): Set<string> {
  const ids = new Set<string>();
  for (const document of vscode.workspace.textDocuments) {
    if (document.uri.scheme !== TEMP_MMT_SCHEME || !document.isDirty) {
      continue;
    }
    const id = parseTempMmtUri(document.uri)?.id;
    if (id) {
      ids.add(id);
    }
  }
  return ids;
}
