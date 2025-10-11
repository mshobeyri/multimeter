import * as fs from 'fs';
import {handleNetworkMessage as coreHandleNetworkMessage, NetworkConfig, NetworkMessage, PostMessage} from 'mmt-core/network';
import * as vscode from 'vscode';

// Certificate interfaces (should match NodeNetwork.ts)
interface CaCertificate {
  enabled: boolean;
  certPath: string;
  certData?: Buffer;
}

interface ClientCertificate {
  id: string;
  name: string;
  host: string;
  certPath: string;
  keyPath: string;
  enabled: boolean;
  certData?: Buffer;
  keyData?: Buffer;
}

// Prepare config with loaded cert/key data
function getPreparedConfig(): NetworkConfig {
  const config = vscode.workspace.getConfiguration('multimeter');
  const ca: CaCertificate =
      config.get('certificates.ca', {enabled: false, certPath: ''});
  const clients: ClientCertificate[] = config.get('certificates.clients', []);

  // Load CA cert data
  let caCertData: Buffer|undefined = undefined;
  if (ca.enabled && ca.certPath) {
    try {
      caCertData = fs.readFileSync(ca.certPath);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to load CA certificate: ${e}`);
    }
  }

  // Load client cert/key data
  const clientsWithData = clients.map(client => {
    let certData: Buffer|undefined = undefined;
    let keyData: Buffer|undefined = undefined;
    if (client.enabled && client.certPath && client.keyPath) {
      try {
        certData = fs.readFileSync(client.certPath);
        keyData = fs.readFileSync(client.keyPath);
      } catch (e) {
        vscode.window.showErrorMessage(
            `Failed to load client certificate for ${client.host}: ${e}`);
      }
    }
    return {...client, certData, keyData};
  });

  return {
    ca: {...ca, certData: caCertData},
    clients: clientsWithData,
    sslValidation: config.get('enableCertificateValidation', true),
    timeout: config.get('network.timeout', 30000),
    autoFormat: config.get('body.auto.format', false)
  };
}

// The VS Code-specific handler
export function handleNetworkMessage(
    message: NetworkMessage, webviewPanel: vscode.WebviewPanel) {
  const config = getPreparedConfig();
  const postMessage: PostMessage = (msg: any) =>
      webviewPanel.webview.postMessage(msg);

  // Call the core handler with prepared config and postMessage
  coreHandleNetworkMessage(message, config, postMessage);
}