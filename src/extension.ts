import * as vscode from 'vscode';
import { MmtEditorProvider } from './components/MmtEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(MmtEditorProvider.register(context));

  const showPreviewCommand = vscode.commands.registerCommand('extension.showMmtPreview', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'mmt') {
      vscode.commands.executeCommand('vscode.openWith', editor.document.uri, 'mmt.preview');
    }
  });

  context.subscriptions.push(showPreviewCommand);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'multimeterPanel',
      new MultimeterPanelProvider(context)
    )
  );
}

export function deactivate() {}

class MultimeterPanelProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
    };
    webviewView.webview.html = this.getHtml();
  }

  getHtml() {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <body>
        <h2>Welcome to Multimeter!</h2>
        <p>This is your custom side panel.</p>
      </body>
      </html>
    `;
  }
}
