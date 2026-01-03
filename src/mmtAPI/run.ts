import {runner} from 'mmt-core';
import {LogLevel} from 'mmt-core/CommonData';
import {runJSCode, setRunnerNetworkConfig} from 'mmt-core/jsRunner';
import * as path from 'path';
import * as vscode from 'vscode';

import {readRelativeFileContent} from './file';
import {getPreparedConfig} from './network';

const logOutputChannel =
    vscode.window.createOutputChannel('Multimeter', {log: true});

export function logToOutput(level: LogLevel, message: string) {
  switch (level) {
    case 'trace':
      logOutputChannel.trace(message);
      break;
    case 'debug':
      logOutputChannel.debug(message);
      break;
    case 'info':
    case 'log':
      logOutputChannel.info(message);
      break;
    case 'error':
      logOutputChannel.error(message);
      break;
    case 'warn':
      logOutputChannel.warn(message);
      break;
    case 'info':
      logOutputChannel.info(message);
      break;
  }
  logOutputChannel.show(true);
}

export async function handleRunCurrentDocument(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  const fileName = path.basename(document.uri.fsPath);
  const forwardLog = (level: LogLevel, message: string) => {
    logToOutput(level, message);
  };
  try {
    const netConfig = getPreparedConfig();
    setRunnerNetworkConfig(netConfig);
  } catch (err: any) {
    logToOutput(
        'warn', `Unable to apply certificate settings: ${err?.message || err}`);
  }
  try {
    const envStorage = mmtProvider.context.workspaceState.get(
        'multimeter.environment.storage', []);
    const vscodeEnv: Record<string, any> = {};
    if (Array.isArray(envStorage)) {
      for (const item of envStorage) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const name = (item as any).name;
        if (typeof name === 'string' && name) {
          vscodeEnv[name] = (item as any).value;
        }
      }
    }
    const runOutcome = await runner.runFile({
      file: document.getText(),
      fileType: 'raw' as any,
      filePath: document.uri.fsPath,
      exampleIndex: message?.inputs?.exampleIndex,
      manualInputs: {},
      envvar: vscodeEnv,
      manualEnvvars: {},
      fileLoader: async (relPath: string) => {
        try {
          return await readRelativeFileContent(document.uri.fsPath, relPath);
        } catch {
          return '';
        }
      },
      jsRunner: runJSCode,
      logger: forwardLog,
      reporter: (msg: any) => {
        webviewPanel.webview.postMessage({command: 'runFileReport', ...msg});
      },
    });

    const {docType, displayName, result} = runOutcome;
    const label = docType === 'api' ? 'API' :
        docType === 'test'          ? 'Test' :
        docType === 'suite'         ? 'Suite' :
                                      'Document';
  } catch (err: any) {
    vscode.window.showErrorMessage(
        `Failed to run ${fileName}: ${err?.message || String(err)}`);
  }
}

export async function handleRunJSCode(message: any) {
  await runJSCode({
    code: message.code,
    title: message.title,
    logger: logToOutput,
    runId: message.runId ?? 'vscode-js-run',
    reporter: message.reporter ?? (() => {}),
  });
};