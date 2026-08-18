import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {formatRelativeTime} from '../tempFiles/tempFileMeta';
import {TempFilesController} from '../tempFiles/tempFilesController';

export default class TempFilesPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'multimeter.tempFiles';
  private view?: vscode.WebviewView;

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

  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    await this.controller.store.ensureLoaded();
    this.view.webview.postMessage({
      command: 'setFiles',
      files: this.controller.store.listItems().map(item => ({
        ...item,
        createdLabel: formatRelativeTime(item.createdAt),
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
