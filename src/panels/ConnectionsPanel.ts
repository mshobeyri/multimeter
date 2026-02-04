import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import {
  ActiveConnection,
  connectionTracker,
  ConnectionEvent,
} from 'mmt-core/networkCoreNode';

class ConnectionsPanel implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private httpIcon?: vscode.Uri;
  private wsIcon?: vscode.Uri;
  private unsubscribe?: () => void;
  private updateTimer?: NodeJS.Timeout;

  constructor(private readonly context: vscode.ExtensionContext) {}

  private updateView() {
    if (!this._view) {
      return;
    }

    const connections = connectionTracker.getAll();
    this._view.webview.postMessage({
      command: 'setConnections',
      connections,
    });
  }

  private setupConnectionTracking() {
    // Subscribe to connection events
    this.unsubscribe = connectionTracker.subscribe((event: ConnectionEvent) => {
      if (!this._view) {
        return;
      }

      switch (event.type) {
        case 'open':
        case 'update':
          this._view.webview.postMessage({
            command: 'updateConnection',
            connection: event.connection,
          });
          break;
        case 'close':
          this._view.webview.postMessage({
            command: 'removeConnection',
            id: event.id,
            closedBy: event.closedBy,
          });
          break;
      }
    });

    // Set up a timer to update "time open" display (every 1 second)
    this.updateTimer = setInterval(() => {
      if (this._view) {
        this._view.webview.postMessage({command: 'tick'});
      }
    }, 1000);
  }

  private handleMessage(message: any) {
    switch (message.command) {
      case 'closeConnection':
        this.closeConnection(message.id);
        break;
      case 'closeAllConnections':
        this.closeAllConnections();
        break;
      case 'refresh':
        this.updateView();
        break;
    }
  }

  private closeConnection(id: string) {
    const conn = connectionTracker.get(id);
    if (conn) {
      connectionTracker.close(id, 'client');
    }
  }

  private closeAllConnections() {
    connectionTracker.closeAll();
  }

  resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken) {
    this._view = webviewView;
    webviewView.webview.options = {enableScripts: true};

    // Set up icons
    this.httpIcon = webviewView.webview.asWebviewUri(
        vscode.Uri.file(this.context.asAbsolutePath('res/http.svg')));
    this.wsIcon = webviewView.webview.asWebviewUri(
        vscode.Uri.file(this.context.asAbsolutePath('res/websocket.svg')));

    // Load HTML
    webviewView.webview.html = this.getHtml();

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage(
        (message) => this.handleMessage(message),
        undefined,
        this.context.subscriptions);

    // Set up connection tracking
    this.setupConnectionTracking();

    // Send initial connections
    this.updateView();

    // Clean up on dispose
    webviewView.onDidDispose(() => {
      if (this.unsubscribe) {
        this.unsubscribe();
      }
      if (this.updateTimer) {
        clearInterval(this.updateTimer);
      }
    });
  }

  getHtml(): string {
    const htmlPath =
        path.join(this.context.extensionPath, 'res', 'connections.html');
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace(/__HTTP_ICON__/g, this.httpIcon?.toString() || '')
               .replace(/__WS_ICON__/g, this.wsIcon?.toString() || '');
    return html;
  }

  refresh() {
    this.updateView();
  }
}

export default ConnectionsPanel;
