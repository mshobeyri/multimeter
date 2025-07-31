import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import * as WebSocket from 'ws';

class MockServerPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private serverType: 'http'|'ws' = 'http';
  private port: number = 8080;
  private response: string = '{"message":"Hello"}';
  private running: boolean = false;
  private httpServer?: http.Server;
  private wsServer?: WebSocket.Server;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private async updateMockServerView(view: vscode.WebviewView|undefined) {
    if (!view) {
      return;
    }
    view.webview.html = this.getHtml();
    // Do NOT add onDidReceiveMessage here!
  }

  private startServer() {
    if (this.running) {
      return;
    }
    // Wait for previous server to close before creating a new one
    if (this.httpServer) {
      this.httpServer.close(() => {
        this.httpServer = undefined;
        this._actuallyStartServer();
      });
      return;
    }
    if (this.wsServer) {
      this.wsServer.close(() => {
        this.wsServer = undefined;
        this._actuallyStartServer();
      });
      return;
    }
    this._actuallyStartServer();
  }

  private _actuallyStartServer() {
    if (this.serverType === 'http') {
      this.httpServer = http.createServer((req, res) => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(this.response);
      });
      this.httpServer.listen(this.port, '127.0.0.1', () => {
        this.running = true;
      });
      this.httpServer.on('close', () => {
        this.running = false;
      });
    } else {
      this.wsServer = new WebSocket.Server({port: this.port});
      this.wsServer.on('connection', ws => {
        ws.send(this.response);
      });
      this.wsServer.on('listening', () => {
        this.running = true;
      });
      this.wsServer.on('close', () => {
        this.running = false;
      });
    }
    this.running = true;
  }

  private stopServer() {
    console.log('Stopping server...');
    if (this.serverType === 'http' && this.httpServer) {
      this.httpServer.close(() => {
        this.httpServer = undefined;
        this.running = false;
      });
      this.refreshMockServer();
    } else if (this.serverType === 'ws' && this.wsServer) {
      this.wsServer.close(() => {
        this.wsServer = undefined;
        this.running = false;
      });
    } else {
      this.running = false;
    }
  }

  refreshMockServer() {
    this.updateMockServerView(this._view);
  }

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken) {
    this._view = webviewView;
    webviewView.webview.options = {enableScripts: true};
    this.updateMockServerView(webviewView);
    webviewView.webview.onDidReceiveMessage(async msg => {
      if (msg.type === 'setType') {
        if (!this.running) {
          this.serverType = msg.value;
          this.updateMockServerView(this._view);
        }
      } else if (msg.type === 'setPort') {
        if (!this.running) {
          this.port = Number(msg.value);
        }
      } else if (msg.type === 'setResponse') {
          this.response = msg.value;
      } else if (msg.type === 'startServer') {
        this.startServer();
        this.updateMockServerView(this._view);
      } else if (msg.type === 'stopServer') {
        this.stopServer();
        this.updateMockServerView(this._view);
      }
    });
  }

  getHtml() {
    return `
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            font-family: var(--vscode-font-family);
            margin: 0;
            padding: 0;
          }
          .mock-container {
            padding: 18px 24px;
            max-width: 480px;
            margin: auto;
          }
          .mock-label {
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            display: block;
          }
          .mock-select, .mock-input, .mock-textarea {
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 14px;
            padding: 6px 8px;
            margin-bottom: 16px;
            width: 100%;
            box-sizing: border-box;
          }
          .mock-select {
            width: 120px;
          }
          .mock-input {
            width: 100px;
          }
          .mock-textarea {
            font-family: var(--vscode-editor-font-family);
            font-size: 12px;
            min-height: 60px;
            resize: vertical;
          }
          .mock-btn {
            background: var(--vscode-button-background, #222);
            border: 1px solid #444;
            border-radius: 6px;
            padding: 14px 0;
            cursor: pointer;
            font-size: 16px bold;
            color: var(--vscode-button-foreground, #d4d4d4);
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%; /* Fill parent width */
            transition: background 0.15s, border-color 0.15s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          }
          .mock-btn:hover {     
            background: var(--vscode-list-hoverBackground, #2a2d2e);
            border-color: #3399ff;
          }
          .mock-divider {
            border-top: 1px solid var(--vscode-panel-border);
            margin: 18px 0;
            opacity: 0.3;
          }
        </style>
      </head>
      <body>
        <div class="mock-container">
          <label class="mock-label" for="serverType">Server Type</label>
          <select id="serverType" class="mock-select" ${
        this.running ? 'disabled' : ''}>
            <option value="http" ${
        this.serverType === 'http' ? 'selected' : ''}>HTTP</option>
            <option value="ws" ${
        this.serverType === 'ws' ? 'selected' : ''}>WebSocket</option>
          </select>
          <label class="mock-label" for="port">Port</label>
          <input id="port" class="mock-input" type="number" min="1" max="65535" value="${
        this.port}" ${this.running ? 'disabled' : ''} />
          <label class="mock-label" for="response">Response</label>
          <textarea id="response" class="mock-textarea" rows="4">${this.response}</textarea>
          <div class="mock-divider"></div>
          <button id="runBtn" class="mock-btn">${
        this.running ? 'Stop localhost:' + this.port : 'Run'}</button>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          document.getElementById('serverType').onchange = e => {
            vscode.postMessage({ type: 'setType', value: e.target.value });
          };
          document.getElementById('port').onchange = e => {
            vscode.postMessage({ type: 'setPort', value: e.target.value });
          };
          document.getElementById('response').onchange = e => {
            vscode.postMessage({ type: 'setResponse', value: e.target.value });
          };
          document.getElementById('runBtn').onclick = () => {
            const runBtn = document.getElementById('runBtn');
            if (runBtn.textContent === 'Run') {
              vscode.postMessage({ type: 'startServer' });
              runBtn.textContent = 'Stop localhost:' + document.getElementById('port').value;
            } else {
              vscode.postMessage({ type: 'stopServer' });
              runBtn.textContent = 'Run';
            }
          };
        </script>
      </body>
      </html>
    `;
  }
}

export default MockServerPanel;