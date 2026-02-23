import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {messageRecieved} from './mmtAPI/mmtAPI';

const LAST_VIEW_MODE = 'mmtview:view:selectedViewMode';

export class MmtEditorProvider implements vscode.CustomTextEditorProvider {
  private static instance: MmtEditorProvider|null = null;
  private activeWebviewPanels: Set<vscode.WebviewPanel> = new Set();
  private fileReadTimeouts: Map<vscode.WebviewPanel, NodeJS.Timeout> =
      new Map();
  private diagnostics: vscode.DiagnosticCollection;

  // Static method to get the provider instance
  public static getInstance(): MmtEditorProvider|null {
    return MmtEditorProvider.instance;
  }

  constructor(private readonly context: vscode.ExtensionContext) {
    // Set the static instance when constructor is called
    MmtEditorProvider.instance = this;
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

  private getEditorConfigMessage() {
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
    // Save the view mode
    this.context.globalState.update(LAST_VIEW_MODE, panelId);

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

  // Method to get the last saved view mode
  private getLastViewMode(): 'full'|'ui'|'yaml' {
    return this.context.globalState.get(LAST_VIEW_MODE, 'full');
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
      messageRecieved(message, webviewPanel, document, this);
    });

    vscode.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage({type: 'vscode:changeColorTheme'});
    });
  }

  updateTextDocument(document: vscode.TextDocument, text: string) {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0), document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, text);
    return vscode.workspace.applyEdit(edit);
  }
}

export function getTimeString() {
  const now = new Date();
  return now.toLocaleString();
}
