import * as fs from 'fs';
import {LogLevel} from 'mmt-core/CommonData';
import {runJSCode} from 'mmt-core/jsRunner';
import * as path from 'path';
import * as vscode from 'vscode';

import {handleNetworkMessage} from './vscodeNetwork';

const LAST_VIEW_MODE = 'mmtview:view:selectedViewMode';
export const logOutputChannel =
    vscode.window.createOutputChannel('Multimeter', {log: true});

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

export function logToOutput(level: LogLevel, message: string) {
  switch (level) {
    case 'error':
      logOutputChannel.error(message);
      break;
    case 'warn':
      logOutputChannel.warn(message);
      break;
    case 'info':
      logOutputChannel.info(message);
      break;
  }
  logOutputChannel.show(true);
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

  constructor(private readonly context: vscode.ExtensionContext) {
    // Set the static instance when constructor is called
    MmtEditorProvider.instance = this;
  }

  // Method to send message to all active webview panels
  public sendMessageToAllPanels(message: any) {
    this.activeWebviewPanels.forEach(panel => {
      panel.webview.postMessage(message);
    });
  }

  public refreshEnvironmentVars() {
    const message = {command: 'multimeter.environment.refresh'};
    this.sendMessageToAllPanels(message);
  }

  public showPanel(panelId: 'full'|'ui'|'yaml') {
    // Save the view mode
    this.context.globalState.update(LAST_VIEW_MODE, panelId);

    // Send to all panels
    const message = {command: 'multimeter.mmt.show.panel', panelId};
    this.sendMessageToAllPanels(message);
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
      switch (message.command) {
        case 'ready':
          // Get the last saved view mode
          const lastViewMode = this.getLastViewMode();

          // Send document data to the current panel
          webviewPanel.webview.postMessage({
            command: 'loadDocument',
            uri: document.uri.toString(),
            content: document.getText(),
            mode: vscode.window.tabGroups.activeTabGroup.activeTab?.input ?
                'normal' :
                'compare',
            viewMode: lastViewMode
          });

          // Ensure ALL panels are synchronized to the same view mode
          if (this.activeWebviewPanels.size > 1) {
            this.sendMessageToAllPanels(
                {command: 'multimeter.mmt.show.panel', panelId: lastViewMode});
          }
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
            webviewPanel.webview.postMessage(
                {command: 'fileContent', content, filename: message.filename});
          });
          break;

        case 'openRelativeFile': {
          const absolutePath = path.resolve(
              path.dirname(document.uri.fsPath), message.filename);
          const uri = vscode.Uri.file(absolutePath);
          try {
            // Prefer opening with our custom MMT editor when the file is an .mmt
            if (absolutePath.toLowerCase().endsWith('.mmt')) {
              await vscode.commands.executeCommand(
                  'vscode.openWith', uri, 'mmt.editor', {preview: false});
            } else {
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {preview: false});
            }
          } catch (err) {
            // Fallback to default text editor if custom opening fails
            try {
              const doc = await vscode.workspace.openTextDocument(uri);
              await vscode.window.showTextDocument(doc, {preview: false});
            } catch (e2) {
              vscode.window.showErrorMessage(
                  `Failed to open file ${message.filename}: ${err}`);
            }
          }
          break;
        }

        case 'showPopupMessage':
          switch (message.level) {
            case 'error':
              vscode.window.showErrorMessage(message.message);
              break;
            case 'warning':
              vscode.window.showWarningMessage(message.message);
              break;
            case 'info':
              vscode.window.showInformationMessage(message.message);
              break;
          }
          break;

        case 'logToOutput': {
          logToOutput(message.level, message.message);
          break;
        }

        case 'runJSCode':
          await runJSCode(message.code, message.title, logToOutput);
          break;

        case 'network':
          handleNetworkMessage(message, webviewPanel);
          break;

        case 'addHistory':
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

        case 'multimeter.history.show': {
          await vscode.commands.executeCommand('multimeter.history.show');
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

export function getTimeString() {
  const now = new Date();
  return now.toLocaleString();
}
