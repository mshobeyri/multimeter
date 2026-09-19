import {LogLevel} from './CommonData';
import {createReportCollector, CollectedResults} from './reportCollector';
import {basename, detectDocType, resolveRelativeTo, RunFileResult, sanitizeIdentifier, SuiteExportSpec} from './runCommon';
import {RunFileOptions, RunReporterMessage, RunResult, SuiteStepStatus} from './runConfig';
import {logRunFinished} from './runLog';
import {SuiteBundle, SuiteBundleNode} from './suiteBundle';
import {
  classifySuiteItemStatus,
  worstSuiteItemStatus,
} from './suiteItemStatus';
import {
  decideTagRun,
  mergeTagFilter,
  tagFilterFromYaml,
  type TagFilter,
} from './suiteTagFilter';
import {beginServerSession_, clearTestCallCache_, endServerSession_, ensureServerStarted_} from './testHelper';

function resolveSuitePath(targetPath: string, baseFilePath: string, options: RunFileOptions): string {
  return resolveRelativeTo(targetPath, baseFilePath, options.projectRoot);
}

async function startListedServers(params: {
  servers: readonly string[];
  baseFilePath: string;
  options: RunFileOptions;
  suiteLogger: (level: LogLevel, msg: string) => void;
}): Promise<boolean> {
  const {servers, baseFilePath, options, suiteLogger} = params;
  for (const serverPath of servers) {
    if (options.abortSignal?.aborted) {
      suiteLogger('warn', 'Suite run cancelled before servers could start.');
      return false;
    }
    const resolvedPath = resolveSuitePath(serverPath, baseFilePath, options);
    const display = basename(resolvedPath || serverPath);
    if (!options.serverRunner) {
      suiteLogger('error', `Cannot start server '${display}': no server runner provided`);
      return false;
    }
    try {
      const outcome = await ensureServerStarted_([serverPath, resolvedPath], () =>
        options.serverRunner!(serverPath, resolvedPath));
      if (outcome === 'already-running') {
        suiteLogger('info', `Server already running: ${display}`);
      } else {
        suiteLogger('info', `Suite server started: ${display}`);
      }
    } catch (e: any) {
      const errorMessage = e?.message || String(e);
      suiteLogger('error', `Failed to start suite server '${display}': ${errorMessage}`);
      return false;
    }
  }
  return true;
}

function reportUnresolvedSuiteNode(params: {
  node: Extract<SuiteBundleNode, {kind: 'missing'|'cycle'}>;
  bundle: SuiteBundle;
  options: RunFileOptions;
  suiteLogger: (level: LogLevel, msg: string) => void;
  nextIndex: () => number;
}): {success: boolean; threw: boolean; cancelled: boolean; status: SuiteStepStatus} {
  const {node, bundle, options, suiteLogger, nextIndex} = params;
  const currentIndex = nextIndex();
  const display = basename(node.path);
  const suiteRunNonce = typeof options.suiteRunId === 'string' ? options.suiteRunId : '';
  const runId =
      `suite:${sanitizeIdentifier(bundle.rootSuitePath)}:${suiteRunNonce}:${currentIndex}:${sanitizeIdentifier(node.path)}`;
  const reason = node.kind === 'missing' ? 'File not found' : 'Circular suite reference';

  suiteLogger('error', `${reason}: ${display}`);

  options.reporter && options.reporter({
    scope: 'suite-item',
    status: 'running',
    runId,
    filePath: node.path,
    entry: node.path,
    title: display,
    id: node.id,
  });
  options.reporter && options.reporter({
    scope: 'suite-item',
    status: 'invalid',
    runId,
    filePath: node.path,
    entry: node.path,
    title: display,
    id: node.id,
  });

  return {success: false, threw: false, cancelled: false, status: 'invalid'};
}

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

function activeTagFilter(options: RunFileOptions, bundle: SuiteBundle): TagFilter {
  if (options.tagFilter) {
    return options.tagFilter;
  }
  if (!options.__mmtIsSuiteBundleChildRun) {
    return tagFilterFromYaml(bundle.filter);
  }
  return {};
}

function nodeHasRunnable(
    node: SuiteBundleNode, filter: TagFilter, parentSelected: boolean): boolean {
  if (node.kind === 'test') {
    return decideTagRun('test', node.tags, filter, parentSelected) === 'run';
  }
  if (node.kind === 'suite') {
    const decision = decideTagRun('suite', node.tags, filter, parentSelected);
    if (decision === 'skip') {
      return false;
    }
    if (decision === 'run') {
      return true;
    }
    return node.children.some((child) => nodeHasRunnable(child, filter, false));
  }
  if (node.kind === 'group') {
    return node.children.some((child) => nodeHasRunnable(child, filter, parentSelected));
  }
  return false;
}

function nodesHaveRunnable(
    nodes: readonly SuiteBundleNode[], filter: TagFilter, parentSelected: boolean): boolean {
  return nodes.some((node) => nodeHasRunnable(node, filter, parentSelected));
}

function reportSkippedBundleNode(params: {
  node: Extract<SuiteBundleNode, {kind: 'test'}| {kind: 'suite'}| {kind: 'group'}>;
  bundle: SuiteBundle;
  options: RunFileOptions;
  nextIndex: () => number;
}): {success: boolean; threw: boolean; cancelled: boolean; status: SuiteStepStatus} {
  const {node, bundle, options, nextIndex} = params;
  const currentIndex = nextIndex();
  const suiteRunNonce = typeof options.suiteRunId === 'string' ? options.suiteRunId : '';
  const filePath = node.kind === 'group' ? bundle.rootSuitePath : resolveSuitePath(node.path, bundle.rootSuitePath, options);
  const title = node.kind === 'group'
    ? (typeof node.label === 'string' && node.label.trim() ? node.label.trim() : node.id)
    : (typeof node.title === 'string' && node.title.trim() ? node.title.trim() : basename(filePath || node.path));
  const runId =
      `suite:${sanitizeIdentifier(bundle.rootSuitePath)}:${suiteRunNonce}:${currentIndex}:${sanitizeIdentifier(node.id)}`;
  options.reporter && options.reporter({
    scope: 'suite-item',
    status: 'skipped',
    runId,
    filePath,
    entry: node.kind === 'group' ? node.label : node.path,
    title,
    docType: node.kind === 'suite' ? 'suite' : node.kind === 'test' ? 'test' : undefined,
    id: node.id,
  });
  if (node.kind === 'suite' || node.kind === 'group') {
    for (const child of node.children) {
      if (child.kind === 'test' || child.kind === 'suite' || child.kind === 'group') {
        reportSkippedBundleNode({node: child, bundle, options, nextIndex});
      }
    }
  }
  return {success: true, threw: false, cancelled: false, status: 'skipped'};
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
  /** When true, buffer child logs and flush them grouped after the item finishes. */
  bufferChildLogs?: boolean;
}): Promise<{success: boolean; threw: boolean; cancelled: boolean; status: SuiteStepStatus}> {
  const {node, bundle, options, runFile, suiteLogger, baseFileLoader, nextIndex, bufferChildLogs} = params;

  const filter = activeTagFilter(options, bundle);
  const parentSelected = options.tagParentSelected === true;
  const decision = decideTagRun(node.kind, node.tags, filter, parentSelected);
  if (decision === 'skip') {
    return reportSkippedBundleNode({node, bundle, options, nextIndex});
  }

  const currentIndex = nextIndex();
  const childFilePath = resolveSuitePath(node.path, bundle.rootSuitePath, options);
  const nodeTitle =
      typeof (node as any).title === 'string' && (node as any).title.trim() ?
      (node as any).title.trim() :
      undefined;
  // Prefer YAML title over filename (same priority as tests).
  const display = nodeTitle || basename(childFilePath || node.path);
  // Include a suite-run nonce so repeating the suite reuses no runIds.
  const suiteRunNonce = typeof options.suiteRunId === 'string' ? options.suiteRunId : '';
  const runId = `suite:${sanitizeIdentifier(bundle.rootSuitePath)}:${suiteRunNonce}:${currentIndex}:${sanitizeIdentifier(childFilePath || node.path)}`;
  const id = node.id;

  // When running in parallel, buffer child logs so output is grouped per file.
  const logBuffer: Array<{level: LogLevel; msg: string}> = [];
  const childLogger: (level: LogLevel, msg: string) => void = bufferChildLogs
    ? (level, msg) => { logBuffer.push({level, msg}); }
    : suiteLogger;

  const flushLogBuffer = () => {
    for (const entry of logBuffer) {
      suiteLogger(entry.level, entry.msg);
    }
    logBuffer.length = 0;
  };

  try {
    const childRawText = await baseFileLoader(childFilePath);
    const childDocType = detectDocType(childFilePath, childRawText);

    childLogger('debug', `Running suite item: ${display}`);
    const childFileLoader = async (requestedPath: string) => {
      const resolved = resolveSuitePath(requestedPath, childFilePath, options);
      return await baseFileLoader(resolved);
    };
    const childBinaryFileLoader = options.binaryFileLoader
      ? async (requestedPath: string) => {
          const resolved = resolveSuitePath(requestedPath, childFilePath, options);
          return await options.binaryFileLoader!(resolved);
        }
      : undefined;

    options.reporter && options.reporter({
      scope: 'suite-item',
      status: 'running',
      runId,
      filePath: childFilePath,
      entry: node.path,
      title: nodeTitle || (node as any).title,
      docType: childDocType ?? undefined,
      id,
    });

    const childRunOptions: RunFileOptions = {
      ...options,
      file: childRawText,
      fileType: 'raw',
      filePath: childFilePath,
      fileLoader: childFileLoader,
      binaryFileLoader: childBinaryFileLoader,
      logger: childLogger,
      runId,
      id,
      __mmtIsSuiteBundleChildRun: true,
    };

    let childRun: RunFileResult;
    if (node.kind === 'test') {
      childRun = await runFile(childRunOptions);
    } else {
      const nestedFilter = decision === 'run'
        ? mergeTagFilter(filter, tagFilterFromYaml(node.filter))
        : filter;
      childRun = await executeSuiteBundle({
        bundle: {
          rootSuitePath: childFilePath,
          rootTitle: nodeTitle,
          bundle: node.children,
          servers: node.servers,
          filter: node.filter,
          target: undefined,
        },
        options: {
          ...childRunOptions,
          tagFilter: nestedFilter,
          tagParentSelected: decision === 'run',
        },
        preLogs: [],
        runFile,
      });
    }

    // Flush buffered logs now that the child is done.
    flushLogBuffer();

    const status: SuiteStepStatus = classifySuiteItemStatus(childRun.result);

    options.reporter && options.reporter({
      scope: 'suite-item',
      status,
      runId,
      filePath: childFilePath,
      entry: node.path,
      title: nodeTitle || (node as any).title,
      docType: childDocType ?? undefined,
      id,
    });

    return {
      success: status === 'passed' || status === 'skipped',
      threw: status === 'invalid' || childRun.result?.threw === true,
      cancelled: childRun.result?.cancelled === true,
      status,
    };
  } catch (e: any) {
    flushLogBuffer();
    const errorMessage = e?.message || String(e);
    // Unusable item or unexpected runner exception → invalid (warning).
    const status: SuiteStepStatus = 'invalid';
    suiteLogger('error', `Failed to run suite item: ${display} - ${errorMessage}`);

    options.reporter && options.reporter({
      scope: 'suite-item',
      status,
      runId,
      filePath: childFilePath,
      entry: node.path,
      title: nodeTitle || (node as any).title,
      id,
    });

    return {success: false, threw: true, cancelled: false, status};
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
}): Promise<{overallSuccess: boolean; anyThrew: boolean; anyCancelled: boolean; statuses: SuiteStepStatus[]}> {
  const {node, bundle, options, runFile, suiteLogger, baseFileLoader, nextIndex} = params;

  const isParallel = node.children.length > 1;
  const suiteRunNonce = typeof options.suiteRunId === 'string' ? options.suiteRunId : '';
  const groupRunId =
      `suite:${sanitizeIdentifier(bundle.rootSuitePath)}:${suiteRunNonce}:group:${sanitizeIdentifier(node.id)}`;
  const groupTitle = typeof node.label === 'string' && node.label.trim() ? node.label.trim() : node.id;

  options.reporter && options.reporter({
    scope: 'suite-item',
    status: 'running',
    runId: groupRunId,
    filePath: bundle.rootSuitePath,
    entry: node.label,
    title: groupTitle,
    id: node.id,
  });

  const serverChildren = node.children.filter(
      (child): child is Extract<SuiteBundleNode, {kind: 'server'}> => child.kind === 'server');
  const otherChildren = node.children.filter((child) => child.kind !== 'server');
  const serverStatuses: SuiteStepStatus[] = [];

  for (const child of serverChildren) {
    if (options.abortSignal?.aborted) {
      return {
        overallSuccess: false,
        anyThrew: false,
        anyCancelled: true,
        statuses: [...serverStatuses, 'failed'],
      };
    }
    const serverResult = await startServerNode({
      node: child,
      bundle,
      options,
      suiteLogger,
    });
    if (!serverResult.success) {
      serverStatuses.push('invalid');
      options.reporter && options.reporter({
        scope: 'suite-item',
        status: 'invalid',
        runId: groupRunId,
        filePath: bundle.rootSuitePath,
        entry: node.label,
        title: groupTitle,
        id: node.id,
      });
      return {
        overallSuccess: false,
        anyThrew: false,
        anyCancelled: false,
        statuses: serverStatuses,
      };
    }
    serverStatuses.push('passed');
  }

  // Nested `servers:` start before other items in this stage so parallel
  // siblings can use the public running-server list.
  const filter = activeTagFilter(options, bundle);
  const parentSelected = options.tagParentSelected === true;
  for (const child of otherChildren) {
    if (child.kind !== 'suite' || !Array.isArray(child.servers) || child.servers.length === 0) {
      continue;
    }
    if (decideTagRun('suite', child.tags, filter, parentSelected) === 'skip') {
      continue;
    }
    if (options.abortSignal?.aborted) {
      return {
        overallSuccess: false,
        anyThrew: false,
        anyCancelled: true,
        statuses: serverStatuses,
      };
    }
    const nestedPath = resolveSuitePath(child.path, bundle.rootSuitePath, options) || child.path;
    const started = await startListedServers({
      servers: child.servers,
      baseFilePath: nestedPath,
      options,
      suiteLogger,
    });
    if (!started) {
      options.reporter && options.reporter({
        scope: 'suite-item',
        status: 'invalid',
        runId: groupRunId,
        filePath: bundle.rootSuitePath,
        entry: node.label,
        title: groupTitle,
        id: node.id,
      });
      return {
        overallSuccess: false,
        anyThrew: false,
        anyCancelled: false,
        statuses: [...serverStatuses, 'invalid'],
      };
    }
  }

  const results = await Promise.all(otherChildren.map(async (child) => {
    if (options.abortSignal?.aborted) {
      return {success: false, threw: false, cancelled: true, status: 'failed' as SuiteStepStatus};
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
        bufferChildLogs: isParallel,
      });
    }

    if (child.kind === 'group') {
      const childGroup = await runSuiteGroup({
        node: child,
        bundle,
        options,
        runFile,
        suiteLogger,
        baseFileLoader,
        nextIndex,
      });
      const status = childGroup.statuses.length > 0
        ? worstSuiteItemStatus(childGroup.statuses)
        : (childGroup.overallSuccess ? 'passed' as SuiteStepStatus : 'failed' as SuiteStepStatus);
      return {
        success: childGroup.overallSuccess,
        threw: childGroup.anyThrew,
        cancelled: childGroup.anyCancelled,
        status,
      };
    }

    if (child.kind === 'missing' || child.kind === 'cycle') {
      return reportUnresolvedSuiteNode({
        node: child,
        bundle,
        options,
        suiteLogger,
        nextIndex,
      });
    }

    return {success: true, threw: false, cancelled: false, status: 'passed' as SuiteStepStatus};
  }));

  const groupHadAnyFailure = serverStatuses.includes('invalid') || results.some(r => !r || !r.success);
  const groupThrew = results.some(r => !!r && r.threw === true);
  const groupCancelled = results.some(r => !!r && (r as any).cancelled === true);
  const statuses = [...serverStatuses, ...results.map(r => r.status)];
  const groupStatus: SuiteStepStatus = statuses.length > 0
    ? worstSuiteItemStatus(statuses)
    : (!groupHadAnyFailure ? 'passed' : 'failed');

  options.reporter && options.reporter({
    scope: 'suite-item',
    status: groupStatus,
    runId: groupRunId,
    filePath: bundle.rootSuitePath,
    entry: node.label,
    title: groupTitle,
    id: node.id,
  });

  return {
    overallSuccess: !groupHadAnyFailure,
    anyThrew: groupThrew,
    anyCancelled: groupCancelled,
    statuses,
  };
}

async function startServerNode(params: {
  node: Extract<SuiteBundleNode, {kind: 'server'}>;
  bundle: SuiteBundle;
  options: RunFileOptions;
  suiteLogger: (level: LogLevel, msg: string) => void;
}): Promise<{success: boolean}> {
  const {node, bundle, options, suiteLogger} = params;

  const serverFilePath = resolveSuitePath(node.path, bundle.rootSuitePath, options);
  const display = basename(serverFilePath || node.path);

  if (!options.serverRunner) {
    suiteLogger('error', `Cannot start server '${node.path}': no server runner provided`);
    return {success: false};
  }

  try {
    const outcome = await ensureServerStarted_([node.path, serverFilePath], () =>
      options.serverRunner!(node.path, serverFilePath));
    if (outcome === 'already-running') {
      suiteLogger('info', `Server already running: ${display}`);
    } else {
      suiteLogger('info', `Server started: ${display}`);
    }
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
      if (options.reporter) {
        options.reporter(message);
      }
    };
    effectiveOptions = {...options, reporter: wrappedReporter};
  } else {
    effectiveOptions = options;
  }
  const resolvedFilter = activeTagFilter(effectiveOptions, bundle);
  effectiveOptions = {...effectiveOptions, tagFilter: resolvedFilter};

  const suiteDisplayName =
      (typeof bundle.rootTitle === 'string' && bundle.rootTitle.trim()) ?
      bundle.rootTitle.trim() :
      basename(bundle.rootSuitePath);
  const identifier = sanitizeIdentifier(suiteDisplayName);

  const allLogs: string[] = [];
  const allErrors: string[] = [];
  const suiteStart = Date.now();

  const suiteLogger = (level: LogLevel, msg: string) => {
    // Bound in-memory copies; the live logger still receives every line.
    if (allLogs.length < 20000) {
      allLogs.push(String(msg));
    }
    if (level === 'error' && allErrors.length < 2000) {
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
  const itemStatuses: SuiteStepStatus[] = [];

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
        });
        itemStatuses.push(...group.statuses);
        if (!group.overallSuccess) {
          overallSuccess = false;
        }
        // Only stop the suite for user-initiated abort, not for test
        // assertion failures which should be reported but not block others.
        if (group.anyCancelled) {
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
        });
        if (!serverResult.success) {
          overallSuccess = false;
          itemStatuses.push('invalid');
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
        itemStatuses.push(r.status);
        if (!r.success) {
          overallSuccess = false;
        }
        // Only stop the suite for user-initiated abort (cancelled), not for
        // test assertion failures or other test-level errors.
        if (r.cancelled) {
          return;
        }
        continue;
      }

      if (n.kind === 'missing' || n.kind === 'cycle') {
        const r = reportUnresolvedSuiteNode({
          node: n,
          bundle,
          options: effectiveOptions,
          suiteLogger,
          nextIndex,
        });
        itemStatuses.push(r.status);
        if (!r.success) {
          overallSuccess = false;
        }
        continue;
      }
    }
  };

  try {
    if (beginServerSession_()) {
      clearTestCallCache_();
    }
    // `servers:` start at the beginning of this suite (root or nested).
    if (Array.isArray(bundle.servers) && bundle.servers.length > 0 &&
        nodesHaveRunnable(
            rootChildren, resolvedFilter, effectiveOptions.tagParentSelected === true)) {
      const started = await startListedServers({
        servers: bundle.servers,
        baseFilePath: bundle.rootSuitePath,
        options: effectiveOptions,
        suiteLogger,
      });
      if (!started) {
        overallSuccess = false;
      }
    }

    if (overallSuccess) {
      if (root && (root.kind === 'group' || root.kind === 'suite')) {
        // Partial runs execute children only; still emit suite-item for the
        // targeted parent so the UI can update its group/suite status icon.
        const suiteRunNonce = typeof effectiveOptions.suiteRunId === 'string' ? effectiveOptions.suiteRunId : '';
        const targetRunId =
            `suite:${sanitizeIdentifier(bundle.rootSuitePath)}:${suiteRunNonce}:target:${sanitizeIdentifier(root.id)}`;
        const targetTitle = root.kind === 'suite'
          ? (
            typeof (root as any).title === 'string' && (root as any).title.trim()
              ? (root as any).title.trim()
              : basename(root.path)
          )
          : (typeof root.label === 'string' && root.label.trim() ? root.label.trim() : root.id);
        const targetFilePath = root.kind === 'suite'
          ? resolveSuitePath(root.path, bundle.rootSuitePath, effectiveOptions)
          : bundle.rootSuitePath;
        const targetEntry = root.kind === 'suite' ? root.path : root.label;

        effectiveOptions.reporter && effectiveOptions.reporter({
          scope: 'suite-item',
          status: 'running',
          runId: targetRunId,
          filePath: targetFilePath,
          entry: targetEntry,
          title: targetTitle,
          docType: root.kind === 'suite' ? 'suite' : undefined,
          id: root.id,
        });

        if (root.kind === 'suite' && Array.isArray(root.servers) && root.servers.length > 0) {
          const started = await startListedServers({
            servers: root.servers,
            baseFilePath: targetFilePath,
            options: effectiveOptions,
            suiteLogger,
          });
          if (!started) {
            overallSuccess = false;
          }
        }

        if (overallSuccess) {
          await runNodesSequentially(root.children);
        }

        const targetStatus: SuiteStepStatus = itemStatuses.length > 0
          ? worstSuiteItemStatus(itemStatuses)
          : (overallSuccess ? 'passed' : 'failed');

        effectiveOptions.reporter && effectiveOptions.reporter({
          scope: 'suite-item',
          status: targetStatus,
          runId: targetRunId,
          filePath: targetFilePath,
          entry: targetEntry,
          title: targetTitle,
          docType: root.kind === 'suite' ? 'suite' : undefined,
          id: root.id,
        });
      } else if (root) {
        await runNodesSequentially([root]);
      } else {
        await runNodesSequentially(bundle.bundle);
      }
    }
  } finally {
    const ended = endServerSession_();
    if (ended.outermost) {
      for (const message of ended.stopErrors) {
        suiteLogger('warn', `Error stopping server: ${message}`);
      }
      clearTestCallCache_();
    }
  }

  const durationMs = Date.now() - suiteStart;
  const cancelled = effectiveOptions.abortSignal?.aborted === true;
  const aggregatedStatus = itemStatuses.length > 0
    ? worstSuiteItemStatus(itemStatuses)
    : (overallSuccess ? 'passed' as SuiteStepStatus : 'failed' as SuiteStepStatus);
  const result: RunResult = {
    success: overallSuccess,
    durationMs,
    errors: allErrors,
    logs: allLogs,
    itemStatus: aggregatedStatus === 'passed' ? undefined : aggregatedStatus,
    threw: aggregatedStatus === 'invalid',
  };

  const suiteTitle =
      (typeof bundle.rootTitle === 'string' && bundle.rootTitle.trim()) ?
      bundle.rootTitle.trim() :
      suiteDisplayName;
  logRunFinished(
      suiteLogger, 'Suite', suiteTitle, overallSuccess && !cancelled, durationMs,
      {hasError: aggregatedStatus === 'invalid'});

  if (shouldEmitSuiteRunEvents) {
    effectiveOptions.reporter && effectiveOptions.reporter({
      scope: 'suite-run-finished',
      runId: `suite:${sanitizeIdentifier(bundle.rootSuitePath)}`,
      suitePath: bundle.rootSuitePath,
      finishedAt: Date.now(),
      success: overallSuccess,
      durationMs,
      cancelled,
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
