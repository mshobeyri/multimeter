import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {getOnboarding} from '../onboarding';
import {buildThemeTokenMessage, MmtTokenColors} from '../themeTokenColors';

class HistoryPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private themeListener?: vscode.Disposable;
  private themeApplyTimer?: NodeJS.Timeout;
  /** Last open drawer index restored across HTML rebuilds. */
  private openIdx: number|null = null;

  constructor(private readonly context: vscode.ExtensionContext) {
    // Keep listening even before the view is opened so the first reveal is current.
    this.themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      this.scheduleThemeRefresh();
    });
    context.subscriptions.push(this.themeListener);
  }

  private scheduleThemeRefresh() {
    if (this.themeApplyTimer) {
      clearTimeout(this.themeApplyTimer);
    }
    // Let workbench.colorTheme / webview theme-id settle (esp. while picker is open).
    this.themeApplyTimer = setTimeout(() => {
      this.themeApplyTimer = undefined;
      // Full HTML rebuild is the reliable path: CSS-var postMessage alone was
      // leaving history body/json colors stuck on the previous theme.
      void this.updateHistoryView(this._view);
    }, 100);
  }

  private pushThemeTokens(preferredThemeId?: string, preferredThemeName?: string) {
    if (!this._view) {
      return;
    }
    try {
      this._view.webview.postMessage(
          buildThemeTokenMessage(preferredThemeId, preferredThemeName));
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
    view.webview.html = this.getHtml(history, tokenColors, this.openIdx);
    // After HTML reload, also push tokens (covers late theme-id settlement).
    setTimeout(() => this.pushThemeTokens(), 0);
    setTimeout(() => this.pushThemeTokens(), 250);
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
            typeof message.themeId === 'string' ? message.themeId : undefined,
            typeof message.themeName === 'string' ? message.themeName :
                                                   undefined);
      }
      if (message?.command === 'historyOpenIdx') {
        this.openIdx =
            typeof message.idx === 'number' ? message.idx : null;
      }
      if (message?.type === 'refreshHistory') {
        this.refreshHistory();
      }
    });
    this.updateHistoryView(webviewView);
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        getOnboarding()?.onBottomPanelOpened();
      }
    });
    if (webviewView.visible) {
      getOnboarding()?.onBottomPanelOpened();
    }
  }

  getHtml(history: any[], tokenColors: MmtTokenColors, openIdx: number|null) {
    const htmlPath =
        path.join(this.context.extensionPath, 'res', 'history.html');
    const accentJsPath =
        path.join(this.context.extensionPath, 'res', 'themeAccent.js');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const accentJs = fs.readFileSync(accentJsPath, 'utf8');
    const serverUpSvg = fs.readFileSync(
        path.join(
            this.context.extensionPath, 'res',
            'vscode-codicons_server_up.svg'),
        'utf8');
    const serverDownSvg = fs.readFileSync(
        path.join(
            this.context.extensionPath, 'res',
            'vscode-codicons_server_down.svg'),
        'utf8');
    html = html.replace('__THEME_ACCENT_JS__', accentJs);
    html = html.replace('__HISTORY_DATA__', JSON.stringify(history));
    html = html.replace(
        '__TOKEN_COLORS__', JSON.stringify(tokenColors).replace(/</g, '\\u003c'));
    html = html.replace(
        '__OPEN_IDX__', openIdx === null ? 'null' : String(openIdx));
    html = html.replace('__SERVER_UP_SVG__', JSON.stringify(serverUpSvg));
    html = html.replace('__SERVER_DOWN_SVG__', JSON.stringify(serverDownSvg));
    return html;
  }
}

export default HistoryPanel;
