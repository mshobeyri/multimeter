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
      vscode.window.registerCustomEditorProvider('mmt.editor', mmtviewPanel));

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.mmt.show.full', () => {
        mmtviewPanel.showPanel('full');
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.mmt.show.yaml', () => {
        mmtviewPanel.showPanel('yaml');
      }));
  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.mmt.show.ui', () => {
        mmtviewPanel.showPanel('ui');
      }));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.convertor', new ConvertorPanel(context)));

  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.mock.server', new MockServerPanel(context)));

  const historyPanel = new HistoryPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.history', historyPanel));

  const environmentPanel = new EnvironmentPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.environment', environmentPanel));

  vscode.commands.registerCommand('multimeter.history.clear', async () => {
    const historyFile =
        vscode.Uri.joinPath(context.globalStorageUri, 'history.json');
    await vscode.workspace.fs.writeFile(historyFile, Buffer.from('[]', 'utf8'));
    historyPanel.refreshHistory();
  });

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.history.refresh', () => {
        historyPanel.refreshHistory();
      }));

  // Register Certificates Panel (this handles all certificate functionality)
  const certificatesPanel = new CertificatesPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider(
      'multimeter.certificates', certificatesPanel));

  // Add command to open settings
  const openSettingsCommand =
      vscode.commands.registerCommand('multimeter.setting.open', () => {
        vscode.commands.executeCommand(
            'workbench.action.openSettings', 'multimeter');
      });

  context.subscriptions.push(openSettingsCommand);

  context.subscriptions.push(vscode.commands.registerCommand(
      'multimeter.environment.clear', async () => {
        await environmentPanel.clearEnvironments();
        mmtviewPanel.refreshEnvironmentVars();
      }));

  context.subscriptions.push(
      vscode.commands.registerCommand('multimeter.environment.refresh', () => {
        environmentPanel.refreshEnvironmentVars();
        mmtviewPanel.refreshEnvironmentVars();
      }));

  // Add command to open text editor as YAML (for Git diff compatibility)
  context.subscriptions.push(
    vscode.commands.registerCommand('multimeter.mmt.show.as.text', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      
      if (!targetUri || !targetUri.path.endsWith('.mmt')) {
        vscode.window.showErrorMessage('Please select an MMT file');
        return;
      }

      // Close custom editor if open in same column
      const tabs = vscode.window.tabGroups.all
        .flatMap(group => group.tabs)
        .filter(tab => tab.input instanceof vscode.TabInputCustom && 
               (tab.input as vscode.TabInputCustom).uri.toString() === targetUri.toString());
      
      for (const tab of tabs) {
        if (tab.group.viewColumn === vscode.ViewColumn.Active) {
          await vscode.window.tabGroups.close(tab);
        }
      }

      // Open as MMT text editor
      const document = await vscode.workspace.openTextDocument(targetUri);
      await vscode.window.showTextDocument(document, { 
        preview: false,
        preserveFocus: false 
      });
      
      // Set language to YAML for syntax highlighting and Git compatibility
      await vscode.languages.setTextDocumentLanguage(document, 'mmt');
    })
  );
}