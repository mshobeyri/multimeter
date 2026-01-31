import {runner, suiteHierarchy, suiteBundle} from 'mmt-core';
import {LogLevel} from 'mmt-core/CommonData';
import {runJSCode, setRunnerNetworkConfig} from 'mmt-core/jsRunner';
import * as path from 'path';
import * as vscode from 'vscode';

import {readRelativeFileContent} from './file';
import {getPreparedConfigFromStorage} from './network';

const logOutputChannel =
    vscode.window.createOutputChannel('Multimeter', {log: true});

let activeSuiteRun:
  {suiteRunId: string; controller: AbortController; panelId: string;}|null =
    null;

const suiteRunIdByChildRunId = new Map<string, string>();

function createSuiteRunId(document: vscode.TextDocument) {
  return `suite:${document.uri.fsPath}:${Date.now()}`;
}

function getPanelId(panel: vscode.WebviewPanel): string {
  // WebviewPanel doesn't expose a stable ID; use a process-unique identity.
  // Title can collide across tabs (and is less reliable on Windows), so we
  // prefer the panel object's identity via a WeakMap allocation.
  let id = panelIds.get(panel);
  if (!id) {
    id = `panel:${++panelIdSeq}`;
    panelIds.set(panel, id);
  }
  return id;
}

const panelIds = new WeakMap<vscode.WebviewPanel, string>();
let panelIdSeq = 0;

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
}
export function showLogOutputChannel() {
  logOutputChannel.show(true);
}

export async function handleRunCurrentDocument(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  const fileName = path.basename(document.uri.fsPath);
  const forwardLog = (level: LogLevel, message: string) => {
    logToOutput(level, message);
  };
  // Build env vars first so we can use them for passphrase resolution
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
  try {
    const netConfig = getPreparedConfigFromStorage(mmtProvider.context, vscodeEnv);
    setRunnerNetworkConfig(netConfig);
  } catch (err: any) {
    logToOutput(
        'warn', `Unable to apply certificate settings: ${err?.message || err}`);
  }
  try {
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
        webviewPanel.webview.postMessage({
          command: 'runFileReport',
          filePath: document.uri.toString(),
          ...msg,
        });
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

export async function handleRunSuite(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  const fileName = path.basename(document.uri.fsPath);
  const forwardLog = (level: LogLevel, message: string) => {
    logToOutput(level, message);
  };

  // Build env vars first so we can use them for passphrase resolution
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

  let netConfigApplied = false;
  try {
    const netConfig = getPreparedConfigFromStorage(mmtProvider.context, vscodeEnv);
    setRunnerNetworkConfig(netConfig);
    netConfigApplied = true;
  } catch (err: any) {
    logToOutput(
        'warn', `Unable to apply certificate settings: ${err?.message || err}`);
  }

  const suiteRunId =
      typeof message?.suiteRunId === 'string' && message.suiteRunId ?
      message.suiteRunId :
      createSuiteRunId(document);

  const controller = new AbortController();
  activeSuiteRun = {
    suiteRunId,
    controller,
    panelId: getPanelId(webviewPanel),
  };
  suiteRunIdByChildRunId.clear();

  webviewPanel.webview.postMessage({
    command: 'suiteRunStart',
    suiteRunId,
    filePath: document.uri.fsPath,
  });
  forwardLog('debug', `handleRunSuite: started suiteRunId=${suiteRunId} file=${document.uri.fsPath} target=${String(message?.target)}`);

  try {
    const target = typeof message?.target === 'string' ? message.target : undefined;
    const rawSuite = document.getText();
    const runFilePath = document.uri.fsPath;

    const bundleTarget = typeof target === 'string' && target ? target : undefined;
    const tree = await suiteHierarchy.buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: runFilePath,
      suiteRawText: rawSuite,
      fileLoader: async (requestedPath: string) => {
        try {
          return await readRelativeFileContent(runFilePath, requestedPath);
        } catch {
          return '';
        }
      },
    });
    forwardLog('debug', `handleRunSuite: built hierarchy for ${runFilePath}`);
    const bundle = suiteBundle.createSuiteBundle({
      rootSuitePath: runFilePath,
      hierarchy: tree,
      target: bundleTarget,
    });
    forwardLog('debug', `handleRunSuite: created bundle root=${runFilePath} target=${String(bundleTarget)}`);

    // Forward the bundle to the webview for debugging/logging so the UI can print it
    try {
      webviewPanel.webview.postMessage({ command: 'suiteBundle', suiteRunId, bundle });
    } catch (e) {
      console.warn('Unable to post suiteBundle to webview', e);
    }

    await runner.runFile({
      file: rawSuite,
      fileType: 'raw' as any,
      filePath: runFilePath,
      exampleIndex: message?.inputs?.exampleIndex,
      manualInputs: {},
      envvar: vscodeEnv,
      manualEnvvars: {},
      fileLoader: async (relPath: string) => {
        try {
          return await readRelativeFileContent(runFilePath, relPath);
        } catch {
          return '';
        }
      },
      jsRunner: runJSCode,
      logger: forwardLog,
      abortSignal: controller.signal as any,
      // Bundle-based suite run: core uses bundle ids for targeting + routing.
      suiteBundle: bundle,
      // Provide a per-suite-run nonce for unique child runIds.
      suiteRunId: suiteRunId,
      reporter: (msg: any) => {
        const current = activeSuiteRun;
        if (!current || current.suiteRunId !== suiteRunId) {
          return;
        }
        if (current.controller.signal.aborted) {
          return;
        }

        let id = typeof msg?.id === 'string' ? msg.id : undefined;
        if (!id && typeof msg?.runId === 'string' && msg.runId) {
          id = suiteRunIdByChildRunId.get(msg.runId);
        }
        if (msg?.scope === 'suite-item' && typeof msg?.runId === 'string' && msg.runId && id) {
          suiteRunIdByChildRunId.set(msg.runId, id);
        }

        webviewPanel.webview.postMessage({
          command: 'runFileReport',
          suiteRunId,
          id,
          ...msg,
        });
      },
    } as any);

    webviewPanel.webview.postMessage({
      command: 'suiteRunEnd',
      suiteRunId,
      filePath: document.uri.fsPath,
      netConfigApplied,
      cancelled: controller.signal.aborted,
    });
  } catch (err: any) {
    webviewPanel.webview.postMessage({
      command: 'suiteRunEnd',
      suiteRunId,
      filePath: document.uri.fsPath,
      netConfigApplied,
      cancelled: controller.signal.aborted,
      error: err?.message || String(err),
    });
    vscode.window.showErrorMessage(
        `Failed to run ${fileName}: ${err?.message || String(err)}`);
  } finally {
    if (activeSuiteRun && activeSuiteRun.suiteRunId === suiteRunId) {
      activeSuiteRun = null;
    }
  }
}

export function handleStopSuiteRun(
    message: any, webviewPanel: vscode.WebviewPanel,
    _document: vscode.TextDocument, _mmtProvider: any) {
  const suiteRunId =
      typeof message?.suiteRunId === 'string' ? message.suiteRunId : '';
  const current = activeSuiteRun;
  if (!current) {
    return;
  }
  if (suiteRunId && current.suiteRunId !== suiteRunId) {
    return;
  }
  if (current.panelId !== getPanelId(webviewPanel)) {
    return;
  }
  current.controller.abort();
  webviewPanel.webview.postMessage({
    command: 'suiteRunStopped',
    suiteRunId: current.suiteRunId,
  });
}

export async function handleRunJSCode(message: any) {
  await runJSCode({
    js: message.code,
    title: message.title,
    logger: logToOutput,
    runId: message.runId ?? 'vscode-js-run',
    reporter: message.reporter ?? (() => {}),
  });
};