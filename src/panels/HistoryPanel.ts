import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {buildThemeTokenMessage, MmtTokenColors} from '../themeTokenColors';

class HistoryPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private themeListener?: vscode.Disposable;
  private themeApplyTimer?: NodeJS.Timeout;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Keep listening even before the view is opened so the first reveal is current.
    this.themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      this.scheduleThemeTokenPush();
    });
    context.subscriptions.push(this.themeListener);
  }

  private scheduleThemeTokenPush() {
    if (this.themeApplyTimer) {
      clearTimeout(this.themeApplyTimer);
    }
    // Let workbench.colorTheme / webview theme-id settle (esp. while picker is open).
    this.themeApplyTimer = setTimeout(() => {
      this.themeApplyTimer = undefined;
      this.pushThemeTokens();
    }, 50);
  }

  private pushThemeTokens(preferredThemeId?: string) {
    if (!this._view) {
      return;
    }
    try {
      this._view.webview.postMessage(buildThemeTokenMessage(preferredThemeId));
    } catch {
      // view may be disposed
    }
  }

  private async updateHistoryView(view: vscode.WebviewView|undefined) {
    if (!view) {
      return;
    }
    const historyFile =
        vscode.Uri.joinPath(this.context.globalStorageUri, 'history.json');
    let history: any[] = [];
    try {
      const data = await vscode.workspace.fs.readFile(historyFile);
      history = JSON.parse(Buffer.from(data).toString('utf8'));
    } catch {
      history = [];
    }
    const tokenColors = buildThemeTokenMessage().tokenColors;
    view.webview.html = this.getHtml(history, tokenColors);
    // HTML replace resets JS; push tokens again after the new document is ready.
    setTimeout(() => this.pushThemeTokens(), 0);
  }

  refreshHistory() {
    this.updateHistoryView(this._view);
  }

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken) {
    this._view = webviewView;
    webviewView.webview.options = {enableScripts: true};
    webviewView.webview.onDidReceiveMessage((message) => {
      if (message?.command === 'requestThemeTokens') {
        this.pushThemeTokens(
            typeof message.themeId === 'string' ? message.themeId : undefined);
      }
      if (message?.type === 'refreshHistory') {
        this.refreshHistory();
      }
    });
    this.updateHistoryView(webviewView);
  }

  getHtml(history: any[], tokenColors: MmtTokenColors) {
    const htmlPath =
        path.join(this.context.extensionPath, 'res', 'history.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('__HISTORY_DATA__', JSON.stringify(history));
    html = html.replace(
        '__TOKEN_COLORS__', JSON.stringify(tokenColors).replace(/</g, '\\u003c'));
    return html;
  }
}

export default HistoryPanel;
