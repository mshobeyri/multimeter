import * as vscode from 'vscode';

class HistoryPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private httpIcon?: vscode.Uri;
  private wsIcon?: vscode.Uri;
  private grpcIcon?: vscode.Uri;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private async updateHistoryView(view: vscode.WebviewView|undefined) {
    if (!view) return;
    if (!this.httpIcon || !this.wsIcon || !this.grpcIcon) {
      this.httpIcon = view.webview.asWebviewUri(
        vscode.Uri.file(this.context.asAbsolutePath('res/http.svg')));
      this.wsIcon = view.webview.asWebviewUri(
        vscode.Uri.file(this.context.asAbsolutePath('res/websocket.svg')));
      this.grpcIcon = view.webview.asWebviewUri(
        vscode.Uri.file(this.context.asAbsolutePath('res/grpc.svg')));
    }
    const historyFile = vscode.Uri.joinPath(this.context.globalStorageUri, 'history.json');
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
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = {enableScripts: true};
    this.updateHistoryView(webviewView);
  }

  getHtml(httpIcon: string, wsIcon: string, grpcIcon: string, history: any[]) {
    // Use placeholder tokens to avoid breaking template literals
    const HTTP_ICON = '__HTTP_ICON__';
    const WS_ICON = '__WS_ICON__';
    const GRPC_ICON = '__GRPC_ICON__';
    let html = `
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
      font-size: 13px;
      color: var(--vscode-editor-foreground, #d4d4d4);
      border-top: 1px solid #444;
      white-space: pre-wrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
      animation: drawerOpen 0.2s;
    }
    .drawer-section {
      margin-bottom: 8px;
    }
    .drawer-label {
      font-weight: bold;
      color: #66bb6a;
      margin-right: 8px;
    }
    .drawer-value {
      color: #d4d4d4;
      font-family: var(--vscode-font-family, monospace);
      word-break: break-all;
    }
    .drawer-table {
      border-collapse: collapse;
      width: 100%;
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .drawer-table th, .drawer-table td {
      border: 1px solid #444;
      padding: 2px 8px;
      font-size: 12px;
      text-align: left;
    }
    .drawer-table th {
      background: #222;
      color: #66bb6a;
      font-weight: bold;
    }
    .drawer-table td {
      background: #23272e;
      color: #d4d4d4;
    }
    .drawer-content pre {
      background: #222;
      color: #d4d4d4;
      padding: 6px;
      border-radius: 4px;
      font-size: 12px;
      margin: 0;
      overflow-x: auto;
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
        : type === 'recv'
        ? '<span class="codicon codicon-arrow-down" style="color:#66bb6a"></span>'
        : '<span class="codicon codicon-error" style="color:#ff5555"></span>';
    }
    function getProtocolIcon(protocol) {
      if (protocol === 'ws') return '<img src="${WS_ICON}" class="history-icon" />';
      if (protocol === 'grpc') return '<img src="${GRPC_ICON}" class="history-icon" />';
      return '<img src="${HTTP_ICON}" class="history-icon" />';
    }

    function renderTable(obj) {
      if (!obj || Object.keys(obj).length === 0) return '';
      return '<table class="drawer-table">' +
        '<tr>' +
        Object.keys(obj).map(function(key) { return '<th>' + key + '</th>'; }).join('') +
        '</tr>' +
        '<tr>' +
        Object.values(obj).map(function(val) { return '<td>' + val + '</td>'; }).join('') +
        '</tr>' +
        '</table>';
    }

    function renderHistory() {
      const list = document.getElementById('history-list');
      list.innerHTML =
        '<ul class="history-list">' +
        history.map(function(item, idx) {
          return '<li>' +
            '<div class="history-row" onclick="toggleDrawer(' + idx + ')">' +
              '<span class="drawer-arrow' + (openIdx === idx ? ' open' : '') + '">&#9654;</span>' +
              getTypeIcon(item.type) +
              getProtocolIcon(item.protocol) +
              '<span class="history-title">' + item.title + '</span>' +
              '<span class="history-time">' + item.time +
                (item.duration ? ' <span style="color:#66bb6a;">(' + item.duration + 'ms)</span>' : '') +
              '</span>' +
            '</div>' +
            (openIdx === idx
              ? '<div class="drawer-content">' +
                  '<div class="drawer-section"><span class="drawer-label">Method:</span> <span class="drawer-value">' + item.method + '</span></div>' +
                  '<div class="drawer-section"><span class="drawer-label">Protocol:</span> <span class="drawer-value">' + item.protocol + '</span></div>' +
                  (item.cookies && Object.keys(item.cookies).length
                    ? '<div class="drawer-section"><span class="drawer-label">Cookies:</span>' + renderTable(item.cookies) + '</div>' : '') +
                  (item.headers && Object.keys(item.headers).length
                    ? '<div class="drawer-section"><span class="drawer-label">Headers:</span>' + renderTable(item.headers) + '</div>' : '') +
                  (item.query && Object.keys(item.query).length
                    ? '<div class="drawer-section"><span class="drawer-label">Query:</span>' + renderTable(item.query) + '</div>' : '') +
                  (item.content
                    ? '<div class="drawer-section"><span class="drawer-label">Content:</span><pre>' + item.content.replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</pre></div>' : '') +
                '</div>'
              : '') +
          '</li>';
        }).join('') +
        '</ul>';
    }

    window.toggleDrawer = function(idx) {
      openIdx = openIdx === idx ? null : idx;
      renderHistory();
    };

    window.addEventListener('message', function(event) {
      const msg = event.data;
      if (msg.command === 'refreshHistory') {
        vscode.postMessage({ type: 'refreshHistory' });
      }
    });

    window.addEventListener('message', function(event) {
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
    // Replace tokens with actual icon URIs
    html = html.replace(/__HTTP_ICON__/g, httpIcon)
               .replace(/__WS_ICON__/g, wsIcon)
               .replace(/__GRPC_ICON__/g, grpcIcon);
    return html;
  }
}

export default HistoryPanel;