import * as vscode from 'vscode';

import * as path from 'path';

import * as file from './file';
import {handleNetworkMessage} from './network';
import * as run from './run';
import * as mockRunner from './mockRunner';
import {suiteHierarchy, JSer, testParsePack} from 'mmt-core';

let curlTerminal: vscode.Terminal|null = null;

async function handleUpdateWorkspaceState(message: any, mmtProvider: any) {
  mmtProvider.context.workspaceState.update(message.name, message.value);
  await vscode.commands.executeCommand('multimeter.environment.refresh');
}

function handleLoadWorkspaceState(
    message: any, webviewPanel: vscode.WebviewPanel, mmtProvider: any) {
  const value = mmtProvider.context.workspaceState.get(message.name, {});
  webviewPanel.webview.postMessage({
    command: 'loadWorkspaceState',
    name: message.name,
    value,
  });
}


function handleShowPopupMessage(message: any) {
  switch (message.level) {
    case 'error':
      vscode.window.showErrorMessage(message.message);
      break;
    case 'warning':
      vscode.window.showWarningMessage(message.message);
      break;
    case 'info':
      vscode.window.showInformationMessage(message.message);
      break;
  }
}

function handleUpdateDocumentProblems(
    message: any, document: vscode.TextDocument, mmtProvider: any) {
  const problems = Array.isArray(message?.problems) ? message.problems : [];
  const diagnostics = problems.map((problem: any) => {
    const line = typeof problem?.line === 'number' ? problem.line : 1;
    const column = typeof problem?.column === 'number' ? problem.column : 1;
    const zeroLine = Math.max(0, line - 1);
    const zeroColumn = Math.max(0, column - 1);
    const range = new vscode.Range(
        new vscode.Position(zeroLine, zeroColumn),
        new vscode.Position(zeroLine, Math.max(zeroColumn + 1, zeroColumn)));
    const severity = problem?.severity === 'error' ?
        vscode.DiagnosticSeverity.Error :
        vscode.DiagnosticSeverity.Warning;
    const diagnostic =
        new vscode.Diagnostic(range, String(problem?.message || ''), severity);
    diagnostic.source = 'multimeter';
    return diagnostic;
  });
  mmtProvider.diagnostics.set(document.uri, diagnostics);
}

function handleAddHistory(message: any, mmtProvider: any) {
  mmtProvider.historyManager.add(message.item);
}

async function handleUpdateConfig(message: any, mmtProvider: any) {
  try {
    const {section, key, fullKey, value} = message as {
      section?: string;
      key?: string;
      fullKey?: string;
      value: any
    };
    let targetSection = section;
    let targetKey = key;
    if (fullKey && (!section || !key)) {
      // split first segment as section, rest as key path
      const parts = String(fullKey).split('.');
      targetSection = parts.shift();
      targetKey = parts.join('.');
    }
    if (!targetSection || !targetKey) {
      return;
    }
    await vscode.workspace.getConfiguration(targetSection)
        .update(targetKey, value, vscode.ConfigurationTarget.Global);
    // Broadcast updated config to all panels
    mmtProvider.broadcastConfig();
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to update configuration: ${err}`);
  }
}

async function handleRunCurlCommand(message: any) {
  try {
    const cmd = String(message.curl || '').trim();
    if (!cmd) {
      vscode.window.showWarningMessage('No curl command to run.');
      return;
    }

    const exists =
        !!curlTerminal && vscode.window.terminals.some(t => t === curlTerminal);
    if (!exists) {
      curlTerminal = vscode.window.createTerminal({name: 'Multimeter Curl'});
      const term = curlTerminal;
      term.show(true);
      const delay = (ms: number) =>
          new Promise<void>(resolve => setTimeout(resolve, ms));
      await delay(1500);
      term.sendText(cmd, true);
      term.show(true);
    } else {
      const term = curlTerminal!;
      term.show(true);
      term.sendText(cmd, true);
      term.show(true);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to open terminal: ${err}`);
  }
}

export const messageReceived = async (
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) => {
  switch (message.command) {
    case 'loadDocumentContent':
      await file.handleLoadDocumentContent(webviewPanel, document, mmtProvider);
      break;

    case 'updateDocumentContent':
      file.handleUpdateDocumentContent(message, document, mmtProvider);
      break;

    case 'updateWorkspaceState':
      await handleUpdateWorkspaceState(message, mmtProvider);
      break;

    case 'loadWorkspaceState':
      handleLoadWorkspaceState(message, webviewPanel, mmtProvider);
      break;

    case 'getFileContent':
      await file.handleGetFileContent(
          message, webviewPanel, document, mmtProvider);
      break;

    case 'getFileAsDataUrl':
      await file.handleGetFileAsDataUrl(message, webviewPanel, document);
      break;

    case 'validateImports':
      await file.handleValidateImports(message, webviewPanel, document);
      break;

    case 'validateFilesExist':
      file.handleValidateFilesExist(message, webviewPanel, document);
      break;

    case 'getSuiteImportTree':
      await file.handleGetSuiteImportTree(message, webviewPanel, document);
      break;

    case 'getSuiteHierarchy': {
      const filename = typeof message?.filename === 'string' ? message.filename : '';
      const leafPrefix = typeof message?.leafPrefix === 'string' && message.leafPrefix ? message.leafPrefix : undefined;
      if (!filename) {
        webviewPanel.webview.postMessage({
          command: 'suiteHierarchyResult',
          requestId: message?.requestId,
          error: 'Missing filename',
        });
        break;
      }
      try {
        const rawText = await file.readRelativeFileContent(document.uri.fsPath, filename);
        // Make it absolute for proper relative resolution.
        const filePath = path.resolve(path.dirname(document.uri.fsPath), filename);
        const docType = JSer.fileType(filePath, rawText);

        // For test files, return a simple test node with title (not full hierarchy)
        if (docType === 'test') {
          let title: string | undefined;
          try {
            const testDoc = testParsePack.yamlToTest(rawText);
            if (typeof testDoc?.title === 'string' && testDoc.title.trim()) {
              title = testDoc.title.trim();
            }
          } catch {
            // Ignore parsing errors
          }
          webviewPanel.webview.postMessage({
            command: 'suiteHierarchyResult',
            requestId: message?.requestId,
            filename,
            suiteFilePath: filePath,
            tree: {
              kind: 'test',
              id: leafPrefix || 'test',
              path: filePath,
              title,
            },
          });
          break;
        }

        // For suite files, build full hierarchy
        const tree = await suiteHierarchy.buildSuiteHierarchyFromSuiteFile({
          suiteFilePath: filePath,
          suiteRawText: rawText,
          leafPrefix,
          fileLoader: async (requestedPath: string) => {
            try {
              return await file.readFileContent(requestedPath);
            } catch {
              return '';
            }
          },
        } as any);

        webviewPanel.webview.postMessage({
          command: 'suiteHierarchyResult',
          requestId: message?.requestId,
          filename,
          suiteFilePath: filePath,
          tree,
        });
      } catch (err: any) {
        webviewPanel.webview.postMessage({
          command: 'suiteHierarchyResult',
          requestId: message?.requestId,
          filename,
          error: err?.message || String(err),
        });
      }
      break;
    }

    case 'openRelativeFile':
      await file.handleOpenRelativeFile(message, document);
      break;
    case 'openOsFilePicker':
      await file.handleOpenOsFilePicker(message, webviewPanel, document);
      break;

    case 'runCurrentDocument':
      await run.handleRunCurrentDocument(
          message, webviewPanel, document, mmtProvider);
      break;

    case 'runSuite':
      await run.handleRunSuite(message, webviewPanel, document, mmtProvider);
      break;

    case 'stopSuiteRun':
      run.handleStopSuiteRun(message, webviewPanel, document, mmtProvider);
      break;

    case 'stopTestRun':
      run.handleStopTestRun(message, webviewPanel, document, mmtProvider);
      break;

    case 'showLogOutputChannel':
      run.showLogOutputChannel();
      break;

    case 'listFiles':
      file.handleListFiles(message, webviewPanel, document);
      break;

    case 'showPopupMessage':
      handleShowPopupMessage(message);
      break;


    case 'updateDocumentProblems':
      handleUpdateDocumentProblems(message, document, mmtProvider);
      break;

    case 'logToOutput':
      run.logToOutput(message.level, message.message);
      break;

    case 'runJSCode':
      await run.handleRunJSCode(message);
      break;

    case 'network':
      handleNetworkMessage(message, webviewPanel, mmtProvider.context, undefined, document?.uri?.fsPath);
      break;

    case 'addHistory':
      handleAddHistory(message, mmtProvider);
      break;

    case 'openHistoryPanel':
      await vscode.commands.executeCommand('multimeter.history.show');
      break;

    case 'updateConfig':
      await handleUpdateConfig(message, mmtProvider);
      break;

    case 'exportHtml':
      await file.handleExportHtml(message);
      break;

    case 'exportMarkdown':
      await file.handleExportMarkdown(message);
      break;

    case 'exportReport':
      await file.handleExportReport(message, document);
      break;

    case 'openMarkdownPreview':
      await file.handleOpenMarkdownPreview(message, mmtProvider);
      break;

    case 'runCurlCommand':
      await handleRunCurlCommand(message);
      break;

    case 'startMock':
      try {
        await mockRunner.startMockServer(document, webviewPanel, mmtProvider);
      } catch (err: any) {
        // Error already shown to user in mockRunner
      }
      break;

    case 'stopMock':
      mockRunner.stopMockServer(document.uri.toString());
      break;

    case 'mockStatus':
      webviewPanel.webview.postMessage({
        command: 'mockServerStatus',
        running: mockRunner.isRunning(document.uri.toString()),
      });
      break;
  }
};