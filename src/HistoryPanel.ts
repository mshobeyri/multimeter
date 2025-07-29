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
    try {
      const data = await vscode.workspace.fs.readFile(historyFile);
      const history = JSON.parse(Buffer.from(data).toString('utf8'));
      view.webview.html = this.getHtml(
          this.httpIcon.toString(), this.wsIcon.toString(),
          this.grpcIcon.toString(), history);
    } catch {
      view.webview.html = this.getHtml(
          this.httpIcon.toString(), this.wsIcon.toString(),
          this.grpcIcon.toString(), []);
    }
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
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <link rel="stylesheet" href="https://microsoft.github.io/vscode-codicons/dist/codicon.css">
</head>
<body>
    <div id="history-list"></div>
  <style>
    .history-list { list-style: none; padding: 0; margin: 0; }
    .history-row {
      display: flex;
      align-items: center;
      padding: 6px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.15s;
      font-family: var(--vscode-font-family, monospace);
      font-size: 12px;
      margin-bottom: 2px;
      position: relative;
    }
    .history-row:hover {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }
    .history-icon {
      width: 16px;
      height: 16px;
      margin-right: 8px;
      opacity: 0.9;
      vertical-align: middle;
    }
    .history-title {
      flex: 1;
      color: var(--vscode-list-foreground, #d4d4d4);
      font-size: 12px;
      margin-left: 4px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .history-time {
      font-size: 11px;
      color: #aaa;
      margin-left: 12px;
      min-width: 90px;
      text-align: right;
    }
    .drawer-content {
      background: var(--vscode-editor-background, #23272e);
      border-radius: 0 0 8px 8px;
      margin: 0 0 8px 0;
      padding: 10px 16px;
      font-size: 12px;
      color: var(--vscode-editor-foreground, #d4d4d4);
      border-top: 1px solid #444;
      white-space: pre-wrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      animation: drawerOpen 0.2s;
    }
    @keyframes drawerOpen {
      from { opacity: 0; transform: translateY(-8px);}
      to { opacity: 1; transform: translateY(0);}
    }
    .drawer-arrow {
      margin-right: 6px;
      font-size: 13px;
      color: #888;
      transition: transform 0.2s;
      cursor: pointer;
      user-select: none;
    }
    .drawer-arrow.open {
      transform: rotate(90deg);
      color: #3399ff;
    }
  </style>
  <script>
    const vscode = acquireVsCodeApi();
    const history = ${JSON.stringify(history)};
    let openIdx = null;

    function getTypeIcon(type) {
      return type === 'send'
        ? '<span class="codicon codicon-arrow-up" style="color:#3399ff"></span>'
        : '<span class="codicon codicon-arrow-down" style="color:#66bb6a"></span>';
    }
    function getProtocolIcon(protocol) {
      if (protocol === 'ws') return '<img src="${
        wsIcon}" class="history-icon" />';
      if (protocol === 'grpc') return '<img src="${
        grpcIcon}" class="history-icon" />';
      return '<img src="${httpIcon}" class="history-icon" />';
    }

    function renderHistory() {
      const list = document.getElementById('history-list');
      list.innerHTML =
        '<ul class="history-list">' +
        history.map((item, idx) =>
          '<li>' +
            '<div class="history-row" onclick="toggleDrawer(' + idx + ')">' +
              '<span class="drawer-arrow' + (openIdx === idx ? ' open' : '') + '">&#9654;</span>' +
              getTypeIcon(item.type) +
              getProtocolIcon(item.protocol) +
              '<span class="history-title">' + stripResponse(item.title) + '</span>' +
              '<span class="history-time">' + item.time + '</span>' +
            '</div>' +
            (openIdx === idx
              ? '<div class="drawer-content">' +
                  '<b>' + item.method + '</b>' +
                  '<br>' + item.content.replace(/</g, "&lt;").replace(/>/g, "&gt;") +
                '</div>'
              : '') +
          '</li>'
        ).join('') +
        '</ul>';
    }

    function stripResponse(title) {
      // Remove "Response" from the title if present
      return title.replace(/\\s*Response\\s*$/i, '');
    }

    window.toggleDrawer = function(idx) {
      openIdx = openIdx === idx ? null : idx;
      renderHistory();
    };

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'refreshHistory') {
        vscode.postMessage({ type: 'refreshHistory' });
      }
    });

    window.addEventListener('message', event => {
      const msg = event.data;
      if (msg.command === 'setHistory') {
        window.history = msg.history;
        renderHistory();
      }
    });

    renderHistory();
  </script>
</body>
</html>
    `;
  }
}

export default HistoryPanel;