import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

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
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider = new MmtEditorProvider(context);
    const providerRegistration =
        vscode.window.registerCustomEditorProvider('mmt.preview', provider);
    return providerRegistration;
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
      document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel,
      _token: vscode.CancellationToken): Promise<void> {
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

    webviewPanel.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case 'ready':
          webviewPanel.webview.postMessage({
            command: 'loadDocument',
            uri: document.uri.toString(),
            content: document.getText(),
          });
          break;
        case 'update':
          this.updateTextDocument(document, message.text);
          break;
        case 'updateWorkspaceState':
          this.context.workspaceState.update(message.name, message.value);
          break;
        case 'loadWorkspaceState':
          const value = this.context.workspaceState.get(message.name, {});
          webviewPanel.webview.postMessage(
              {command: 'loadWorkspaceState', name: message.name, value});
          break;
        case 'getFileContent':
          // Use fsPath for filesystem operations
          let contentPromise =
              readRelativeFileContent(document.uri.fsPath, message.filename);
          contentPromise.then(content => {
            webviewPanel.webview.postMessage({command: 'fileContent', content});
          });
          break;
      }
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
