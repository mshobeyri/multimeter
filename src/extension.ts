import * as fs from 'fs';
import * as path from 'path';
import {v4 as uuidv4} from 'uuid';
import * as vscode from 'vscode';

import CertificatesPanel from './CertificatesPanel';
import {MmtEditorProvider} from './components/MmtEditorProvider';
import ConvertorPanel from './ConvertorPanel';
import EnvironmentPanel from './EnvironmentPanel';
import HistoryPanel from './HistoryPanel';
import MockServerPanel from './MockServerPanel';

export function activate(context: vscode.ExtensionContext) {
  const mmtviewPanel = new MmtEditorProvider(context);
  context.subscriptions.push(
      vscode.window.registerCustomEditorProvider('mmt.preview', mmtviewPanel));

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

  const environmentPanel = new EnvironmentPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.environment', environmentPanel));

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

  // Register Certificates Panel (this handles all certificate functionality)
  const certificatesPanel = new CertificatesPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.certificates', certificatesPanel));

  // Add command to open settings
  const openSettingsCommand =
      vscode.commands.registerCommand('multimeter.openSettings', () => {
        vscode.commands.executeCommand(
            'workbench.action.openSettings', 'multimeter');
      });

  context.subscriptions.push(openSettingsCommand);

  context.subscriptions.push(vscode.commands.registerCommand(
      'multimeter.clearEnvironmentVariables', async () => {
        await environmentPanel.clearEnvironments();
        mmtviewPanel.refreshEnvironmentVars();
      }));

  context.subscriptions.push(vscode.commands.registerCommand(
      'multimeter.refreshEnvironmentVariables', () => {
        environmentPanel.refreshEnvironmentVars();
        mmtviewPanel.refreshEnvironmentVars();
      }));
}