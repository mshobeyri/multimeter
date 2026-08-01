import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {withNewline} from 'mmt-core/textLines';

import {HistoryManager} from './historyManager';
import {keepMmtEditorSoon} from './keepEditor';
import {messageReceived} from './mmtAPI/mmtAPI';
import {buildThemeTokenMessage} from './themeTokenColors';

export class MmtEditorProvider implements vscode.CustomTextEditorProvider {
  private static instance: MmtEditorProvider|null = null;
  private activeWebviewPanels: Set<vscode.WebviewPanel> = new Set();
  private fileReadTimeouts: Map<vscode.WebviewPanel, NodeJS.Timeout> =
      new Map();
  private diagnostics: vscode.DiagnosticCollection;
  public readonly historyManager: HistoryManager;
  // Tracks pending webview-initiated edits per document URI so that the
  // onDidChangeTextDocument listener can distinguish external changes (undo,
  // revert) from changes the webview itself requested.
  private _webviewEditCount: Map<string, number> = new Map();

  // Static method to get the provider instance
  public static getInstance(): MmtEditorProvider|null {
    return MmtEditorProvider.instance;
  }

  constructor(private readonly context: vscode.ExtensionContext, historyManager: HistoryManager) {
    // Set the static instance when constructor is called
    MmtEditorProvider.instance = this;
    this.historyManager = historyManager;
    this.diagnostics =
        vscode.languages.createDiagnosticCollection('multimeter');
    this.context.subscriptions.push(this.diagnostics);
  }

  // Method to send message to all active webview panels
  public sendMessageToAllPanels(message: any) {
    this.activeWebviewPanels.forEach(panel => {
      panel.webview.postMessage(message);
    });
  }

  public getEditorConfigMessage() {
    try {
      const config = vscode.workspace.getConfiguration('multimeter');
      const bodyAutoFormat = !!config.get<boolean>('body.auto.format');
      const editorFontSize = config.get<number>('editor.fontSize');
      const defaultPanel = config.get<string>('editor.defaultPanel') || 'yaml-ui';
      const collapseDescription = !!config.get<boolean>('editor.collapseDescription');
      return {command: 'config', bodyAutoFormat, editorFontSize, defaultPanel, collapseDescription};
    } catch {
      return {command: 'config', bodyAutoFormat: false, editorFontSize: 12, defaultPanel: 'yaml-ui', collapseDescription: false};
    }
  }

  public broadcastConfig() {
    const message = this.getEditorConfigMessage();
    this.sendMessageToAllPanels(message);
  }

  private postMessageToPanel(
      panel: vscode.WebviewPanel|undefined|null, message: any) {
    if (!panel) {
      return;
    }
    try {
      panel.webview.postMessage(message);
    } catch {
    }
  }

  public refreshEnvironmentVars() {
    const message = {command: 'multimeter.environment.refresh'};
    this.sendMessageToAllPanels(message);
  }

  public showPanel(panelId: 'full'|'ui'|'yaml') {
    const message = {command: 'multimeter.mmt.show.panel', panelId};

    // Prefer sending to the active panel only
    const activePanel =
        Array.from(this.activeWebviewPanels).find(panel => panel.active);
    if (activePanel) {
      this.postMessageToPanel(activePanel, message);
    } else {
      // Fallback to broadcasting when no active panel is found
      this.sendMessageToAllPanels(message);
    }
  }

  public async resolveCustomTextEditor(
      document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel,
      _token: vscode.CancellationToken): Promise<void> {
    // Add this panel to the active panels set
    this.activeWebviewPanels.add(webviewPanel);

    // Remove panel when it's disposed
    webviewPanel.onDidDispose(() => {
      this.activeWebviewPanels.delete(webviewPanel);
      const timeout = this.fileReadTimeouts.get(webviewPanel);
      if (timeout) {
        clearTimeout(timeout);
        this.fileReadTimeouts.delete(webviewPanel);
      }
      this.diagnostics.delete(document.uri);
    });

    webviewPanel.webview.options = {
      enableScripts: true,
    };

    const htmlPath =
        path.join(this.context.extensionPath, 'mmtview', 'build', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const buildPath = path.join(this.context.extensionPath, 'mmtview', 'build');
    const fixUri = (file: string) => webviewPanel.webview.asWebviewUri(
        vscode.Uri.file(path.join(buildPath, file)));
    // Replace all src/href with webview-safe URIs
    let html =
        htmlContent
            .replace(/src="(.+?)"/g, (match, p1) => `src="${fixUri(p1)}"`)
            .replace(/href="(.+?)"/g, (match, p1) => `href="${fixUri(p1)}"`);

    webviewPanel.webview.html = html;
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      messageReceived(message, webviewPanel, document, this);
    });

    // Push current theme token colors as soon as the webview is ready.
    setTimeout(() => {
      try {
        webviewPanel.webview.postMessage(buildThemeTokenMessage());
      } catch {
        // ignore disposed webview
      }
    }, 0);

    // Sync external document changes (undo, revert/discard) back to the
    // webview so it never holds stale content.
    const changeDocumentSubscription =
        vscode.workspace.onDidChangeTextDocument(e => {
          if (e.document.uri.toString() !== document.uri.toString()) {
            return;
          }
          const key = document.uri.toString();
          const count = this._webviewEditCount.get(key) || 0;
          if (count > 0) {
            // This change was initiated by the webview – skip the echo.
            this._webviewEditCount.set(key, count - 1);
            return;
          }
          // External change (undo, revert, etc.) – push new content.
          webviewPanel.webview.postMessage({
            command: 'documentContentChanged',
            uri: document.uri.toString(),
            content: document.getText(),
          });
        });

    const themeListener = vscode.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage(buildThemeTokenMessage());
    });
    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      themeListener.dispose();
    });
  }

  updateTextDocument(document: vscode.TextDocument, text: string) {
    // Monaco / webview always speak LF; VS Code documents on Windows are often
    // CRLF. Convert to the document EOL before compare/replace so we do not
    // full-rewrite on every keystroke (that races echo and jumps the cursor).
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const normalized = withNewline(String(text ?? ''), eol);
    if (document.getText() === normalized) {
      return Promise.resolve(true);
    }
    // UI/YAML edits should keep a preview tab open (same idea as a dirty file).
    keepMmtEditorSoon(document.uri);
    const key = document.uri.toString();
    this._webviewEditCount.set(
        key, (this._webviewEditCount.get(key) || 0) + 1);
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0), document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, normalized);
    return vscode.workspace.applyEdit(edit).then(applied => {
      if (!applied) {
        const current = this._webviewEditCount.get(key) || 0;
        if (current > 0) {
          this._webviewEditCount.set(key, current - 1);
        }
      }
      return applied;
    });
  }
}

export function getTimeString() {
  const now = new Date();
  return now.toLocaleString();
}
