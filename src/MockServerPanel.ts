import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import * as vscode from 'vscode';
import WebSocket = require('ws');

type ServerType = 'http'|'ws';

export default class MockServerPanel implements vscode.WebviewViewProvider, vscode.Disposable {
  private _view?: vscode.WebviewView;
  private serverType: ServerType = 'http';
  private port = 8080;
  private response = `{
  "message": "Hello",
  "from": "Mock Server"
}`;
  private running = false;
  private httpServer?: http.Server;
  private wsServer?: WebSocket.Server;
  private statusCode = 200;

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
    } else if (type === 'setStatusCode') {
      this.statusCode = Number(value);
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
        res.statusCode = this.statusCode;
        res.end(this.response);
      });
      this.httpServer.listen(this.port, '127.0.0.1', () => {
        this.running = true;
      });
      this.httpServer.on('close', () => (this.running = false));
    } else {
      try {
        this.wsServer = new WebSocket.Server({port: this.port});
        this.wsServer.on('connection', ws => {
          ws.on('message', () => {
            ws.send(this.response);
          });
          ws.send(this.response);
        });
        this.wsServer.on('listening', () => (this.running = true));
        this.wsServer.on('close', () => (this.running = false));
      } catch (err) {
        const message = (err instanceof Error) ? err.message : String(err);
        vscode.window.showErrorMessage(
            'WebSocket server could not be started: ' + message);
      }
    }
  }

  private stopServer() {
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

  private getHtmlForWebview(
      serverType: string, port: number, statusCode: number, response: string,
      isRunning: boolean): string {
    const htmlPath =
        path.join(this.context.extensionPath, 'src', 'mockserver.html');
    const cssPath = path.join(this.context.extensionPath, 'src', 'common.css');

    let html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');

    // Inject CSS into HTML head
    html = html.replace('</head>', `<style>${css}</style></head>`);

    const disabled = isRunning ? 'disabled' : '';
    const buttonText = isRunning ? `Stop localhost:${port}` : 'Run Mock Server';

    return html.replace(/\${serverType}/g, serverType)
        .replace(/\${port}/g, port.toString())
        .replace(/\${statusCode}/g, statusCode.toString())
        .replace(/\${response}/g, response)
        .replace(/\${disabled}/g, disabled)
        .replace(/\${buttonText}/g, buttonText);
  }

  private getHtmlContent(): string {
    return this.getHtmlForWebview(
        this.serverType, this.port, this.statusCode, this.response,
        this.running);
  }

  dispose() {
    this.stopServer();
  }
}
