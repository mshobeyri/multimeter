import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

class HistoryPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private httpIcon?: vscode.Uri;
  private wsIcon?: vscode.Uri;
  private grpcIcon?: vscode.Uri;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private async updateHistoryView(view: vscode.WebviewView|undefined) {
    if (!view) {
      return;
    }
    if (!this.httpIcon || !this.wsIcon || !this.grpcIcon) {
      this.httpIcon = view.webview.asWebviewUri(
          vscode.Uri.file(this.context.asAbsolutePath('res/http.svg')));
      this.wsIcon = view.webview.asWebviewUri(
          vscode.Uri.file(this.context.asAbsolutePath('res/websocket.svg')));
      this.grpcIcon = view.webview.asWebviewUri(
          vscode.Uri.file(this.context.asAbsolutePath('res/grpc.svg')));
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
    view.webview.html = this.getHtml(
        this.httpIcon.toString(), this.wsIcon.toString(),
        this.grpcIcon.toString(), history);
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

  getHtml(httpIcon: string, wsIcon: string, grpcIcon: string, history: any[]) {
    // Load HTML template from external file
    const htmlPath =
        path.join(this.context.extensionPath, 'src', 'history.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Replace tokens with actual icon URIs and history data
    html = html.replace(/__HTTP_ICON__/g, httpIcon)
               .replace(/__WS_ICON__/g, wsIcon)
               .replace(/__GRPC_ICON__/g, grpcIcon)
               .replace('__HISTORY_DATA__', JSON.stringify(history));
    return html;
  }
}

export default HistoryPanel;