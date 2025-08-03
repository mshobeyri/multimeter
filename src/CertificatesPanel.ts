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
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificates</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 16px;
        }

        .section {
            margin-bottom: 20px;
            padding: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            background-color: var(--vscode-input-background);
        }

        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }

        .section-title {
            font-weight: bold;
            font-size: 14px;
            margin: 0;
        }

        .button {
            padding: 6px 12px;
            font-size: 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 2px;
            cursor: pointer;
        }

        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .button-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .button-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .button-small {
            padding: 2px 6px;
            font-size: 10px;
        }

        .cert-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            margin-bottom: 6px;
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
        }

        .cert-info {
            flex: 1;
        }

        .cert-name {
            font-weight: bold;
            font-size: 12px;
            margin-bottom: 2px;
        }

        .cert-details {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
        }

        .cert-actions {
            display: flex;
            gap: 4px;
            align-items: center;
        }

        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
        }

        .ca-cert-display {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .ca-cert-input {
            flex: 1;
            padding: 4px 8px;
            font-size: 12px;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 2px;
        }

        .empty-state {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            font-style: italic;
        }

        .status-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
        }

        .status-enabled {
            background-color: #28a745;
        }

        .status-disabled {
            background-color: #6c757d;
        }

        .button-group {
            display: flex;
            gap: 4px;
        }
    </style>
</head>
<body>
    <!-- CA Certificate Section -->
    <div class="section">
        <div class="section-header">
            <h3 class="section-title">
                <span id="ca-status-indicator" class="status-indicator status-disabled"></span>
                CA Certificate
            </h3>
            <label class="checkbox-label">
                <input type="checkbox" id="ca-enabled" onchange="toggleCaCert()">
                Enable
            </label>
        </div>
        
        <div class="ca-cert-display">
            <input type="text" id="ca-cert-path" class="ca-cert-input" readonly placeholder="No CA certificate selected">
            <button class="button" onclick="selectCaCertificate()">Browse...</button>
        </div>
    </div>

    <!-- Client Certificates Section -->
    <div class="section">
        <div class="section-header">
            <h3 class="section-title">Client Certificates</h3>
            <button class="button" onclick="addClientCertificate()">➕ Add Certificate</button>
        </div>
        
        <div id="client-certs-container">
            <div id="empty-state" class="empty-state">
                No client certificates configured.<br>
                Click "Add Certificate" to configure your first certificate.
            </div>
        </div>
    </div>

    <!-- SSL Validation Section -->
    <div class="section">
        <label class="checkbox-label">
            <input type="checkbox" id="ssl-validation" onchange="toggleSslValidation()">
            Verify SSL certificates
        </label>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let certificates = { ca: { enabled: false, certPath: '' }, clients: [], sslValidation: true };

        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'updateCertificates') {
                certificates = message.data;
                updateUI();
            }
        });

        function addClientCertificate() {
            vscode.postMessage({ type: 'addClientCertificate' });
        }

        function selectCaCertificate() {
            vscode.postMessage({ type: 'selectCaCertificate' });
        }

        function toggleClientCert(id) {
            vscode.postMessage({ type: 'toggleClientCert', id });
        }

        function toggleCaCert() {
            vscode.postMessage({ type: 'toggleCaCert' });
        }

        function removeClientCert(id) {
            vscode.postMessage({ type: 'removeClientCert', id });
        }

        function editClientCert(cert) {
            vscode.postMessage({ type: 'editClientCert', cert });
        }

        function toggleSslValidation() {
            vscode.postMessage({ type: 'toggleSslValidation' });
        }

        function updateUI() {
            // Update CA certificate
            const caEnabled = document.getElementById('ca-enabled');
            const caCertPath = document.getElementById('ca-cert-path');
            const caStatusIndicator = document.getElementById('ca-status-indicator');
            
            caEnabled.checked = certificates.ca.enabled;
            caCertPath.value = certificates.ca.certPath ? 
                \`📁 \${certificates.ca.certPath.split('/').pop()}\` : 
                'No CA certificate selected';
            
            caStatusIndicator.className = \`status-indicator \${certificates.ca.enabled ? 'status-enabled' : 'status-disabled'}\`;

            // Update SSL validation
            document.getElementById('ssl-validation').checked = certificates.sslValidation;

            // Update client certificates
            const container = document.getElementById('client-certs-container');
            const emptyState = document.getElementById('empty-state');
            
            if (certificates.clients.length === 0) {
                emptyState.style.display = 'block';
                // Remove all cert items
                const certItems = container.querySelectorAll('.cert-item');
                certItems.forEach(item => item.remove());
            } else {
                emptyState.style.display = 'none';
                
                // Clear existing items
                const certItems = container.querySelectorAll('.cert-item');
                certItems.forEach(item => item.remove());
                
                // Add client certificates
                certificates.clients.forEach(cert => {
                    const certDiv = document.createElement('div');
                    certDiv.className = 'cert-item';
                    certDiv.innerHTML = \`
                        <div class="cert-info">
                            <div class="cert-name">
                                <span class="status-indicator \${cert.enabled ? 'status-enabled' : 'status-disabled'}"></span>
                                \${cert.name}
                            </div>
                            <div class="cert-details">\${cert.host} • \${cert.certPath.split('/').pop()}</div>
                        </div>
                        <div class="cert-actions">
                            <label class="checkbox-label">
                                <input type="checkbox" \${cert.enabled ? 'checked' : ''} 
                                       onchange="toggleClientCert('\${cert.id}')">
                                Enabled
                            </label>
                            <div class="button-group">
                                <button class="button button-secondary button-small" 
                                        onclick="editClientCert(\${JSON.stringify(cert).replace(/"/g, '&quot;')})">
                                    ✏️
                                </button>
                                <button class="button button-secondary button-small" 
                                        onclick="removeClientCert('\${cert.id}')">
                                    🗑️
                                </button>
                            </div>
                        </div>
                    \`;
                    container.appendChild(certDiv);
                });
            }
        }

        // Initial refresh
        vscode.postMessage({ type: 'refresh' });
    </script>
</body>
</html>`;
  }
}