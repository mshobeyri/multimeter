import {LogLevel} from './CommonData';
import {basename, detectDocType, resolveRelativeTo, RunFileResult, sanitizeIdentifier} from './runCommon';
import {RunFileOptions, RunResult, SuiteStepStatus} from './runConfig';
import {SuiteBundle, SuiteBundleNode} from './suiteBundle';

type RunnableSuiteBundleNode =
  | Extract<SuiteBundleNode, {kind: 'suite'}>
  | Extract<SuiteBundleNode, {kind: 'test'}>;

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

function collectRunnableNodesFromRoot(root: SuiteBundleNode | readonly SuiteBundleNode[]): RunnableSuiteBundleNode[] {
  const out: RunnableSuiteBundleNode[] = [];
  const walk = (n: SuiteBundleNode) => {
    if (n.kind === 'test' || n.kind === 'suite') {
      out.push(n);
    }
    if (n.kind === 'group' || n.kind === 'suite') {
      for (const c of n.children) {
        walk(c);
      }
    }
  };
  if (Array.isArray(root)) {
    for (const n of root) {
      walk(n);
    }
  } else {
    walk(root as SuiteBundleNode);
  }
  return out;
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

  const runnable = collectRunnableNodesFromRoot(root ? root : bundle.bundle);
  const selected = runnable;

  

  if (shouldEmitSuiteRunEvents) {
    options.reporter && options.reporter({
      scope: 'suite-run-start',
      runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
      suitePath: bundle.rootSuitePath,
      startedAt: suiteStart,
      totalRunnable: selected.length,
    } as any);
  }

  let overallSuccess = true;

  // Capture the original loader so child loaders never recurse through an overridden loader.
  const baseFileLoader = options.fileLoader;

  for (let i = 0; i < selected.length; i++) {
    if (options.abortSignal?.aborted) {
      suiteLogger('warn', 'Suite run cancelled.');
      overallSuccess = false;
      break;
    }

    const node = selected[i];
    const childFilePath = resolveRelativeTo(node.path, bundle.rootSuitePath);
    const display = basename(childFilePath || node.path);
    const runId = `suite:${sanitizeIdentifier(bundle.rootSuitePath)}:${i}:${sanitizeIdentifier(childFilePath || node.path)}`;
    const id = (node as any).id as string | undefined;

    try {
      const childRawText = await baseFileLoader(childFilePath);
      const childDocType = detectDocType(childFilePath, childRawText);

      suiteLogger('info', `Running suite item: ${display}`);
      const childFileLoader = async (requestedPath: string) => {
        const resolved = resolveRelativeTo(requestedPath, childFilePath);
        return await baseFileLoader(resolved);
      };

      // For bundle runs we avoid emitting positional group indexes because
      // selected[] is a filtered list and its indices do not match the original
      // suite group's item indexes. UI should rely on `id` for routing.
      //
      // If the selected node is itself a suite, we execute its existing bundle
      // subtree (node.children) as a nested bundle instead of re-running the
      // suite file via runFile. This keeps ids/items stable.
      if (childDocType !== 'suite') {
        options.reporter && options.reporter({
          scope: 'suite-item',
          status: 'running',
          runId,
          filePath: childFilePath,
          entry: node.path,
          docType: childDocType ?? undefined,
          id,
        } as any);
      }

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

      const childRun = node.kind === 'suite' ?
        await executeSuiteBundle({
          bundle: {
            rootSuitePath: childFilePath,
            bundle: node.children,
            target: undefined,
          },
          options: childRunOptions,
          preLogs: [],
          runFile,
        }) :
        await runFile(childRunOptions);

      const status: SuiteStepStatus = childRun.result?.success ? 'passed' : 'failed';
      if (status === 'failed') {
        overallSuccess = false;
      }

      if (childDocType !== 'suite') {
        options.reporter && options.reporter({
          scope: 'suite-item',
          status,
          runId,
          filePath: childFilePath,
          entry: node.path,
          docType: childDocType ?? undefined,
          id,
        } as any);
      }
    } catch (e: any) {
      overallSuccess = false;
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
