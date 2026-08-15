import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {withNewline} from 'mmt-core/textLines';

import {HistoryManager} from './historyManager';
import {keepMmtEditorSoon} from './keepEditor';
import {messageReceived} from './mmtAPI/mmtAPI';
import {handleRunCurrentDocument} from './mmtAPI/run';
import {buildThemeTokenMessage} from './themeTokenColors';
import {getOnboarding, coachTargetForTask, OnboardingTaskId} from './onboarding';

export class MmtEditorProvider implements vscode.CustomTextEditorProvider {
  private static instance: MmtEditorProvider|null = null;
  private activeWebviewPanels: Set<vscode.WebviewPanel> = new Set();
  private fileReadTimeouts: Map<vscode.WebviewPanel, NodeJS.Timeout> =
      new Map();
  private lastOpened?:
      {document: vscode.TextDocument; panel: vscode.WebviewPanel};
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
    const onboarding = getOnboarding();
    if (onboarding) {
      this.context.subscriptions.push(onboarding.onChange(snapshot => {
        this.syncCoachArrow(snapshot.currentTaskId);
      }));
    }
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

    const activePanel =
        Array.from(this.activeWebviewPanels).find(panel => panel.active);
    if (activePanel) {
      this.postMessageToPanel(activePanel, message);
    } else {
      this.sendMessageToAllPanels(message);
    }
  }

  private syncCoachArrow(taskId: OnboardingTaskId|null): void {
    this.sendMessageToAllPanels({
      command: 'multimeter.coachArrow',
      target: coachTargetForTask(taskId),
    });
  }

  public getLastOpenedUri(): vscode.Uri|undefined {
    return this.lastOpened?.document.uri;
  }

  public async runOpenedDocument(uri: vscode.Uri): Promise<void> {
    const ready = await this.waitForOpened(uri);
    if (!ready || !this.lastOpened) {
      return;
    }
    await handleRunCurrentDocument(
        {command: 'runCurrentDocument'}, this.lastOpened.panel,
        this.lastOpened.document, this);
  }

  public async waitForOpened(uri: vscode.Uri, timeoutMs = 2500): Promise<boolean> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (this.lastOpened &&
          this.lastOpened.document.uri.toString() === uri.toString() &&
          this.activeWebviewPanels.has(this.lastOpened.panel)) {
        await new Promise(resolve => setTimeout(resolve, 350));
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    return false;
  }

  public async resolveCustomTextEditor(
      document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel,
      _token: vscode.CancellationToken): Promise<void> {
    // Add this panel to the active panels set
    this.activeWebviewPanels.add(webviewPanel);
    this.lastOpened = {document, panel: webviewPanel};
    getOnboarding()?.onOpenedMmt();

    // Remove panel when it's disposed
    webviewPanel.onDidDispose(() => {
      this.activeWebviewPanels.delete(webviewPanel);
      if (this.lastOpened?.panel === webviewPanel) {
        this.lastOpened = undefined;
      }
      const timeout = this.fileReadTimeouts.get(webviewPanel);
      if (timeout) {
        clearTimeout(timeout);
        this.fileReadTimeouts.delete(webviewPanel);
      }
      this.diagnostics.delete(document.uri);
    });

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    const htmlPath =
        path.join(this.context.extensionPath, 'mmtview', 'build', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    const buildPath = path.join(this.context.extensionPath, 'mmtview', 'build');
    const fixUri = (file: string) => webviewPanel.webview.asWebviewUri(
        vscode.Uri.file(path.join(buildPath, file)));
    const coachUri = webviewPanel.webview.asWebviewUri(
        vscode.Uri.joinPath(this.context.extensionUri, 'res', 'coachArrow.js'));
    // Replace all src/href with webview-safe URIs
    let html =
        htmlContent
            .replace(/src="(.+?)"/g, (match, p1) => `src="${fixUri(p1)}"`)
            .replace(/href="(.+?)"/g, (match, p1) => `href="${fixUri(p1)}"`)
            .replace('</body>', `<script src="${coachUri}"></script></body>`);

    webviewPanel.webview.html = html;
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      messageReceived(message, webviewPanel, document, this);
    });

    const pushCoach = () => {
      this.syncCoachArrow(getOnboarding()?.snapshot().currentTaskId || null);
    };
    setTimeout(pushCoach, 400);
    setTimeout(pushCoach, 1200);

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

  updateTextDocument(
      document: vscode.TextDocument, text: string,
      origin: 'webview'|'host' = 'webview') {
    // Monaco / webview always speak LF; VS Code documents on Windows are often
    // CRLF. Convert to the document EOL before compare/replace so we do not
    // full-rewrite on every keystroke (that races echo and jumps the cursor).
    const eol = document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    const normalized = withNewline(String(text ?? ''), eol);
    if (document.getText() === normalized) {
      if (origin === 'host') {
        this.syncWebviewDocument(document);
      }
      return Promise.resolve(true);
    }
    // UI/YAML edits should keep a preview tab open (same idea as a dirty file).
    keepMmtEditorSoon(document.uri);
    const key = document.uri.toString();
    if (origin === 'webview') {
      this._webviewEditCount.set(
          key, (this._webviewEditCount.get(key) || 0) + 1);
    }
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0), document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, normalized);
    return vscode.workspace.applyEdit(edit).then(applied => {
      if (!applied && origin === 'webview') {
        const current = this._webviewEditCount.get(key) || 0;
        if (current > 0) {
          this._webviewEditCount.set(key, current - 1);
        }
      }
      if (applied && origin === 'host') {
        this.syncWebviewDocument(document);
      }
      return applied;
    });
  }

  private syncWebviewDocument(document: vscode.TextDocument): void {
    if (!this.lastOpened ||
        this.lastOpened.document.uri.toString() !== document.uri.toString()) {
      return;
    }
    this.lastOpened.panel.webview.postMessage({
      command: 'documentContentChanged',
      uri: document.uri.toString(),
      content: document.getText(),
    });
  }
}

export function getTimeString() {
  const now = new Date();
  return now.toLocaleString();
}
