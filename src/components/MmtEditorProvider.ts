import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import WebSocket from 'ws';

import {handleNetworkMessage} from './NodeNetwork';

export async function readFileContent(filename: string): Promise<string> {
  try {
    // filename should be a filesystem path here
    const document =
        await vscode.workspace.openTextDocument(vscode.Uri.file(filename));
    return document.getText();
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to read file ${filename}: ${err}`);
    return '';
  }
}

export async function readRelativeFileContent(
    openFilePath: string, relativePath: string): Promise<string> {
  const absolutePath = path.resolve(path.dirname(openFilePath), relativePath);
  return await readFileContent(absolutePath);
}

export class MmtEditorProvider implements vscode.CustomTextEditorProvider {
  private static instance: MmtEditorProvider|null = null;
  private activeWebviewPanels: Set<vscode.WebviewPanel> = new Set();

  // Static method to get the provider instance
  public static getInstance(): MmtEditorProvider|null {
    return MmtEditorProvider.instance;
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  // Method to send message to all active webview panels
  public sendMessageToAllPanels(message: any) {
    this.activeWebviewPanels.forEach(panel => {
      panel.webview.postMessage(message);
    });
  }

  // Method to refresh environment variables in all panels
  public refreshEnvironmentVars() {
    const message = {command: 'multimeter.environment.refresh'};
    this.sendMessageToAllPanels(message);
  }

  public async resolveCustomTextEditor(
      document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel,
      _token: vscode.CancellationToken): Promise<void> {
    // Add this panel to the active panels set
    this.activeWebviewPanels.add(webviewPanel);

    // Remove panel when it's disposed
    webviewPanel.onDidDispose(() => {
      this.activeWebviewPanels.delete(webviewPanel);
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

    // Store active WebSocket connections by uuid
    const wsConnections: Record<string, WebSocket> = {};

    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'ready':
          webviewPanel.webview.postMessage({
            command: 'loadDocument',
            uri: document.uri.toString(),
            content: document.getText(),
            mode: vscode.window.tabGroups.activeTabGroup.activeTab?.input ?
                'normal' :
                'compare',
          });
          break;

        case 'update':
          this.updateTextDocument(document, message.text);
          break;

        case 'updateWorkspaceState':
          this.context.workspaceState.update(message.name, message.value);
          await vscode.commands.executeCommand(
              'multimeter.environment.refresh');
          break;

        case 'loadWorkspaceState':
          const value = this.context.workspaceState.get(message.name, {});
          webviewPanel.webview.postMessage({
            command: 'loadWorkspaceState',
            name: message.name,
            value,
          });
          break;

        case 'getFileContent':
          let contentPromise =
              readRelativeFileContent(document.uri.fsPath, message.filename);
          contentPromise.then(content => {
            webviewPanel.webview.postMessage({command: 'fileContent', content});
          });
          break;

        case 'showErrorMessage':
          vscode.window.showErrorMessage(message.message);
          break;

        case 'showWarningMessage':
          vscode.window.showWarningMessage(message.message);
          break;

        case 'network':
          handleNetworkMessage(message, webviewPanel, wsConnections);
          break;

        case 'addHistory': {
          const historyFile = vscode.Uri.joinPath(
              this.context.globalStorageUri, 'history.json');
          let history: any[] = [];
          try {
            const data = await vscode.workspace.fs.readFile(historyFile);
            history = JSON.parse(Buffer.from(data).toString('utf8'));
          } catch (e) {
            // file may not exist yet
            history = [];
          }
          history.unshift(message.item);
          await vscode.workspace.fs.writeFile(
              historyFile,
              Buffer.from(JSON.stringify(history, null, 2), 'utf8'));
          await vscode.commands.executeCommand('multimeter.history.refresh');
          break;
        }
      }
    });

    vscode.window.onDidChangeActiveColorTheme(() => {
      webviewPanel.webview.postMessage({type: 'vscode:changeColorTheme'});
    });
  }

  private updateTextDocument(document: vscode.TextDocument, text: string) {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
        document.positionAt(0), document.positionAt(document.getText().length));
    edit.replace(document.uri, fullRange, text);
    return vscode.workspace.applyEdit(edit);
  }
}
