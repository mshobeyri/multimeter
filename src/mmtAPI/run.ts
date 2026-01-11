import {runner, suiteHierarchy} from 'mmt-core';
import {LogLevel} from 'mmt-core/CommonData';
import {runJSCode, setRunnerNetworkConfig} from 'mmt-core/jsRunner';
import * as path from 'path';
import * as vscode from 'vscode';

import {readRelativeFileContent} from './file';
import {getPreparedConfig} from './network';
import {buildFilteredSuiteYaml} from './suiteTargets';

const logOutputChannel =
    vscode.window.createOutputChannel('Multimeter', {log: true});

let activeSuiteRun:
    {suiteRunId: string; controller: AbortController; panelId: string;}|null =
        null;

const suiteRunLeafByChildRunId = new Map<string, string>();

function createSuiteRunId(document: vscode.TextDocument) {
  return `suite:${document.uri.fsPath}:${Date.now()}`;
}

function getPanelId(panel: vscode.WebviewPanel): string {
  // WebviewPanel doesn't expose a stable ID; use extension viewType + title.
  return `${panel.viewType}:${panel.title}`;
}

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

export async function handleRunSuite(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  const fileName = path.basename(document.uri.fsPath);
  const forwardLog = (level: LogLevel, message: string) => {
    logToOutput(level, message);
  };

  let netConfigApplied = false;
  try {
    const netConfig = getPreparedConfig();
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
  suiteRunLeafByChildRunId.clear();

  webviewPanel.webview.postMessage({
    command: 'suiteRunStart',
    suiteRunId,
    filePath: document.uri.fsPath,
  });

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

    // NOTE: core currently doesn't support cancellation; we only stop forwarding
    // and we can follow up by adding abort checks in core/runSuite.ts.
    const targets = Array.isArray(message?.targets) ? message.targets : null;
    const rawSuite = document.getText();

    // Map UI targets (which may include `import:...:test:<path>` ids) to core
    // legacy testIds `${groupIndex}:${entryIndex}` that `runSuite` understands.
    const mappedTargetsSet = new Set<string>();
    const legacyTargets: string[] = [];
    if (Array.isArray(targets)) {
      for (const t of targets) {
        if (typeof t === 'string' && /^\d+:\d+$/.test(t)) {
          legacyTargets.push(t);
          mappedTargetsSet.add(t);
        }
      }
    }

    // If there are non-legacy targets, try to resolve them to underlying testIds
    // by building the suite hierarchy and locating file paths referenced by the
    // import node ids (they include the path as the last segment `:test:<path>`).
    const nonLegacyTargets = Array.isArray(targets) ? targets.filter((tt: any) => typeof tt === 'string' && !/^\d+:\d+$/.test(tt)) : [];
    if (nonLegacyTargets.length > 0) {
      try {
        const suiteFilePath = document.uri.fsPath;
        const tree = await suiteHierarchy.buildSuiteHierarchyFromSuiteFile({
          suiteFilePath,
          suiteRawText: rawSuite,
          fileLoader: async (requestedPath: string) => {
            try {
              return await readRelativeFileContent(suiteFilePath, requestedPath);
            } catch {
              return '';
            }
          },
        });

        const normalizePath = (p: string) => {
          try {
            if (path.isAbsolute(p)) return path.normalize(p);
            return path.normalize(path.resolve(path.dirname(document.uri.fsPath), p));
          } catch {
            return p;
          }
        };

        const subtreeContainsPath = (node: any, targetPath: string): boolean => {
          if (!node) return false;
          if ((node.path && normalizePath(node.path) === targetPath)) return true;
          if (Array.isArray(node.children)) {
            for (const c of node.children) {
              if (subtreeContainsPath(c, targetPath)) return true;
            }
          }
          return false;
        };

        for (const rawTarget of nonLegacyTargets) {
          if (typeof rawTarget !== 'string') continue;
          // Try to extract a trailing path from import ids like `import:<uuid>:test:<path>`
          const m = /(?:^|:)\b(?:test|suite|missing)\b:(.+)$/.exec(rawTarget);
          const targetPath = m ? normalizePath(m[1]) : normalizePath(rawTarget);

          // Walk root-level nodes. If the node is a `group`, its index is the group index.
          for (let i = 0; i < tree.length; i++) {
            const node = tree[i] as any;
            if (node.kind === 'group') {
              for (let j = 0; j < (node.children || []).length; j++) {
                const child = node.children[j];
                if (subtreeContainsPath(child, targetPath)) {
                  mappedTargetsSet.add(`${i}:${j}`);
                }
              }
            } else {
              // Single-group case (group index 0)
              if (subtreeContainsPath(node, targetPath)) {
                mappedTargetsSet.add(`0:${i}`);
              }
            }
          }
        }
      } catch (e) {
        // If mapping fails for any reason, fall back to legacyTargets only.
        logToOutput('debug', `Failed to map non-legacy suite targets: ${String(e)}`);
      }
    }

    const finalTargets = Array.from(mappedTargetsSet);
    const hasOnlyLegacyTargets = finalTargets.length > 0 && finalTargets.every((t) => /^\d+:\d+$/.test(t));
    const filtered = finalTargets.length && hasOnlyLegacyTargets ? buildFilteredSuiteYaml(rawSuite, finalTargets) : rawSuite;
    const runFilePath = document.uri.fsPath;

    await runner.runFile({
      file: filtered,
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
      // Support partial runs for suite nodes by letting core filter by leafId.
      suiteTargets: Array.isArray(targets) && targets.length ? targets : undefined,
      reporter: (msg: any) => {
        const current = activeSuiteRun;
        if (!current || current.suiteRunId !== suiteRunId) {
          return;
        }
        if (current.controller.signal.aborted) {
          return;
        }

        const incomingNodeId = typeof msg?.nodeId === 'string' ? msg.nodeId : undefined;
        const incomingTestId = typeof msg?.testId === 'string' ? msg.testId : undefined;
        let leafId = incomingNodeId || incomingTestId;
        if (msg?.scope === 'suite-item' &&
            Number.isInteger(msg?.groupIndex) &&
            Number.isInteger(msg?.groupItemIndex)) {
          const derived = `${msg.groupIndex}:${msg.groupItemIndex}`;
          if (!leafId) {
            leafId = derived;
          }
          if (typeof msg?.runId === 'string' && msg.runId && leafId) {
            suiteRunLeafByChildRunId.set(msg.runId, leafId);
          }
        } else if (typeof msg?.runId === 'string' && msg.runId) {
          leafId = leafId || suiteRunLeafByChildRunId.get(msg.runId);
        }
        const testId = incomingTestId || leafId;

        webviewPanel.webview.postMessage({
          command: 'runFileReport',
          suiteRunId,
          leafId,
          testId,
          ...msg,
        });
      },
    });

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