import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

class HistoryPanel implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = { enableScripts: true };
    // Provide webview URIs for icons
    const httpIcon = webviewView.webview.asWebviewUri(
      vscode.Uri.file(this.context.asAbsolutePath('res/http.svg'))
    );
    const wsIcon = webviewView.webview.asWebviewUri(
      vscode.Uri.file(this.context.asAbsolutePath('res/websocket.svg'))
    );
    const grpcIcon = webviewView.webview.asWebviewUri(
      vscode.Uri.file(this.context.asAbsolutePath('res/grpc.svg'))
    );
    webviewView.webview.html = this.getHtml(httpIcon.toString(), wsIcon.toString(), grpcIcon.toString());
    webviewView.webview.onDidReceiveMessage(async (msg) => {
      if (msg.type === 'openHistoryItem') {
        vscode.window.showInformationMessage(
          `Request/Response:\n${msg.title}\n\n${msg.content}`
        );
      }
    });
  }

  getHtml(httpIcon: string, wsIcon: string, grpcIcon: string) {
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
    const history = [
      { type: 'send', method: 'POST', protocol: 'http', title: 'Create User', content: '{ "name": "Alice" }', time: '2025-07-29 10:01:23' },
      { type: 'recv', method: 'POST', protocol: 'http', title: 'Create User Response', content: '{ "id": 1, "name": "Alice" }', time: '2025-07-29 10:01:24' },
      { type: 'send', method: 'GET', protocol: 'http', title: 'Get User', content: 'GET /user/1', time: '2025-07-29 10:02:10' },
      { type: 'recv', method: 'GET', protocol: 'http', title: 'Get User Response', content: '{ "id": 1, "name": "Alice" }', time: '2025-07-29 10:02:11' },
      { type: 'send', method: 'CONNECT', protocol: 'ws', title: 'WebSocket Connect', content: 'ws://example.com', time: '2025-07-29 10:03:00' },
      { type: 'recv', method: 'SEND', protocol: 'ws', title: 'WS Message', content: '{"event":"connected"}', time: '2025-07-29 10:03:01' },
      { type: 'send', method: 'GRPC', protocol: 'grpc', title: 'gRPC Call', content: 'service.User/GetUser', time: '2025-07-29 10:04:00' },
      { type: 'recv', method: 'GRPC', protocol: 'grpc', title: 'gRPC Response', content: '{ "id": 1, "name": "Alice" }', time: '2025-07-29 10:04:01' },
    ];

    let openIdx = null;

    function getTypeIcon(type) {
      return type === 'send'
        ? '<span class="codicon codicon-arrow-up" style="color:#3399ff"></span>'
        : '<span class="codicon codicon-arrow-down" style="color:#66bb6a"></span>';
    }
    function getProtocolIcon(protocol) {
      if (protocol === 'ws') return '<img src="${wsIcon}" class="history-icon" />';
      if (protocol === 'grpc') return '<img src="${grpcIcon}" class="history-icon" />';
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
              '<span class="history-title">' + item.title + '</span>' +
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

    window.toggleDrawer = function(idx) {
      openIdx = openIdx === idx ? null : idx;
      renderHistory();
    };

    renderHistory();
  </script>
</body>
</html>
    `;
  }
}

export default HistoryPanel;