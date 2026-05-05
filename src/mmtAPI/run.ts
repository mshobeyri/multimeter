import {runner, suiteHierarchy, suiteBundle, runConfig, SuiteData} from 'mmt-core';
import {LogLevel} from 'mmt-core/CommonData';
import {findProjectRootSync} from 'mmt-core/fileHelper';
import {generateJunitXml} from 'mmt-core/junitXml';
import {generateMmtReport} from 'mmt-core/mmtReport';
import {generateReportHtml} from 'mmt-core/reportHtml';
import {generateReportMarkdown} from 'mmt-core/reportMarkdown';
import {runJSCode, setRunnerNetworkConfig} from 'mmt-core/jsRunner';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import YAML from 'yaml';

import {readRelativeFileContent} from './file';
import {startMockServerFromPath} from './mockRunner';
import {prepareNetworkConfigForFile, parseEnvFileForRun, resolveWorkspaceEnvFilePath} from './network';
import {onRunStarted, onRunFinished} from '../runStatusBar';

type SuiteEnvironment = SuiteData.SuiteEnvironment;

const logOutputChannel =
    vscode.window.createOutputChannel('Multimeter', {log: true});

function findWorkspaceProjectRoot(): string|undefined {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }
  const wsRoot = folders[0].uri.fsPath;
  const markerPath = path.join(wsRoot, 'multimeter.mmt');
  if (fs.existsSync(markerPath)) {
    return wsRoot;
  }
  return undefined;
}

/**
 * Find the project root by walking up from startPath looking for multimeter.mmt.
 * Returns the directory containing multimeter.mmt, or undefined if not found.
 */
function findProjectRoot(startPath: string): string | undefined {
  return findProjectRootSync(startPath, fs.existsSync, path.dirname, path.join) ?? findWorkspaceProjectRoot();
}

let activeSuiteRun:
  {suiteRunId: string; controller: AbortController; panelId: string;}|null =
    null;

let activeTestRun:
  {controller: AbortController; panelId: string;}|null = null;

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
  }
}
export function showLogOutputChannel() {
  const config = vscode.workspace.getConfiguration('multimeter');
  if (config.get<boolean>('showLogOnRun', true)) {
    logOutputChannel.show(true);
  }
}

async function writeRunExports(params: {
  suiteExports: any;
  runFilePath: string;
  projectRoot?: string;
  forwardLog: (level: LogLevel, message: string) => void;
}) {
  const {suiteExports, runFilePath, projectRoot, forwardLog} = params;
  if (!suiteExports || !Array.isArray(suiteExports.paths) || !suiteExports.collectedResults) {
    return;
  }
  const suiteDir = path.dirname(runFilePath);
  for (const exportPath of suiteExports.paths) {
    try {
      let resolvedPath: string;
      if (exportPath.startsWith('+/')) {
        if (projectRoot) {
          resolvedPath = path.resolve(projectRoot, exportPath.slice(2));
        } else {
          forwardLog('warn', `Cannot resolve +/ path without project root: ${exportPath}`);
          continue;
        }
      } else {
        resolvedPath = path.resolve(suiteDir, exportPath);
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const formatForExt: Record<string, string> = {
        '.xml': 'junit',
        '.html': 'html',
        '.md': 'md',
        '.mmt': 'mmt',
      };
      const format = formatForExt[ext];
      if (!format) {
        forwardLog('warn', `Unknown export format for extension ${ext}: ${exportPath}`);
        continue;
      }

      const exportSerializers: Record<string, ((r: any, o?: any) => string) | undefined> = {
        junit: generateJunitXml,
        mmt: generateMmtReport,
        html: generateReportHtml,
        md: generateReportMarkdown,
      };
      const serializer = exportSerializers[format];
      if (typeof serializer !== 'function') {
        forwardLog('warn', `Export serializer not available for format: ${format}`);
        continue;
      }

      forwardLog('info', `Exporting results to ${resolvedPath}`);
      const content = serializer(suiteExports.collectedResults);

      const parentDir = path.dirname(resolvedPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, {recursive: true});
      }

      fs.writeFileSync(resolvedPath, content, 'utf8');
      forwardLog('info', `Suite export written: ${resolvedPath}`);
    } catch (exportErr: any) {
      forwardLog('error', `Failed to write export ${exportPath}: ${exportErr?.message || String(exportErr)}`);
    }
  }
}

/**
 * Resolve suite environment configuration into merged env vars.
 * Reads the env file (multimeter.mmt or suite's environment.file) and resolves preset.
 */
function resolveSuiteEnvVars(params: {
  suiteEnv?: SuiteEnvironment;
  suiteFilePath: string;
  projectRoot?: string;
  baseEnvVars: Record<string, any>;
}): Record<string, any> {
  const {suiteEnv, suiteFilePath, projectRoot, baseEnvVars} = params;

  if (!suiteEnv) {
    return baseEnvVars;
  }

  // Resolve which env file to read for preset
  let envFilePath: string | undefined;
  if (suiteEnv.file) {
    // Resolve relative to suite file or project root for +/ paths
    if (suiteEnv.file.startsWith('+/')) {
      envFilePath = projectRoot ? path.join(projectRoot, suiteEnv.file.slice(2)) : undefined;
    } else {
      envFilePath = path.resolve(path.dirname(suiteFilePath), suiteEnv.file);
    }
  } else if (suiteEnv.preset && projectRoot) {
    // Use multimeter.mmt in project root
    envFilePath = path.join(projectRoot, 'multimeter.mmt');
  }

  // Resolve preset env vars if preset is specified
  let suitePresetEnv: Record<string, any> = {};
  if (suiteEnv.preset && envFilePath && fs.existsSync(envFilePath)) {
    try {
      const content = fs.readFileSync(envFilePath, 'utf8');
      const doc = YAML.parse(content);
      if (doc && typeof doc === 'object') {
        suitePresetEnv = runConfig.resolvePresetEnv(
          {variables: doc.variables, presets: doc.presets},
          suiteEnv.preset
        );
      }
    } catch (e: any) {
      logToOutput('warn', `Failed to resolve suite preset '${suiteEnv.preset}': ${e?.message || e}`);
    }
  }

  // Merge using VS Code priority: suite variables > suite preset > base (local storage)
  return runConfig.mergeSuiteEnv({
    baseEnv: baseEnvVars,
    suiteEnv,
    suitePresetEnv,
    cliOverridesSuiteEnv: false, // VS Code: suite env overrides local storage
  });
}

/** Extract envVars dict from workspace state storage. */
function extractEnvVars(mmtProvider: any): Record<string, any> {
  const envStorage = mmtProvider.context.workspaceState.get(
      'multimeter.environment.storage', []);
  const envVars: Record<string, any> = {};
  if (Array.isArray(envStorage)) {
    for (const item of envStorage) {
      if (!item || typeof item !== 'object') {
        continue;
      }
      const name = (item as any).name;
      if (typeof name === 'string' && name) {
        envVars[name] = (item as any).value;
      }
    }
  }
  return envVars;
}

/** Apply network/certificate config for a file. Returns true if applied. */
function applyNetworkConfig(filePath: string, envVars: Record<string, any>): boolean {
  try {
    const netConfig = prepareNetworkConfigForFile(filePath, envVars);
    setRunnerNetworkConfig(netConfig);
    return true;
  } catch (err: any) {
    logToOutput(
        'warn', `Unable to apply certificate settings: ${err?.message || err}`);
    return false;
  }
}

/** Create a fileLoader scoped to the directory of `basePath`. */
function createFileLoader(basePath: string): (relPath: string) => Promise<string> {
  return async (relPath: string) => {
    try {
      return await readRelativeFileContent(basePath, relPath);
    } catch {
      return '';
    }
  };
}

export async function handleRunCurrentDocument(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  const fileName = path.basename(document.uri.fsPath);
  const forwardLog = (level: LogLevel, message: string) => {
    logToOutput(level, message);
  };

  const envVars = extractEnvVars(mmtProvider);
  const projectRoot = findProjectRoot(document.uri.fsPath);
  applyNetworkConfig(document.uri.fsPath, envVars);

  const controller = new AbortController();
  activeTestRun = {
    controller,
    panelId: getPanelId(webviewPanel),
  };

  const statusBarRunId = onRunStarted(`Running ${fileName}`, () => controller.abort());
  const serverRunner = async (alias: string, filePath: string): Promise<() => void> => {
    // filePath is the resolved absolute path to the mock server file
    forwardLog('info', `Starting mock server from ${alias}`);
    return startMockServerFromPath(filePath, envVars);
  };

  try {
    const fileLoader = createFileLoader(document.uri.fsPath);
    const runOutcome = await runner.runFile({
      file: document.getText(),
      fileType: 'raw',
      filePath: document.uri.fsPath,
      exampleIndex: message?.inputs?.exampleIndex,
      manualInputs: message?.inputs?.manualInputs || {},
      envvar: envVars,
      manualEnvvars: {},
      fileLoader,
      jsRunner: (ctx: any) => runJSCode({
        ...ctx,
        fileLoader,
        serverRunner,
      }),
      logger: forwardLog,
      abortSignal: controller.signal,
      reporter: (msg: any) => {
        if (controller.signal.aborted) {
          return;
        }
        webviewPanel.webview.postMessage({
          command: 'runFileReport',
          filePath: document.uri.toString(),
          ...msg,
        });
      },
      projectRoot,
      serverRunner,
    });

    const {docType, displayName, result} = runOutcome;
    const label = docType === 'api' ? 'API' :
        docType === 'test'          ? 'Test' :
        docType === 'suite'         ? 'Suite' :
      docType === 'loadtest'      ? 'Load Test' :
                                      'Document';

    if (result.syntaxError) {
      const errorMsg = result.errors?.[0] || 'Generated code has a syntax error';
      const action = await vscode.window.showErrorMessage(
          `${label} ${displayName}: ${errorMsg}`,
          'View Code');
      if (action === 'View Code') {
        webviewPanel.webview.postMessage({
          command: 'switchToCodeTab',
          filePath: document.uri.toString(),
        });
      }
    }

    if (result.cancelled) {
      webviewPanel.webview.postMessage({
        command: 'testRunStopped',
        filePath: document.uri.toString(),
      });
    }
  } catch (err: any) {
    if (controller.signal.aborted) {
      webviewPanel.webview.postMessage({
        command: 'testRunStopped',
        filePath: document.uri.toString(),
      });
      return;
    }
    const msg = err?.message || String(err);
    logToOutput('error', `Failed to run ${fileName}: ${msg}`);
    webviewPanel.webview.postMessage({
      command: 'testRunStopped',
      filePath: document.uri.toString(),
    });
    if (typeof msg === 'string' && msg.includes('Cannot resolve "+/" import')) {
      vscode.window.showErrorMessage(
          `Failed to run ${fileName}: ${msg}. Add a multimeter.mmt file in your project root (or a parent folder) to enable +/ imports.`);
      return;
    }
    vscode.window.showErrorMessage(
        `Failed to run ${fileName}: ${msg}`);
  } finally {
    if (activeTestRun && activeTestRun.controller === controller) {
      activeTestRun = null;
    }
    onRunFinished(statusBarRunId);
  }
}

/** Create a reporter callback for suite runs that routes events via the webview. */
function createSuiteReporter(
    webviewPanel: vscode.WebviewPanel,
    suiteRunId: string,
    controller: AbortController): (msg: any) => void {
  return (msg: any) => {
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
      ...msg,
      // Place id AFTER spread so our resolved value is never overridden by
      // an undefined msg.id.  This is critical for events (like test-step)
      // where the core may not set id but the extension resolved it from
      // the suiteRunIdByChildRunId lookup.
      id,
    });
  };
}

export async function handleRunSuite(
    message: any, webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument, mmtProvider: any) {
  const fileName = path.basename(document.uri.fsPath);
  const forwardLog = (level: LogLevel, message: string) => {
    logToOutput(level, message);
  };

  const envVars = extractEnvVars(mmtProvider);
  const projectRoot = findProjectRoot(document.uri.fsPath);
  const netConfigApplied = applyNetworkConfig(document.uri.fsPath, envVars);

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

  const statusBarRunId = onRunStarted(`Running suite ${fileName}`, () => controller.abort());

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
    const isLoadTest = /^\s*type\s*:\s*loadtest\b/m.test(rawSuite);

    if (isLoadTest) {
      const projectRootLoadTest = findProjectRoot(runFilePath);
      const fileLoader = createFileLoader(runFilePath);
      const suiteServerRunner = async (alias: string, filePath: string): Promise<() => void> => {
        forwardLog('info', `Starting mock server from ${alias}`);
        return startMockServerFromPath(filePath, envVars);
      };

      const runOutcome = await runner.runFile({
        file: rawSuite,
        fileType: 'raw',
        filePath: runFilePath,
        exampleIndex: message?.inputs?.exampleIndex,
        manualInputs: {},
        envvar: envVars,
        manualEnvvars: {},
        fileLoader,
        jsRunner: (ctx: any) => runJSCode({
          ...ctx,
          fileLoader: ctx.fileLoader || fileLoader,
          serverRunner: ctx.serverRunner || suiteServerRunner,
        }),
        logger: forwardLog,
        abortSignal: controller.signal,
        suiteRunId,
        projectRoot: projectRootLoadTest,
        reporter: createSuiteReporter(webviewPanel, suiteRunId, controller),
        serverRunner: suiteServerRunner,
      });

      await writeRunExports({
        suiteExports: (runOutcome as any)?.suiteExports,
        runFilePath,
        projectRoot: projectRootLoadTest,
        forwardLog,
      });

      webviewPanel.webview.postMessage({
        command: 'suiteRunEnd',
        suiteRunId,
        filePath: document.uri.fsPath,
        netConfigApplied,
        cancelled: controller.signal.aborted,
        success: Boolean((runOutcome as any)?.result?.success),
        load: (runOutcome as any)?.loadResult,
      });
      return;
    }

    const bundleTarget = typeof target === 'string' && target ? target : undefined;
    const fileLoader = createFileLoader(runFilePath);
    const tree = await suiteHierarchy.buildSuiteHierarchyFromSuiteFile({
      suiteFilePath: runFilePath,
      suiteRawText: rawSuite,
      fileLoader,
    });
    forwardLog('debug', `handleRunSuite: built hierarchy for ${runFilePath}`);
    const bundle = suiteBundle.createSuiteBundle({
      rootSuitePath: runFilePath,
      hierarchy: tree,
      servers: tree.servers,
      environment: tree.environment,
      export: tree.export,
      target: bundleTarget,
    });
    forwardLog('debug', `handleRunSuite: created bundle root=${runFilePath} target=${String(bundleTarget)}`);

    // Forward the bundle to the webview for debugging/logging so the UI can print it
    try {
      webviewPanel.webview.postMessage({ command: 'suiteBundle', suiteRunId, bundle });
    } catch (e) {
      console.warn('Unable to post suiteBundle to webview', e);
    }

    // Merge suite environment with VS Code local storage env vars
    const projectRootSuite = findProjectRoot(runFilePath);
    const mergedEnvVars = resolveSuiteEnvVars({
      suiteEnv: bundle.environment,
      suiteFilePath: runFilePath,
      projectRoot: projectRootSuite,
      baseEnvVars: envVars,
    });

    // Create serverRunner to start mock servers from suite server nodes and test `run` steps.
    const suiteServerRunner = async (alias: string, filePath: string): Promise<() => void> => {
      // filePath is the resolved absolute path to the mock server file
      forwardLog('info', `Starting mock server from ${alias}`);
      return startMockServerFromPath(filePath, mergedEnvVars);
    };

    const runOutcome = await runner.runFile({
      file: rawSuite,
      fileType: 'raw',
      filePath: runFilePath,
      exampleIndex: message?.inputs?.exampleIndex,
      manualInputs: {},
      envvar: mergedEnvVars,
      manualEnvvars: {},
      fileLoader,
      jsRunner: (ctx: any) => runJSCode({
        ...ctx,
        // Prefer the child-specific fileLoader from the suite bundle runner
        // (which resolves relative to each child test's directory) over the
        // suite-level fileLoader.  Only fall back to suite-level if ctx has
        // no fileLoader at all.
        fileLoader: ctx.fileLoader || fileLoader,
        serverRunner: ctx.serverRunner || suiteServerRunner,
      }),
      logger: forwardLog,
      abortSignal: controller.signal,
      suiteBundle: bundle,
      suiteRunId: suiteRunId,
      projectRoot: projectRootSuite,
      reporter: createSuiteReporter(webviewPanel, suiteRunId, controller),
      serverRunner: suiteServerRunner,
    });

    await writeRunExports({
      suiteExports: (runOutcome as any)?.suiteExports,
      runFilePath,
      projectRoot: projectRootSuite,
      forwardLog,
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
    onRunFinished(statusBarRunId);
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

export function handleStopTestRun(
    _message: any, webviewPanel: vscode.WebviewPanel,
    _document: vscode.TextDocument, _mmtProvider: any) {
  const current = activeTestRun;
  if (!current) {
    return;
  }
  if (current.panelId !== getPanelId(webviewPanel)) {
    return;
  }
  current.controller.abort();
  webviewPanel.webview.postMessage({
    command: 'testRunStopped',
    filePath: _document.uri.toString(),
  });
}

export async function handleRunJSCode(message: any) {
  const fileLoader = typeof message?.fileLoader === 'function' ? message.fileLoader : undefined;
  await runJSCode({
    js: message.code,
    title: message.title,
    logger: logToOutput,
    runId: message.runId ?? 'vscode-js-run',
    reporter: message.reporter ?? (() => {}),
    fileLoader,
  });
};