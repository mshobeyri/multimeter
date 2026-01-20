import {LogLevel} from './CommonData';
import {basename, detectDocType, resolveRelativeTo, RunFileResult, sanitizeIdentifier} from './runCommon';
import {RunFileOptions, RunResult, SuiteStepStatus} from './runConfig';
import {SuiteBundle, SuiteBundleNode} from './suiteBundle';

function findNodeById(nodes: readonly SuiteBundleNode[], targetId: string): SuiteBundleNode|undefined {
  const stack: SuiteBundleNode[] = [...nodes];
  while (stack.length) {
    const n = stack.pop()!;
    if ((n as any).id === targetId) {
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

async function runSuiteTest(params: {
  node: Extract<SuiteBundleNode, {kind: 'test'}>;
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
  const suiteRunNonce = typeof (options as any)?.suiteRunId === 'string' ? (options as any).suiteRunId : '';
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
      docType: childDocType ?? undefined,
      id,
    } as any);

    const childRunOptions: RunFileOptions = {
      ...options,
      file: childRawText,
      fileType: 'raw' as any,
      filePath: childFilePath,
      fileLoader: childFileLoader,
      logger: suiteLogger,
      runId,
      id,
      __mmtIsSuiteBundleChildRun: true,
    } as any;

    const childRun = await runFile(childRunOptions);
    const status: SuiteStepStatus = childRun.result?.success ? 'passed' : 'failed';

    options.reporter && options.reporter({
      scope: 'suite-item',
      status,
      runId,
      filePath: childFilePath,
      entry: node.path,
      docType: childDocType ?? undefined,
      id,
    } as any);

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
      id,
    } as any);

    return {success: false, threw: true, status: 'failed'};
  }
}

async function runSuiteSuite(params: {
  node: Extract<SuiteBundleNode, {kind: 'suite'}>;
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
  const suiteRunNonce = typeof (options as any)?.suiteRunId === 'string' ? (options as any).suiteRunId : '';
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
      docType: childDocType ?? undefined,
      id,
    } as any);

    const childRunOptions: RunFileOptions = {
      ...options,
      file: childRawText,
      fileType: 'raw' as any,
      filePath: childFilePath,
      fileLoader: childFileLoader,
      logger: suiteLogger,
      runId,
      id,
      __mmtIsSuiteBundleChildRun: true,
    } as any;

    const childRun = await executeSuiteBundle({
      bundle: {
        rootSuitePath: childFilePath,
        bundle: node.children,
        target: undefined,
      },
      options: childRunOptions,
      preLogs: [],
      runFile,
    });

    const status: SuiteStepStatus = childRun.result?.success ? 'passed' : 'failed';
    options.reporter && options.reporter({
      scope: 'suite-item',
      status,
      runId,
      filePath: childFilePath,
      entry: node.path,
      docType: childDocType ?? undefined,
      id,
    } as any);

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
      id,
    } as any);

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
}): Promise<{overallSuccess: boolean; anyThrew: boolean}> {
  const {node, bundle, options, runFile, suiteLogger, baseFileLoader, nextIndex} = params;

  const results = await Promise.all(node.children.map(async (child) => {
    if (options.abortSignal?.aborted) {
      return {success: false, threw: false, status: 'failed' as SuiteStepStatus};
    }

    if (child.kind === 'test') {
      return await runSuiteTest({
        node: child,
        bundle,
        options,
        runFile,
        suiteLogger,
        baseFileLoader,
        nextIndex,
      });
    }

    if (child.kind === 'suite') {
      return await runSuiteSuite({
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
      // Nested group: runs sequentially relative to sibling runnable items by executing it inline.
      // This mirrors the "sequential groups" semantics.
      const childGroup = await runSuiteGroup({
        node: child,
        bundle,
        options,
        runFile,
        suiteLogger,
        baseFileLoader,
        nextIndex,
      });
      return {success: childGroup.overallSuccess, threw: childGroup.anyThrew, status: childGroup.overallSuccess ? 'passed' as SuiteStepStatus : 'failed' as SuiteStepStatus};
    }

    // missing/cycle are not runnable.
    return {success: true, threw: false, status: 'passed' as SuiteStepStatus};
  }));

  const groupHadAnyFailure = results.some(r => !r || !r.success);
  const groupThrew = results.some(r => !!r && r.threw === true);

  return {overallSuccess: !groupHadAnyFailure, anyThrew: groupThrew};
}

export async function executeSuiteBundle(params: {
  bundle: SuiteBundle;
  options: RunFileOptions;
  preLogs: {level: LogLevel; message: string}[];
  runFile: (options: RunFileOptions) => Promise<RunFileResult>;
}): Promise<RunFileResult> {
  const {bundle, options, preLogs, runFile} = params;

  // Prevent nested suite bundle executions from emitting suite-run lifecycle.
  const shouldEmitSuiteRunEvents = !((options as any).__mmtIsSuiteBundleChildRun);

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
    options.reporter && options.reporter({
      scope: 'suite-run-start',
      runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
      suitePath: bundle.rootSuitePath,
      startedAt: suiteStart,
      totalRunnable,
    } as any);
  }

  let overallSuccess = true;

  // Capture the original loader so child loaders never recurse through an overridden loader.
  const baseFileLoader = options.fileLoader;

  let flatIndex = 0;
  const nextIndex = () => {
    const idx = flatIndex;
    flatIndex += 1;
    return idx;
  };

  const runNodesSequentially = async (nodes: readonly SuiteBundleNode[]) => {
    for (const n of nodes) {
      if (options.abortSignal?.aborted) {
        suiteLogger('warn', 'Suite run cancelled.');
        overallSuccess = false;
        return;
      }

      if (n.kind === 'group') {
        const group = await runSuiteGroup({
          node: n,
          bundle,
          options,
          runFile,
          suiteLogger,
          baseFileLoader,
          nextIndex,
        });
        if (!group.overallSuccess) {
          overallSuccess = false;
        }
        if (group.anyThrew) {
          return;
        }
        continue;
      }

      if (n.kind === 'test') {
        const r = await runSuiteTest({
          node: n,
          bundle,
          options,
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

      if (n.kind === 'suite') {
        const r = await runSuiteSuite({
          node: n,
          bundle,
          options,
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

  if (root && (root.kind === 'group' || root.kind === 'suite')) {
    await runNodesSequentially(root.children);
  } else if (root) {
    await runNodesSequentially([root]);
  } else {
    await runNodesSequentially(bundle.bundle);
  }

  const durationMs = Date.now() - suiteStart;
  const result: RunResult = {
    success: overallSuccess,
    durationMs,
    errors: allErrors,
    logs: allLogs,
  };

  if (shouldEmitSuiteRunEvents) {
    options.reporter && options.reporter({
      scope: 'suite-run-finished',
      runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
      suitePath: bundle.rootSuitePath,
      finishedAt: Date.now(),
      success: overallSuccess,
      durationMs,
      cancelled: options.abortSignal?.aborted === true,
    } as any);
  }

  if (preLogs.length) {
    result.logs = [...preLogs.map((l) => l.message), ...(result.logs ?? [])];
  }

  return {
    js: '',
    result,
    identifier,
    displayName: suiteDisplayName,
    docType: 'suite',
    inputsUsed: options.manualInputs || {},
    envVarsUsed: options.envvar || {},
  };
}
