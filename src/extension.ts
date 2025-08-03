import * as fs from 'fs';
import * as path from 'path';
import {v4 as uuidv4} from 'uuid';
import * as vscode from 'vscode';

import {MmtEditorProvider} from './components/MmtEditorProvider';
import ConvertorPanel from './ConvertorPanel';
import HistoryPanel from './HistoryPanel';
import MockServerPanel from './MockServerPanel';
import CertificatesPanel from './CertificatesPanel';

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
}