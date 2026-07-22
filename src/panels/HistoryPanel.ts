import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

class HistoryPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

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
    view.webview.html = this.getHtml(history);
  }

  refreshHistory() {
    this.updateHistoryView(this._view);
  }

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken) {
    this._view = webviewView;
    webviewView.webview.options = {enableScripts: true};
    this.updateHistoryView(webviewView);
  }

  getHtml(history: any[]) {
    const htmlPath =
        path.join(this.context.extensionPath, 'res', 'history.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace('__HISTORY_DATA__', JSON.stringify(history));
    return html;
  }
}

export default HistoryPanel;
