import * as vscode from 'vscode';
import { MmtEditorProvider } from './components/MmtEditorProvider';
import ConvertorPanel from './ConvertorPanel';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(MmtEditorProvider.register(context));

  const showPreviewCommand = vscode.commands.registerCommand('extension.showMmtPreview', () => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === 'mmt') {
      vscode.commands.executeCommand('vscode.openWith', editor.document.uri, 'mmt.preview');
    }
  });

  context.subscriptions.push(showPreviewCommand);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'multimeterConvertor',
      new ConvertorPanel(context)
    )
  );
}

export function deactivate() {}