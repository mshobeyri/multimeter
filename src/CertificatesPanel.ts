import * as fs from 'fs';
import * as path from 'path';
import {v4 as uuidv4} from 'uuid';
import * as vscode from 'vscode';

interface ClientCertificate {
  id: string;
  name: string;
  host: string;
  certPath: string;
  keyPath: string;
  passphrase: string;
  enabled: boolean;
}

interface CaCertificate {
  enabled: boolean;
  certPath: string;
}

export default class CertificatesPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = 'multimeter.certificates';

  constructor(private readonly context: vscode.ExtensionContext) {}

  public resolveWebviewView(
      webviewView: vscode.WebviewView,
      context: vscode.WebviewViewResolveContext,
      _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.html = this.getHtmlForWebview();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async message => {
      switch (message.type) {
        case 'addClientCertificate':
          await this.addClientCertificate();
          this.refreshWebview(webviewView);
          break;

        case 'selectCaCertificate':
          await this.selectCaCertificate();
          this.refreshWebview(webviewView);
          break;

        case 'toggleClientCert':
          await this.toggleClientCert(message.id);
          this.refreshWebview(webviewView);
          break;

        case 'toggleCaCert':
          await this.toggleCaCert();
          this.refreshWebview(webviewView);
          break;

        case 'removeClientCert':
          await this.removeClientCert(message.id);
          this.refreshWebview(webviewView);
          break;

        case 'editClientCert':
          await this.editClientCert(message.cert);
          this.refreshWebview(webviewView);
          break;

        case 'toggleSslValidation':
          await this.toggleSslValidation();
          this.refreshWebview(webviewView);
          break;

        case 'refresh':
          this.refreshWebview(webviewView);
          break;
      }
    }, undefined, this.context.subscriptions);

    // Listen for configuration changes
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('multimeter.certificates') ||
          event.affectsConfiguration(
              'multimeter.enableCertificateValidation')) {
        this.refreshWebview(webviewView);
      }
    });

    // Initial load
    this.refreshWebview(webviewView);
  }

  private async addClientCertificate() {
    const name = await vscode.window.showInputBox({
      prompt: 'Enter certificate name',
      placeHolder: 'e.g., Production API Certificate'
    });

    if (!name) {
      return;
    }

    const host = await vscode.window.showInputBox({
      prompt: 'Enter host pattern',
      placeHolder: 'e.g., *.api.example.com or api.example.com',
      value: '*'
    });

    if (!host) {
      return;
    }

    // Select certificate file
    const certFile = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {'Certificate files': ['crt', 'pem', 'cer'], 'All files': ['*']},
      openLabel: 'Select Client Certificate'
    });

    if (!certFile || !certFile[0]) {
      return;
    }

    // Select private key file
    const keyFile = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {'Key files': ['key', 'pem'], 'All files': ['*']},
      openLabel: 'Select Private Key'
    });

    if (!keyFile || !keyFile[0]) {
      return;
    }

    const passphrase = await vscode.window.showInputBox({
      prompt: 'Enter passphrase (optional)',
      password: true,
      placeHolder: 'Leave empty if key is not encrypted'
    });

    // Add to configuration
    const config = vscode.workspace.getConfiguration('multimeter');
    const clients = config.get<ClientCertificate[]>('certificates.clients', []);

    const newCert: ClientCertificate = {
      id: uuidv4(),
      name,
      host,
      certPath: certFile[0].fsPath,
      keyPath: keyFile[0].fsPath,
      passphrase: passphrase || '',
      enabled: true
    };

    clients.push(newCert);

    await config.update(
        'certificates.clients', clients, vscode.ConfigurationTarget.Workspace);

    vscode.window.showInformationMessage(
        `Client certificate "${name}" added successfully`);
  }

  private async selectCaCertificate() {
    const fileUri = await vscode.window.showOpenDialog({
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
      filters: {
        'Certificate files': ['ca', 'crt', 'pem', 'cer'],
        'All files': ['*']
      },
      openLabel: 'Select CA Certificate'
    });

    if (fileUri && fileUri[0]) {
      const config = vscode.workspace.getConfiguration('multimeter');
      const caCert:
          CaCertificate = {enabled: true, certPath: fileUri[0].fsPath};

      await config.update(
          'certificates.ca', caCert, vscode.ConfigurationTarget.Workspace);

      vscode.window.showInformationMessage(
          `CA certificate set to: ${path.basename(fileUri[0].fsPath)}`);
    }
  }

  private async toggleClientCert(id: string) {
    const config = vscode.workspace.getConfiguration('multimeter');
    const clients = config.get<ClientCertificate[]>('certificates.clients', []);
    const index = clients.findIndex(c => c.id === id);

    if (index !== -1) {
      clients[index].enabled = !clients[index].enabled;
      await config.update(
          'certificates.clients', clients,
          vscode.ConfigurationTarget.Workspace);
    }
  }

  private async toggleCaCert() {
    const config = vscode.workspace.getConfiguration('multimeter');
    const caCert = config.get<CaCertificate>(
        'certificates.ca', {enabled: false, certPath: ''});

    caCert.enabled = !caCert.enabled;
    await config.update(
        'certificates.ca', caCert, vscode.ConfigurationTarget.Workspace);
  }

  private async removeClientCert(id: string) {
    const config = vscode.workspace.getConfiguration('multimeter');
    const clients = config.get<ClientCertificate[]>('certificates.clients', []);
    const cert = clients.find(c => c.id === id);

    if (cert) {
      const confirm = await vscode.window.showWarningMessage(
          `Remove certificate "${cert.name}"?`, 'Remove');

      if (confirm) {
        const newClients = clients.filter(c => c.id !== id);
        await config.update(
            'certificates.clients', newClients,
            vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(
            `Certificate "${cert.name}" removed`);
      }
    }
  }

  private async editClientCert(cert: ClientCertificate) {
    const newName = await vscode.window.showInputBox(
        {prompt: 'Certificate name', value: cert.name});

    if (!newName) {
      return;
    }

    const newHost = await vscode.window.showInputBox(
        {prompt: 'Host pattern', value: cert.host});

    if (!newHost) {
      return;
    }

    const config = vscode.workspace.getConfiguration('multimeter');
    const clients = config.get<ClientCertificate[]>('certificates.clients', []);
    const index = clients.findIndex(c => c.id === cert.id);

    if (index !== -1) {
      clients[index].name = newName;
      clients[index].host = newHost;
      await config.update(
          'certificates.clients', clients,
          vscode.ConfigurationTarget.Workspace);
      vscode.window.showInformationMessage(`Certificate "${newName}" updated`);
    }
  }

  private async toggleSslValidation() {
    const config = vscode.workspace.getConfiguration('multimeter');
    const current = config.get<boolean>('enableCertificateValidation', true);
    await config.update(
        'enableCertificateValidation', !current,
        vscode.ConfigurationTarget.Workspace);
  }

  private refreshWebview(webviewView: vscode.WebviewView) {
    const config = vscode.workspace.getConfiguration('multimeter');
    const certificates = {
      ca: config.get<CaCertificate>(
          'certificates.ca', {enabled: false, certPath: ''}),
      clients: config.get<ClientCertificate[]>('certificates.clients', []),
      sslValidation: config.get<boolean>('enableCertificateValidation', true)
    };

    webviewView.webview.postMessage(
        {type: 'updateCertificates', data: certificates});
  }

  private getHtmlForWebview(): string {
    const htmlPath = path.join(this.context.extensionPath, 'src', 'certificates.html');
    const cssPath = path.join(this.context.extensionPath, 'src', 'common.css');
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    const css = fs.readFileSync(cssPath, 'utf8');
    
    // Inject CSS into HTML
    html = html.replace('</head>', `<style>${css}</style></head>`);
    
    return html;
  }
}