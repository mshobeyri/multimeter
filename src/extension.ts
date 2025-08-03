import * as fs from 'fs';
import * as path from 'path';
import {v4 as uuidv4} from 'uuid';
import * as vscode from 'vscode';

import {MmtEditorProvider} from './components/MmtEditorProvider';
import ConvertorPanel from './ConvertorPanel';
import HistoryPanel from './HistoryPanel';
import MockServerPanel from './MockServerPanel';
import CertificatesPanel from './CertificatesPanel';

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

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(MmtEditorProvider.register(context));

  const showPreviewCommand =
      vscode.commands.registerCommand('extension.showMmtPreview', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'mmt') {
          vscode.commands.executeCommand(
              'vscode.openWith', editor.document.uri, 'mmt.preview');
        }
      });

  context.subscriptions.push(showPreviewCommand);

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.convertor', new ConvertorPanel(context)));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.mockServer', new MockServerPanel(context)));


  const historyPanel = new HistoryPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeterHistory', historyPanel));

  vscode.commands.registerCommand('multimeter.clearHistory', async () => {
    const historyFile =
        vscode.Uri.joinPath(context.globalStorageUri, 'history.json');
    await vscode.workspace.fs.writeFile(historyFile, Buffer.from('[]', 'utf8'));
    historyPanel.refreshHistory();
  });

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.refreshHistory', () => {
        historyPanel.refreshHistory();
      }));


  const certificatesPanel = new CertificatesPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.certificates', certificatesPanel));

  // Add Client Certificate Command
  const addClientCertificate = vscode.commands.registerCommand(
      'multimeter.addClientCertificate', async () => {
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
          filters:
              {'Certificate files': ['crt', 'pem', 'cer'], 'All files': ['*']},
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
        const clients =
            config.get<ClientCertificate[]>('certificates.clients', []);

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
            'certificates.clients', clients,
            vscode.ConfigurationTarget.Workspace);

        vscode.window.showInformationMessage(
            `Client certificate "${name}" added successfully`);
      });

  // Select CA Certificate Command
  const selectCaCertificate = vscode.commands.registerCommand(
      'multimeter.selectCaCertificate', async () => {
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
      });

  // Manage Certificates Command
  const manageCertificates = vscode.commands.registerCommand(
      'multimeter.manageCertificates', async () => {
        const config = vscode.workspace.getConfiguration('multimeter');
        const clients =
            config.get<ClientCertificate[]>('certificates.clients', []);

        if (clients.length === 0) {
          const action = await vscode.window.showInformationMessage(
              'No client certificates configured.', 'Add Certificate');

          if (action) {
            vscode.commands.executeCommand('multimeter.addClientCertificate');
          }
          return;
        }

        const items = [
          {label: '$(add) Add New Certificate', action: 'add'},
          {label: '$(folder-opened) Select CA Certificate', action: 'ca'},
          ...clients.map(
              cert => ({
                label: `${cert.enabled ? '$(check)' : '$(circle-outline)'} ${
                    cert.name}`,
                description: `${cert.host} • ${path.basename(cert.certPath)}`,
                action: 'manage',
                cert
              }))
        ];

        const selected = await vscode.window.showQuickPick(
            items, {placeHolder: 'Select action or certificate to manage'});

        if (!selected) {
          return;
        }

        if (selected.action === 'add') {
          vscode.commands.executeCommand('multimeter.addClientCertificate');
        } else if (selected.action === 'ca') {
          vscode.commands.executeCommand('multimeter.selectCaCertificate');
        } else if (
            selected.action === 'manage' && 'cert' in selected &&
            selected.cert) {
          await manageSingleCertificate(selected.cert);
        }
      });

  // Manage single certificate
  async function manageSingleCertificate(cert: ClientCertificate) {
    const actions = [
      {
        label: cert.enabled ? '$(circle-slash) Disable' : '$(check) Enable',
        action: 'toggle'
      },
      {label: '$(edit) Edit', action: 'edit'},
      {label: '$(trash) Remove', action: 'remove'}
    ];

    const action = await vscode.window.showQuickPick(
        actions, {placeHolder: `Manage "${cert.name}"`});

    if (!action) {
      return;
    }

    const config = vscode.workspace.getConfiguration('multimeter');
    const clients = config.get<ClientCertificate[]>('certificates.clients', []);
    const index = clients.findIndex(c => c.id === cert.id);

    if (index === -1) {
      return;
    }

    switch (action.action) {
      case 'toggle':
        clients[index].enabled = !clients[index].enabled;
        await config.update(
            'certificates.clients', clients,
            vscode.ConfigurationTarget.Workspace);
        vscode.window.showInformationMessage(`Certificate "${cert.name}" ${
            clients[index].enabled ? 'enabled' : 'disabled'}`);
        break;

      case 'edit':
        await editCertificate(clients[index]);
        break;

      case 'remove':
        const confirm = await vscode.window.showWarningMessage(
            `Remove certificate "${cert.name}"?`, 'Remove');
        if (confirm) {
          clients.splice(index, 1);
          await config.update(
              'certificates.clients', clients,
              vscode.ConfigurationTarget.Workspace);
          vscode.window.showInformationMessage(
              `Certificate "${cert.name}" removed`);
        }
        break;
    }
  }

  // Edit certificate
  async function editCertificate(cert: ClientCertificate) {
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

  // Add command to open settings
  const openSettingsCommand =
      vscode.commands.registerCommand('multimeter.openSettings', () => {
        vscode.commands.executeCommand(
            'workbench.action.openSettings', 'multimeter');
      });

  context.subscriptions.push(
      addClientCertificate, selectCaCertificate, manageCertificates,
      openSettingsCommand);
}