import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as vscode from 'vscode';
import WebSocket = require('ws');

import {HistoryManager} from '../historyManager';
import {startMockServerFromPath} from '../mmtAPI/mockRunner';

type ServerType = 'http' | 'https' | 'ws' | 'mmt';

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
  private httpsServer?: https.Server;
  private wsServer?: WebSocket.Server;
  private statusCode = 200;
  private reflect = false;
  private cors = false;
  private httpsCertPath: string = '';
  private httpsKeyPath: string = '';
  private httpsClientCaPath: string = '';
  private httpsRequestCert: boolean = false;
  private logHistory: boolean = false;
  private mmtFilePath: string = '';
  private mmtServerCleanup?: () => void;
  private disposables: vscode.Disposable[] = [];

  constructor(
      private readonly context: vscode.ExtensionContext,
      private readonly historyManager: HistoryManager) {}

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
        if (!this.running && (value === 'http' || value === 'https' || value === 'ws' || value === 'mmt')) {
          this.serverType = value;
          this.updateViewHtml();
        }
        break;
      case 'pickHttpsCert':
        if (!this.running) {
          void this.pickHttpsFile('cert');
        }
        break;
      case 'pickHttpsKey':
        if (!this.running) {
          void this.pickHttpsFile('key');
        }
        break;
      case 'pickHttpsClientCa':
        if (!this.running) {
          void this.pickHttpsFile('clientCa');
        }
        break;
      case 'pickMmtServerFile':
        if (!this.running) {
          void this.pickMmtFile();
        }
        break;
      case 'setMmtServerFile':
        if (!this.running) {
          this.mmtFilePath = String(value ?? '');
          void this.context.workspaceState.update(
              'multimeter.mockServer.mmtFilePath', this.mmtFilePath);
          this.updateViewHtml();
        }
        break;
      case 'setHttpsRequestCert':
        if (!this.running) {
          this.httpsRequestCert = !!value;
          void this.context.workspaceState.update(
              'multimeter.mockServer.httpsRequestCert', this.httpsRequestCert);
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
      case 'setCors':
        this.cors = !!value;
        break;
      case 'setLogHistory':
        this.logHistory = !!value;
        void this.context.workspaceState.update(
            'multimeter.mockServer.logHistory', this.logHistory);
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
    } else if (this.httpsServer) {
      this.httpsServer.close(() => {
        this.httpsServer = undefined;
        finalizeStart();
      });
    } else if (this.wsServer) {
      this.wsServer.close(() => {
        this.wsServer = undefined;
        finalizeStart();
      });
    } else if (this.mmtServerCleanup) {
      try {
        this.mmtServerCleanup();
      } catch {
        // ignore
      }
      this.mmtServerCleanup = undefined;
      finalizeStart();
    } else {
      finalizeStart();
    }
  }

  private _doStartServer() {
    const updateAndNotify = () => {
      this.running = true;
      this.updateViewHtml();
    };

    // Handle MMT mock server type
    if (this.serverType === 'mmt') {
      const filePath = this.resolvePathMaybeRelative(this.mmtFilePath);
      if (!filePath) {
        vscode.window.showErrorMessage(
            'MMT Mock Server requires a server file. Use "Choose file…" in the panel.');
        return;
      }
      if (!fs.existsSync(filePath)) {
        vscode.window.showErrorMessage(
            `MMT mock server file not found: ${filePath}`);
        return;
      }

      // Load environment variables from workspace state
      const envStorage = this.context.workspaceState.get<any[]>(
          'multimeter.environment.storage', []);
      const envVars: Record<string, any> = {};
      if (Array.isArray(envStorage)) {
        for (const item of envStorage) {
          if (item && typeof item === 'object' && typeof item.name === 'string' && item.name) {
            envVars[item.name] = item.value;
          }
        }
      }

      startMockServerFromPath(filePath, envVars, () => {
        this.running = false;
        this.mmtServerCleanup = undefined;
        this.updateViewHtml();
      }).then((cleanup) => {
        this.mmtServerCleanup = cleanup;
        updateAndNotify();
        vscode.window.showInformationMessage(`MMT Mock server running from ${path.basename(filePath)}`);
      }).catch((err: any) => {
        vscode.window.showErrorMessage(`MMT Mock server error: ${err?.message || err}`);
      });
      return;
    }

    if (this.serverType === 'http' || this.serverType === 'https') {
      const createHandler = () => (req: http.IncomingMessage, res: http.ServerResponse) => {
        const method = String(req.method || 'GET').toUpperCase();
        const scheme = this.serverType === 'https' ? 'https' : 'http';
        const url = `${scheme}://127.0.0.1:${this.port}${req.url || ''}`;

        const titleBase = `${method} ${url}`;

        // Collect request body, then log incoming request
        let requestBody = '';
        // Handle CORS headers
        if (this.cors) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', '*');
          res.setHeader('Access-Control-Allow-Headers', '*');
          if (method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
          }
        }

        req.on('data', chunk => (requestBody += chunk));
        req.on('end', () => {
          if (this.logHistory) {
            this.historyManager.add({
              type: 'recv',
              method,
              protocol: 'mock',
              serverType: this.serverType,
              title: titleBase,
              headers: req.headers as any,
              query: {},
              cookies: {},
              content: requestBody,
            });
          }

          // Send response
          res.statusCode = this.statusCode;
          let responseBody: string;
          if (this.reflect) {
            responseBody = requestBody || JSON.stringify({ headers: req.headers, url: req.url });
          } else {
            responseBody = this.response;
          }
          res.end(responseBody);

          if (this.logHistory) {
            this.historyManager.add({
              type: this.statusCode >= 400 ? 'error' : 'send',
              method,
              protocol: 'mock',
              serverType: this.serverType,
              title: titleBase,
              headers: {
                'content-type': String(res.getHeader('content-type') || ''),
              },
              cookies: {},
              content: String(responseBody || ''),
              status: this.statusCode,
              duration: -1,
            });
          }
        });
      };

      if (this.serverType === 'http') {
      this.httpServer = http.createServer((req, res) => {
        createHandler()(req, res);
      });
      this.httpServer.on('listening', updateAndNotify);
      this.httpServer.on('close', () => {
        this.running = false;
        this.updateViewHtml();
      });
      this.httpServer.listen(this.port, '127.0.0.1');
        return;
      }

      const certPath = this.resolvePathMaybeRelative(this.httpsCertPath);
      const keyPath = this.resolvePathMaybeRelative(this.httpsKeyPath);
      if (!certPath || !keyPath) {
        vscode.window.showErrorMessage(
            'HTTPS requires a server certificate and key. Use "Choose cert…" and "Choose key…" in the panel.');
        return;
      }
      try {
        const {cert, key, passphrase} = this.loadServerCertificate({certPath, keyPath});
        const httpsOptions: https.ServerOptions = {cert, key, passphrase};
        if (this.httpsRequestCert) {
          const clientCaPath = this.resolvePathMaybeRelative(this.httpsClientCaPath);
          if (!clientCaPath) {
            vscode.window.showErrorMessage(
                'mTLS requires a Client CA certificate. Use "Choose Client CA…" in the panel.');
            return;
          }
          httpsOptions.ca = fs.readFileSync(clientCaPath);
          httpsOptions.requestCert = true;
          httpsOptions.rejectUnauthorized = true;
        }
        this.httpsServer = https.createServer(httpsOptions, createHandler());
        this.httpsServer.on('listening', updateAndNotify);
        this.httpsServer.on('close', () => {
          this.running = false;
          this.updateViewHtml();
        });
        this.httpsServer.listen(this.port, '127.0.0.1');
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage('HTTPS server could not be started: ' + message);
      }
    } else {
      try {
        this.wsServer = new WebSocket.Server({ port: this.port });
        this.wsServer.on('connection', ws => {
          ws.on('message', msg => {
            const msgStr = typeof msg === 'string' ? msg : msg.toString();
            if (this.logHistory) {
              this.historyManager.add({
                type: 'recv',
                method: 'ws',
                protocol: 'mock',
                serverType: 'ws',
                title: `ws://127.0.0.1:${this.port}`,
                headers: {},
                query: {},
                cookies: {},
                content: msgStr,
              });
            }
            const reply = this.reflect ? msg : this.response;
            ws.send(reply);
            if (this.logHistory) {
              this.historyManager.add({
                type: 'send',
                method: 'ws',
                protocol: 'mock',
                serverType: 'ws',
                title: `ws://127.0.0.1:${this.port}`,
                headers: {},
                cookies: {},
                content: typeof reply === 'string' ? reply : reply.toString(),
                duration: -1,
              });
            }
          });
          if (!this.reflect) {
            ws.send(this.response);
            if (this.logHistory) {
              this.historyManager.add({
                type: 'send',
                method: 'ws',
                protocol: 'mock',
                serverType: 'ws',
                title: `ws://127.0.0.1:${this.port}`,
                headers: {},
                cookies: {},
                content: this.response,
                duration: -1,
              });
            }
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
    } else if (this.httpsServer) {
      this.httpsServer.close(() => {
        this.httpsServer = undefined;
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
    } else if (this.mmtServerCleanup) {
      try {
        this.mmtServerCleanup();
      } catch {
        // ignore
      }
      this.mmtServerCleanup = undefined;
      finalize();
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
    reflect: boolean,
    cors: boolean,
    logHistory: boolean,
    httpsCertPath: string,
    httpsKeyPath: string,
    httpsClientCaPath: string,
    httpsRequestCert: boolean,
    mmtFilePath: string
  ): string {
    const htmlPath = path.join(this.context.extensionPath, 'res', 'mockServer.html');
    const cssPath = path.join(this.context.extensionPath, 'res', 'common.css');
    let html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');
    html = html.replace('</head>', `<style>${css}</style></head>`);
  const disabled = isRunning ? 'disabled' : '';
  const buttonText = isRunning ? `Stop localhost:${port}` : 'Run Mock Server';
  const buttonIcon = isRunning ? 'codicon codicon-debug-stop' : 'codicon codicon-play';
    const httpSelected = serverType === 'http' ? 'selected' : '';
    const httpsSelected = serverType === 'https' ? 'selected' : '';
    const wsSelected = serverType === 'ws' ? 'selected' : '';
    const mmtSelected = serverType === 'mmt' ? 'selected' : '';
    const reflectChecked = reflect ? 'checked' : '';
    const corsChecked = cors ? 'checked' : '';
    const logHistoryChecked = logHistory ? 'checked' : '';
    const responseDisabled = reflect ? 'disabled' : '';
    const httpsSectionHidden = serverType === 'https' ? '' : 'hidden';
    const mmtSectionHidden = serverType === 'mmt' ? '' : 'hidden';
    const responseSectionHidden = serverType === 'mmt' ? 'hidden' : '';
    const simpleMockSectionStyle = serverType === 'mmt' ? 'display:none' : '';
    return html
      .replace(/\${serverType}/g, serverType)
      .replace(/\${port}/g, port.toString())
      .replace(/\${statusCode}/g, statusCode.toString())
      .replace(/\${response}/g, response)
      .replace(/\${disabled}/g, disabled)
      .replace(/\${buttonText}/g, buttonText)
  .replace(/\${buttonIcon}/g, buttonIcon)
      .replace(/\${httpSelected}/g, httpSelected)
      .replace(/\${httpsSelected}/g, httpsSelected)
      .replace(/\${wsSelected}/g, wsSelected)
      .replace(/\${mmtSelected}/g, mmtSelected)
      .replace(/\${reflectChecked}/g, reflectChecked)
      .replace(/\${corsChecked}/g, corsChecked)
      .replace(/\${logHistoryChecked}/g, logHistoryChecked)
      .replace(/\${responseDisabled}/g, responseDisabled)
      .replace(/\${isRunning}/g, String(isRunning))
      .replace(/\${httpsSectionHidden}/g, httpsSectionHidden)
      .replace(/\${mmtSectionHidden}/g, mmtSectionHidden)
      .replace(/\${responseSectionHidden}/g, responseSectionHidden)
        .replace(/\${httpsCertPath}/g, httpsCertPath)
        .replace(/\${httpsKeyPath}/g, httpsKeyPath)
        .replace(/\${httpsClientCaPath}/g, httpsClientCaPath)
        .replace(/\${httpsRequestCertChecked}/g, httpsRequestCert ? 'checked' : '')
        .replace(/\${mmtFilePath}/g, mmtFilePath)
        .replace(/\${simpleMockSectionStyle}/g, simpleMockSectionStyle);
  }

  private getHtmlContent(): string {
    // Hydrate from workspaceState so restart doesn't reset selections.
    const storedCertPath = this.context.workspaceState.get<string>(
        'multimeter.mockServer.httpsCertPath', '');
    const storedKeyPath = this.context.workspaceState.get<string>(
        'multimeter.mockServer.httpsKeyPath', '');
    const storedClientCaPath = this.context.workspaceState.get<string>(
        'multimeter.mockServer.httpsClientCaPath', '');
    const storedRequestCert = this.context.workspaceState.get<boolean>(
        'multimeter.mockServer.httpsRequestCert', false);
    const storedLogHistory = this.context.workspaceState.get<boolean>(
        'multimeter.mockServer.logHistory', false);
    const storedMmtFilePath = this.context.workspaceState.get<string>(
        'multimeter.mockServer.mmtFilePath', '');
    if (!this.running) {
      this.httpsCertPath = storedCertPath;
      this.httpsKeyPath = storedKeyPath;
      this.httpsClientCaPath = storedClientCaPath;
      this.httpsRequestCert = storedRequestCert;
      this.mmtFilePath = storedMmtFilePath;
    }
    this.logHistory = storedLogHistory;

    return this.getHtmlForWebview(
      this.serverType,
      this.port,
      this.statusCode,
      this.response,
      this.running,
      this.reflect,
      this.cors,
      this.logHistory,
      this.escapeHtml(this.httpsCertPath),
      this.escapeHtml(this.httpsKeyPath),
      this.escapeHtml(this.httpsClientCaPath),
      this.httpsRequestCert,
      this.escapeHtml(this.mmtFilePath)
    );
  }

  private async pickHttpsFile(kind: 'cert'|'key'|'clientCa') {
    const titles: Record<typeof kind, string> = {
      cert: 'Select HTTPS server certificate',
      key: 'Select HTTPS server key',
      clientCa: 'Select Client CA certificate (for mTLS)'
    };
    const uris = await vscode.window.showOpenDialog({
      title: titles[kind],
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Certificates': ['pem', 'crt', 'cer', 'key'],
        'All files': ['*']
      }
    });
    const uri = uris?.[0];
    if (!uri) {
      return;
    }

    if (kind === 'cert') {
      this.httpsCertPath = uri.fsPath;
      await this.context.workspaceState.update(
          'multimeter.mockServer.httpsCertPath', this.httpsCertPath);
    } else if (kind === 'key') {
      this.httpsKeyPath = uri.fsPath;
      await this.context.workspaceState.update(
          'multimeter.mockServer.httpsKeyPath', this.httpsKeyPath);
    } else {
      this.httpsClientCaPath = uri.fsPath;
      await this.context.workspaceState.update(
          'multimeter.mockServer.httpsClientCaPath', this.httpsClientCaPath);
    }

    this.updateViewHtml();
  }

  private async pickMmtFile() {
    const uris = await vscode.window.showOpenDialog({
      title: 'Select MMT mock server file',
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Multimeter Files': ['mmt'],
        'All files': ['*']
      }
    });
    const uri = uris?.[0];
    if (!uri) {
      return;
    }

    this.mmtFilePath = uri.fsPath;
    await this.context.workspaceState.update(
        'multimeter.mockServer.mmtFilePath', this.mmtFilePath);
    this.updateViewHtml();
  }

  private resolvePathMaybeRelative(pth: string): string {
    if (!pth) {
      return '';
    }
    if (path.isAbsolute(pth)) {
      return pth;
    }
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (ws) {
      return path.resolve(ws.uri.fsPath, pth);
    }
    return pth;
  }

  private loadServerCertificate(selected: {certPath: string; keyPath: string}): {cert: Buffer; key: Buffer; passphrase?: string} {
    const certPath = this.resolvePathMaybeRelative(selected.certPath);
    const keyPath = this.resolvePathMaybeRelative(selected.keyPath);
    const cert = fs.readFileSync(certPath);
    const key = fs.readFileSync(keyPath);
    const passphrase = undefined;
    return {cert, key, passphrase};
  }

  private escapeHtml(input: string): string {
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
  }

  private escapeHtmlAttr(input: string): string {
    return this.escapeHtml(input);
  }

  dispose() {
    this.stopServer();
    for (const d of this.disposables) {
      try { d.dispose(); } catch {}
    }
    this.disposables = [];
  }
}
