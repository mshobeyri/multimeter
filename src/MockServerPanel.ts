import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import WebSocket = require('ws');

type ServerType = 'http'|'ws';

export default class MockServerPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private serverType: ServerType = 'http';
  private port = 8080;
  private response = '{"message":"Hello"}';
  private running = false;
  private httpServer?: http.Server;
  private wsServer?: WebSocket.Server;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      _context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken) {
    this._view = webviewView;
    webviewView.webview.options = {enableScripts: true};
    this.updateViewHtml();
    webviewView.webview.onDidReceiveMessage(this.handleMessage.bind(this));
  }

  private handleMessage(msg: any) {
    const {type, value} = msg;
    if (type === 'setType' && !this.running) {
      this.serverType = value;
    } else if (type === 'setPort' && !this.running) {
      this.port = Number(value);
    } else if (type === 'setResponse') {
      this.response = value;
    } else if (type === 'startServer') {
      this.startServer();
      this.updateViewHtml();
    } else if (type === 'stopServer') {
      this.stopServer();
      this.updateViewHtml();
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
    const onClosed = () => {
      this.httpServer = undefined;
      this.wsServer = undefined;
      this._doStartServer();
    };
    if (this.httpServer) {
      this.httpServer.close(onClosed);
    } else if (this.wsServer) {
      this.wsServer.close(onClosed);
    } else {
      this._doStartServer();
    }
  }

  private _doStartServer() {
    if (this.serverType === 'http') {
      this.httpServer = http.createServer((_, res) => {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(this.response);
      });
      this.httpServer.listen(this.port, '127.0.0.1', () => {
        this.running = true;
      });
      this.httpServer.on('close', () => (this.running = false));
    } else {
      try {
        this.wsServer = new WebSocket.Server({ port: this.port });
        this.wsServer.on('connection', ws => {
          ws.on('message', () => {
            ws.send(this.response); // Always send the latest response
          });
          // Optionally, send the response immediately on connect as well:
          ws.send(this.response);
        });
        this.wsServer.on('listening', () => (this.running = true));
        this.wsServer.on('close', () => (this.running = false));
      } catch (err) {
        const message = (err instanceof Error) ? err.message : String(err);
        vscode.window.showErrorMessage('WebSocket server could not be started: ' + message);
      }
    }
  }

  private stopServer() {
    console.log('Stopping server...');
    const finalize = () => {
      this.running = false;
      this.updateViewHtml();
    };
    if (this.serverType === 'http' && this.httpServer) {
      this.httpServer.close(() => {
        this.httpServer = undefined;
        finalize();
      });
    } else if (this.serverType === 'ws' && this.wsServer) {
      this.wsServer.close(() => {
        this.wsServer = undefined;
        finalize();
      });
    } else {
      finalize();
    }
  }

  private getHtmlContent(): string {
    const htmlPath =
        path.join(this.context.extensionPath, 'src', 'mockServer.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Replace placeholders with actual values
    html = html.replace(/\${serverType}/g, this.serverType)
               .replace(/\${port}/g, String(this.port))
               .replace(/\${response}/g, this.response)
               .replace(
                   /\${buttonText}/g,
                   this.running ? `Stop localhost:${this.port}` : 'Run')
               .replace(/\${disabled}/g, this.running ? 'disabled' : '');
    return html;
  }
}
