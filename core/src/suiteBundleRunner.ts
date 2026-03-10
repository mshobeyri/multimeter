import {LogLevel} from './CommonData';
import {createReportCollector, CollectedResults} from './reportCollector';
import {basename, detectDocType, resolveRelativeTo, RunFileResult, sanitizeIdentifier, SuiteExportSpec} from './runCommon';
import {RunFileOptions, RunReporterMessage, RunResult, SuiteStepStatus} from './runConfig';
import {SuiteBundle, SuiteBundleNode} from './suiteBundle';
import {stopAllServers_, registerServer_} from './testHelper';

/** Cleanup functions for servers started during suite execution. */
type ServerCleanup = () => void;

function findNodeById(nodes: readonly SuiteBundleNode[], targetId: string): SuiteBundleNode|undefined {
  const stack: SuiteBundleNode[] = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    if (n.id === targetId) {
      return n;
    }
    if (n.kind === 'group' || n.kind === 'suite') {
      for (const c of n.children) {
        stack.push(c);
      }
    }
  }
  return undefined;
}

function collectRunnableCountFromRoot(root: readonly SuiteBundleNode[]): number {
  let count = 0;
  const walk = (nodes: readonly SuiteBundleNode[]) => {
    for (const n of nodes) {
      if (n.kind === 'test' || n.kind === 'suite') {
        count += 1;
      }
      if (n.kind === 'group' || n.kind === 'suite') {
        walk(n.children);
      }
    }
  };
  walk(root);
  return count;
}

async function runSuiteBundleNode(params: {
  node: Extract<SuiteBundleNode, {kind: 'test'}> | Extract<SuiteBundleNode, {kind: 'suite'}>;
  bundle: SuiteBundle;
  options: RunFileOptions;
  runFile: (options: RunFileOptions) => Promise<RunFileResult>;
  suiteLogger: (level: LogLevel, msg: string) => void;
  baseFileLoader: RunFileOptions['fileLoader'];
  nextIndex: () => number;
}): Promise<{success: boolean; threw: boolean; status: SuiteStepStatus}> {
  const {node, bundle, options, runFile, suiteLogger, baseFileLoader, nextIndex} = params;

  const currentIndex = nextIndex();
  const childFilePath = resolveRelativeTo(node.path, bundle.rootSuitePath);
  const display = basename(childFilePath || node.path);
  // Include a suite-run nonce so repeating the suite reuses no runIds.
  const suiteRunNonce = typeof options.suiteRunId === 'string' ? options.suiteRunId : '';
  const runId = `suite:${sanitizeIdentifier(bundle.rootSuitePath)}:${suiteRunNonce}:${currentIndex}:${sanitizeIdentifier(childFilePath || node.path)}`;
  const id = node.id;

  try {
    const childRawText = await baseFileLoader(childFilePath);
    const childDocType = detectDocType(childFilePath, childRawText);

    suiteLogger('info', `Running suite item: ${display}`);
    const childFileLoader = async (requestedPath: string) => {
      const resolved = resolveRelativeTo(requestedPath, childFilePath);
      return await baseFileLoader(resolved);
    };

    options.reporter && options.reporter({
      scope: 'suite-item',
      status: 'running',
      runId,
      filePath: childFilePath,
      entry: node.path,
      title: (node as any).title,
      docType: childDocType ?? undefined,
      id,
    });

    const childRunOptions: RunFileOptions = {
      ...options,
      file: childRawText,
      fileType: 'raw',
      filePath: childFilePath,
      fileLoader: childFileLoader,
      logger: suiteLogger,
      runId,
      id,
      __mmtIsSuiteBundleChildRun: true,
      skipServerCleanup: true,
    };

    let childRun: RunFileResult;
    if (node.kind === 'test') {
      childRun = await runFile(childRunOptions);
    } else {
      childRun = await executeSuiteBundle({
        bundle: {
          rootSuitePath: childFilePath,
          bundle: node.children,
          target: undefined,
        },
        options: childRunOptions,
        preLogs: [],
        runFile,
      });
    }

    const status: SuiteStepStatus = childRun.result?.success ? 'passed' : 'failed';

    options.reporter && options.reporter({
      scope: 'suite-item',
      status,
      runId,
      filePath: childFilePath,
      entry: node.path,
      title: (node as any).title,
      docType: childDocType ?? undefined,
      id,
    });

    return {success: status === 'passed', threw: childRun.result?.threw === true, status};
  } catch (e: any) {
    const errorMessage = e?.message || String(e);
    suiteLogger('error', `Failed to run suite item: ${display} - ${errorMessage}`);

    options.reporter && options.reporter({
      scope: 'suite-item',
      status: 'failed',
      runId,
      filePath: childFilePath,
      entry: node.path,
      title: (node as any).title,
      id,
    });

    return {success: false, threw: true, status: 'failed'};
  }
}

async function runSuiteGroup(params: {
  node: Extract<SuiteBundleNode, {kind: 'group'}>;
  bundle: SuiteBundle;
  options: RunFileOptions;
  runFile: (options: RunFileOptions) => Promise<RunFileResult>;
  suiteLogger: (level: LogLevel, msg: string) => void;
  baseFileLoader: RunFileOptions['fileLoader'];
  nextIndex: () => number;
  serverCleanups: ServerCleanup[];
}): Promise<{overallSuccess: boolean; anyThrew: boolean}> {
  const {node, bundle, options, runFile, suiteLogger, baseFileLoader, nextIndex, serverCleanups} = params;

  const results = await Promise.all(node.children.map(async (child) => {
    if (options.abortSignal?.aborted) {
      return {success: false, threw: false, status: 'failed' as SuiteStepStatus};
    }

    if (child.kind === 'test' || child.kind === 'suite') {
      return await runSuiteBundleNode({
        node: child,
        bundle,
        options,
        runFile,
        suiteLogger,
        baseFileLoader,
        nextIndex,
      });
    }

    if (child.kind === 'group') {
      // Nested group: runs its own children in parallel.
      const childGroup = await runSuiteGroup({
        node: child,
        bundle,
        options,
        runFile,
        suiteLogger,
        baseFileLoader,
        nextIndex,
        serverCleanups,
      });
      return {success: childGroup.overallSuccess, threw: childGroup.anyThrew, status: childGroup.overallSuccess ? 'passed' as SuiteStepStatus : 'failed' as SuiteStepStatus};
    }

    if (child.kind === 'server') {
      const serverResult = await startServerNode({
        node: child,
        bundle,
        options,
        suiteLogger,
        serverCleanups,
      });
      return {success: serverResult.success, threw: false, status: serverResult.success ? 'passed' as SuiteStepStatus : 'failed' as SuiteStepStatus};
    }

    // missing/cycle are not runnable.
    return {success: true, threw: false, status: 'passed' as SuiteStepStatus};
  }));

  const groupHadAnyFailure = results.some(r => !r || !r.success);
  const groupThrew = results.some(r => !!r && r.threw === true);

  return {overallSuccess: !groupHadAnyFailure, anyThrew: groupThrew};
}

async function startServerNode(params: {
  node: Extract<SuiteBundleNode, {kind: 'server'}>;
  bundle: SuiteBundle;
  options: RunFileOptions;
  suiteLogger: (level: LogLevel, msg: string) => void;
  serverCleanups: ServerCleanup[];
}): Promise<{success: boolean}> {
  const {node, bundle, options, suiteLogger, serverCleanups} = params;

  if (!options.serverRunner) {
    suiteLogger('error', `Cannot start server '${node.path}': no server runner provided`);
    return {success: false};
  }

  const serverFilePath = resolveRelativeTo(node.path, bundle.rootSuitePath);
  const display = basename(serverFilePath || node.path);

  try {
    suiteLogger('info', `Starting server: ${display}`);
    const cleanup = await options.serverRunner(node.path, serverFilePath);
    serverCleanups.push(cleanup);
    suiteLogger('info', `Server started: ${display}`);
    return {success: true};
  } catch (e: any) {
    const errorMessage = e?.message || String(e);
    suiteLogger('error', `Failed to start server '${display}': ${errorMessage}`);
    return {success: false};
  }
}

export async function executeSuiteBundle(params: {
  bundle: SuiteBundle;
  options: RunFileOptions;
  preLogs: {level: LogLevel; message: string}[];
  runFile: (options: RunFileOptions) => Promise<RunFileResult>;
}): Promise<RunFileResult> {
  const {bundle, options, preLogs, runFile} = params;

  // Prevent nested suite bundle executions from emitting suite-run lifecycle.
  const shouldEmitSuiteRunEvents = !(options.__mmtIsSuiteBundleChildRun);

  // Create a collecting reporter wrapper when exports are configured (root-only).
  const hasExports = shouldEmitSuiteRunEvents && Array.isArray(bundle.export) && bundle.export.length > 0;
  let collectingReporter: ReturnType<typeof createReportCollector> | undefined;

  // Use wrapped reporter if collecting, otherwise use original
  let effectiveOptions: RunFileOptions;
  if (hasExports) {
    collectingReporter = createReportCollector();
    const wrappedReporter = (message: RunReporterMessage): void => {
      collectingReporter!.reporter(message);
      options.reporter(message);
    };
    effectiveOptions = {...options, reporter: wrappedReporter};
  } else {
    effectiveOptions = options;
  }

  const suiteDisplayName = basename(bundle.rootSuitePath);
  const identifier = sanitizeIdentifier(suiteDisplayName);

  const allLogs: string[] = [];
  const allErrors: string[] = [];
  const suiteStart = Date.now();

  const suiteLogger = (level: LogLevel, msg: string) => {
    allLogs.push(String(msg));
    if (level === 'error') {
      allErrors.push(String(msg));
    }
    options.logger(level, msg);
  };

  const target = typeof bundle.target === 'string' && bundle.target ? bundle.target : undefined;
  const root = target ? findNodeById(bundle.bundle, target) : undefined;
  if (target && !root) {
    throw new Error(`Suite target not found in bundle: ${target}`);
  }

  const rootChildren = root && (root.kind === 'group' || root.kind === 'suite')
    ? root.children
    : root
      ? [root]
      : bundle.bundle;
  const totalRunnable = collectRunnableCountFromRoot(rootChildren);

  if (shouldEmitSuiteRunEvents) {
    effectiveOptions.reporter && effectiveOptions.reporter({
      scope: 'suite-run-start',
      runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
      suitePath: bundle.rootSuitePath,
      suiteTitle: bundle.rootTitle,
      startedAt: suiteStart,
      totalRunnable,
    });
  }

  let overallSuccess = true;

  // Capture the original loader so child loaders never recurse through an overridden loader.
  const baseFileLoader = options.fileLoader;

  // Track cleanup functions for servers started during this suite run.
  const serverCleanups: ServerCleanup[] = [];

  let flatIndex = 0;
  const nextIndex = () => {
    const idx = flatIndex;
    flatIndex += 1;
    return idx;
  };

  const runNodesSequentially = async (nodes: readonly SuiteBundleNode[]) => {
    for (const n of nodes) {
      if (effectiveOptions.abortSignal?.aborted) {
        suiteLogger('warn', 'Suite run cancelled.');
        overallSuccess = false;
        return;
      }

      if (n.kind === 'group') {
        const group = await runSuiteGroup({
          node: n,
          bundle,
          options: effectiveOptions,
          runFile,
          suiteLogger,
          baseFileLoader,
          nextIndex,
          serverCleanups,
        });
        if (!group.overallSuccess) {
          overallSuccess = false;
        }
        if (group.anyThrew) {
          return;
        }
        continue;
      }

      if (n.kind === 'server') {
        const serverResult = await startServerNode({
          node: n,
          bundle,
          options: effectiveOptions,
          suiteLogger,
          serverCleanups,
        });
        if (!serverResult.success) {
          overallSuccess = false;
          // Server startup failure stops the suite (treat like throw).
          return;
        }
        continue;
      }

      if (n.kind === 'test' || n.kind === 'suite') {
        const r = await runSuiteBundleNode({
          node: n,
          bundle,
          options: effectiveOptions,
          runFile,
          suiteLogger,
          baseFileLoader,
          nextIndex,
        });
        if (!r.success) {
          overallSuccess = false;
        }
        if (r.threw) {
          return;
        }
        continue;
      }

      // missing/cycle are ignored.
    }
  };

  try {
    // Start suite-level servers (from the `servers:` field) before running tests.
    // These servers remain running for the entire suite duration and are cleaned up in `finally`.
    if (shouldEmitSuiteRunEvents && Array.isArray(bundle.servers) && bundle.servers.length > 0) {
      for (const serverPath of bundle.servers) {
        if (options.abortSignal?.aborted) {
          suiteLogger('warn', 'Suite run cancelled before servers could start.');
          overallSuccess = false;
          break;
        }
        const resolvedPath = resolveRelativeTo(serverPath, bundle.rootSuitePath);
        const display = basename(resolvedPath || serverPath);
        if (!options.serverRunner) {
          suiteLogger('error', `Cannot start server '${display}': no server runner provided`);
          overallSuccess = false;
          break;
        }
        try {
          suiteLogger('info', `Starting suite server: ${display}`);
          const cleanup = await options.serverRunner(serverPath, resolvedPath);
          serverCleanups.push(cleanup);
          // Register the server so tests with `run: mock` won't try to start a duplicate.
          // Register with both the alias and resolved path since tests might use either.
          registerServer_(serverPath, cleanup);
          if (resolvedPath && resolvedPath !== serverPath) {
            registerServer_(resolvedPath, cleanup);
          }
          suiteLogger('info', `Suite server started: ${display}`);
        } catch (e: any) {
          const errorMessage = e?.message || String(e);
          suiteLogger('error', `Failed to start suite server '${display}': ${errorMessage}`);
          overallSuccess = false;
          break;
        }
      }
    }

    if (overallSuccess) {
      if (root && (root.kind === 'group' || root.kind === 'suite')) {
        await runNodesSequentially(root.children);
      } else if (root) {
        await runNodesSequentially([root]);
      } else {
        await runNodesSequentially(bundle.bundle);
      }
    }
  } finally {
    // Stop all servers started during this suite run (from `servers:` field).
    for (const cleanup of serverCleanups) {
      try {
        cleanup();
      } catch (e: any) {
        suiteLogger('warn', `Error stopping server: ${e?.message || String(e)}`);
      }
    }
    // Stop any servers started via `run: mock` steps in child tests.
    // Only do this at the top-level suite run (not nested suite children).
    if (shouldEmitSuiteRunEvents) {
      try {
        stopAllServers_();
      } catch (e: any) {
        suiteLogger('warn', `Error stopping servers: ${e?.message || String(e)}`);
      }
    }
  }

  const durationMs = Date.now() - suiteStart;
  const result: RunResult = {
    success: overallSuccess,
    durationMs,
    errors: allErrors,
    logs: allLogs,
  };

  if (shouldEmitSuiteRunEvents) {
    effectiveOptions.reporter && effectiveOptions.reporter({
      scope: 'suite-run-finished',
      runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
      suitePath: bundle.rootSuitePath,
      finishedAt: Date.now(),
      success: overallSuccess,
      durationMs,
      cancelled: effectiveOptions.abortSignal?.aborted === true,
    });
  }

  if (preLogs.length) {
    result.logs = [...preLogs.map((l) => l.message), ...(result.logs ?? [])];
  }

  // Build suite exports if configured
  let suiteExports: SuiteExportSpec | undefined;
  if (hasExports && collectingReporter && bundle.export) {
    suiteExports = {
      paths: bundle.export,
      collectedResults: collectingReporter.getResults(),
    };
  }

  return {
    js: '',
    result,
    identifier,
    displayName: suiteDisplayName,
    docType: 'suite',
    inputsUsed: options.manualInputs || {},
    envVarsUsed: options.envvar || {},
    suiteExports,
  };
}
