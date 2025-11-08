import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import WebSocket = require('ws');

type ServerType = 'http' | 'ws';

export default class MockServerPanel implements vscode.WebviewViewProvider,
                                                vscode.Disposable {
  private _view?: vscode.WebviewView;
  private serverType: ServerType = 'http';
  private port = 8080;
  private response: string = `{
  "message": "Hello",
  "from": "Mock Server"
}`;
  private running = false;
  private httpServer?: http.Server;
  private wsServer?: WebSocket.Server;
  private statusCode = 200;
  private reflect = false;
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    this.updateViewHtml();
    const sub = webviewView.webview.onDidReceiveMessage(this.handleMessage.bind(this));
    this.disposables.push(sub);
  }

  private handleMessage(msg: any) {
    const { type, value } = msg;
    switch (type) {
      case 'setType':
        if (!this.running && (value === 'http' || value === 'ws')) {
          this.serverType = value;
          this.updateViewHtml();
        }
        break;
      case 'setPort':
        if (!this.running) {
          const num = Number(value);
            if (!Number.isNaN(num) && num > 0 && num <= 65535) {
              this.port = num;
              this.updateViewHtml();
            }
        }
        break;
      case 'setStatusCode': {
        const num = Number(value);
        if (!Number.isNaN(num) && num >= 100 && num <= 599) {
          this.statusCode = num;
          this.updateViewHtml();
        }
        break;
      }
      case 'setResponse':
        // Preserve custom response always
        this.response = String(value ?? '');
        // Do not re-render here to avoid losing focus/caret while typing
        break;
      case 'setReflect':
        this.reflect = !!value;
        // Webview JS already toggles the textarea disabled state; avoid re-render to preserve focus
        break;
      case 'startServer':
        this.startServer();
        break;
      case 'stopServer':
        this.stopServer();
        break;
    }
  }

  private updateViewHtml() {
    if (!this._view) {
      return;
    }
    this._view.webview.html = this.getHtmlContent();
  }

  private startServer() {
    if (this.running) {
      return;
    }
    // Ensure previous servers are closed before starting
    const finalizeStart = () => this._doStartServer();
    if (this.httpServer) {
      this.httpServer.close(() => {
        this.httpServer = undefined;
        finalizeStart();
      });
    } else if (this.wsServer) {
      this.wsServer.close(() => {
        this.wsServer = undefined;
        finalizeStart();
      });
    } else {
      finalizeStart();
    }
  }

  private _doStartServer() {
    const updateAndNotify = () => {
      this.running = true;
      this.updateViewHtml();
    };
    if (this.serverType === 'http') {
      this.httpServer = http.createServer((req, res) => {
        if (this.reflect) {
          let body = '';
          req.on('data', chunk => (body += chunk));
          req.on('end', () => {
            res.statusCode = this.statusCode;
            res.end(body || JSON.stringify({ headers: req.headers, url: req.url }));
          });
        } else {
          res.statusCode = this.statusCode;
          res.end(this.response);
        }
      });
      this.httpServer.on('listening', updateAndNotify);
      this.httpServer.on('close', () => {
        this.running = false;
        this.updateViewHtml();
      });
      this.httpServer.listen(this.port, '127.0.0.1');
    } else {
      try {
        this.wsServer = new WebSocket.Server({ port: this.port });
        this.wsServer.on('connection', ws => {
          ws.on('message', msg => {
            ws.send(this.reflect ? msg : this.response);
          });
          if (!this.reflect) {
            ws.send(this.response);
          }
        });
        this.wsServer.on('listening', updateAndNotify);
        this.wsServer.on('close', () => {
          this.running = false;
          this.updateViewHtml();
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage('WebSocket server could not be started: ' + message);
      }
    }
  }

  private stopServer() {
    const finalize = () => {
      this.running = false;
      this.updateViewHtml();
    };
    if (this.httpServer) {
      this.httpServer.close(() => {
        this.httpServer = undefined;
        finalize();
      });
    } else if (this.wsServer) {
      const server = this.wsServer;
      try {
        // Politely close all clients first so server can close promptly
        for (const client of server.clients) {
          try {
            // 1001 Going Away
            client.close(1001, 'Server stopping');
          } catch {}
        }
      } catch {}
      // Give clients a moment to close, then close the server
      setTimeout(() => {
        server.close(() => {
          if (this.wsServer === server) {
            this.wsServer = undefined;
          }
          finalize();
        });
      }, 100);
    } else {
      finalize();
    }
  }

  private getHtmlForWebview(
    serverType: string,
    port: number,
    statusCode: number,
    response: string,
    isRunning: boolean,
    reflect: boolean
  ): string {
    const htmlPath = path.join(this.context.extensionPath, 'src', 'panels', 'mockServer.html');
    const cssPath = path.join(this.context.extensionPath, 'src', 'common.css');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');
    html = html.replace('</head>', `<style>${css}</style></head>`);
  const disabled = isRunning ? 'disabled' : '';
  const buttonText = isRunning ? `Stop localhost:${port}` : 'Run Mock Server';
  const buttonIcon = isRunning ? 'codicon codicon-debug-stop' : 'codicon codicon-play';
    const httpSelected = serverType === 'http' ? 'selected' : '';
    const wsSelected = serverType === 'ws' ? 'selected' : '';
    const reflectChecked = reflect ? 'checked' : '';
    const responseDisabled = reflect ? 'disabled' : '';
    return html
      .replace(/\${serverType}/g, serverType)
      .replace(/\${port}/g, port.toString())
      .replace(/\${statusCode}/g, statusCode.toString())
      .replace(/\${response}/g, response)
      .replace(/\${disabled}/g, disabled)
      .replace(/\${buttonText}/g, buttonText)
  .replace(/\${buttonIcon}/g, buttonIcon)
      .replace(/\${httpSelected}/g, httpSelected)
      .replace(/\${wsSelected}/g, wsSelected)
      .replace(/\${reflectChecked}/g, reflectChecked)
      .replace(/\${responseDisabled}/g, responseDisabled)
      .replace(/\${isRunning}/g, String(isRunning));
  }

  private getHtmlContent(): string {
    return this.getHtmlForWebview(
      this.serverType,
      this.port,
      this.statusCode,
      this.response,
      this.running,
      this.reflect
    );
  }

  dispose() {
    this.stopServer();
    for (const d of this.disposables) {
      try { d.dispose(); } catch {}
    }
    this.disposables = [];
  }
}
