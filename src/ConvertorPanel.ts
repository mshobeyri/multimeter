
import * as vscode from 'vscode';

class ConvertorPanel implements vscode.WebviewViewProvider {
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
        <p>This is your custom side panel is.</p>
      </body>
      </html>
    `;
  }
}

export default ConvertorPanel;
