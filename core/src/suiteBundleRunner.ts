import {LogLevel} from './CommonData';
import {basename, detectDocType, resolveRelativeTo, RunFileResult, sanitizeIdentifier} from './runCommon';
import {RunFileOptions, RunResult, SuiteStepStatus} from './runConfig';
import {SuiteBundle, SuiteBundleNode} from './suiteBundle';

type RunnableSuiteBundleNode =
  | Extract<SuiteBundleNode, {kind: 'suite'}>
  | Extract<SuiteBundleNode, {kind: 'test'}>;

function collectRunnableLeafNodes(nodes: readonly SuiteBundleNode[]): RunnableSuiteBundleNode[] {
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
  for (const n of nodes) {
    walk(n);
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

  const runnable = collectRunnableLeafNodes(bundle.nodes);
  const targets = Array.isArray(options.suiteTargets) && options.suiteTargets.length ? new Set(options.suiteTargets) : null;
  const selected = targets ? runnable.filter((n) => targets.has(n.leafId)) : runnable;

  options.reporter && options.reporter({
    scope: 'suite-run-start',
    runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
    suitePath: bundle.rootSuitePath,
    startedAt: suiteStart,
    totalRunnable: selected.length,
  } as any);

  let overallSuccess = true;

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

    try {
      const childRawText = await options.fileLoader(childFilePath);
      const childDocType = detectDocType(childFilePath, childRawText);

      options.reporter && options.reporter({
        scope: 'suite-item',
        status: 'running',
        groupIndex: 0,
        groupItemIndex: i,
        runId,
        filePath: childFilePath,
        entry: node.path,
        docType: childDocType ?? undefined,
        leafId: node.leafId,
      } as any);

      suiteLogger('info', `Running suite item: ${display}`);
      const childFileLoader = async (requestedPath: string) => {
        const resolved = resolveRelativeTo(requestedPath, childFilePath);
        return await options.fileLoader(resolved);
      };

      const childRun = await runFile({
        ...options,
        file: childRawText,
        fileType: 'raw',
        filePath: childFilePath,
        fileLoader: childFileLoader,
        logger: suiteLogger,
        leafId: node.leafId,
      } as any);

      const status: SuiteStepStatus = childRun.result?.success ? 'passed' : 'failed';
      if (status === 'failed') {
        overallSuccess = false;
      }

      options.reporter && options.reporter({
        scope: 'suite-item',
        status,
        groupIndex: 0,
        groupItemIndex: i,
        runId,
        filePath: childFilePath,
        entry: node.path,
        docType: childDocType ?? undefined,
        leafId: node.leafId,
      } as any);
    } catch (e: any) {
      overallSuccess = false;
      const errorMessage = e?.message || String(e);
      suiteLogger('error', `Failed to run suite item: ${display} - ${errorMessage}`);

      options.reporter && options.reporter({
        scope: 'suite-item',
        status: 'failed',
        groupIndex: 0,
        groupItemIndex: i,
        runId,
        filePath: childFilePath,
        entry: node.path,
        leafId: node.leafId,
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

  options.reporter && options.reporter({
    scope: 'suite-run-finished',
    runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
    suitePath: bundle.rootSuitePath,
    finishedAt: Date.now(),
    success: overallSuccess,
    durationMs,
    cancelled: options.abortSignal?.aborted === true,
  } as any);

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
