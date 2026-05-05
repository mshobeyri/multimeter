import {APIData} from './APIData';
import {LogLevel, Type} from './CommonData';
import * as JSer from './JSer';
import {RunJSCodeContext} from './jsRunner';
import type {CollectedResults, LoadReportData} from './reportCollector';
import {RunResult, TestStepReporterEvent} from './runConfig';

export interface SuiteExportSpec {
  /** Export file paths from the suite file's `export` field. */
  paths: string[];
  /** Collected results from the suite run for generating reports. */
  collectedResults: CollectedResults;
}

export interface LoadTestPreparedConfig {
  title?: string;
  test: string;
  threads?: number;
  repeat?: string | number;
  rampup?: string;
  environment?: import('./SuiteData').SuiteEnvironment;
  export?: string[];
}

export interface RunFileResult {
  js: string;
  result: RunResult;
  identifier: string;
  displayName: string;
  docType: Type|null;
  inputsUsed: Record<string, any>;
  envVarsUsed: Record<string, any>;
  exampleName?: string;
  exampleIndex?: number;
  /** Export specifications for suite runs (only set when `bundle.export` is defined). */
  suiteExports?: SuiteExportSpec;
  /** Aggregated load-test metrics for UI/report consumers. */
  loadResult?: LoadReportData;
}

export interface PreparedRun {
  rawText: string;
  filePath: string;
  baseName: string;
  docType: Type|null;
  envVarsUsed: Record<string, any>;
  inputsUsed: Record<string, any>;
  apiDoc?: APIData;
  title?: string;
  exampleName?: string;
  exampleIndex?: number;
  loadtestConfig?: LoadTestPreparedConfig;
}

/**
 * Attempt to parse a generated JS string to detect syntax errors early.
 * Returns an error message if the code is invalid, or `undefined` if it is OK.
 *
 * We wrap the code with the same parameter names that `runJSCode` uses so
 * that the identifier references don't trigger false positives.  Only the
 * *parse* phase of `new Function()` runs — nothing is executed.
 */
export function validateJsSyntax(js: string): string | undefined {
  try {
    // Wrap in an async function so `await` is valid (the generated code runs
    // inside an async context in `runJSCode`).
    // eslint-disable-next-line no-new-func
    new Function(
      'mmtHelper', 'console', 'send_', 'extractOutputs_', 'Random',
      '__reporter', '__runId', '__id', '__mmt_random', '__mmt_current',
      '__mmt_access',
      `return (async () => {\n${js}\n})();`,
    );
    return undefined;
  } catch (e: any) {
    if (e instanceof SyntaxError) {
      return `Generated code has a syntax error (likely caused by invalid .mmt syntax): ${e.message}. Use print-js to see the generated code.`;
    }
    // Non-syntax error during construction is unexpected; still report it.
    return `Unexpected error validating generated code: ${e?.message || String(e)}`;
  }
}

export async function runGeneratedJs(
    runId: string, js: string, name: string,
    logger: (level: LogLevel, msg: string) => void,
    jsRunner: (context: RunJSCodeContext) => Promise<any>,
    stepReporter?: (event: TestStepReporterEvent) => void,
  id?: string,
  fileLoader?: (path: string) => Promise<string>,
  reporter?: (event: Record<string, any>) => void,
  abortSignal?: AbortSignal,
  traceSend?: boolean,
  skipServerCleanup?: boolean,
  basePath?: string,
  skipSyntaxValidation?: boolean): Promise<RunResult> {
  const start = Date.now();
  const errors: string[] = [];
  const logs: string[] = [];
  const forward = (level: LogLevel, msg: string) => {
    if (level === 'error') {
      errors.push(msg);
    }
    logs.push(String(msg));
    logger(level, msg);
  };
  try {
    if (!js || !js.trim()) {
      errors.push('Empty JS input');
      return {success: false, durationMs: Date.now() - start, errors, logs};
    }
    // Syntax-check the generated JS before execution so malformed .mmt
    // files surface a clear error instead of silently failing.
    if (!skipSyntaxValidation) {
      const syntaxError = validateJsSyntax(js);
      if (syntaxError) {
        errors.push(syntaxError);
        forward('error', syntaxError);
        return {success: false, durationMs: Date.now() - start, errors, logs, syntaxError: true};
      }
    }
    const returnValue = await jsRunner({
      runId,
      js,
      title: name,
      logger: forward,
      fileLoader,
      reporter: reporter ?? stepReporter,
      id,
      abortSignal,
      traceSend,
      skipServerCleanup,
      basePath,
    });

    const outputs = returnValue && typeof returnValue === 'object' ? returnValue : undefined;
    return {
      success: errors.length === 0,
      durationMs: Date.now() - start,
      errors,
      logs,
      outputs,
    };
  } catch (e: any) {
    const isCancelled = e?.name === 'TestAbortError';
    if (!isCancelled) {
      errors.push(e?.message || String(e));
    }
    return {
      success: false,
      durationMs: Date.now() - start,
      errors,
      logs,
      threw: true,
      cancelled: isCancelled,
    };
  }
}

export function resolveRelativeTo(
    targetPath: string, baseFilePath: string): string {
  if (!targetPath) {
    return targetPath;
  }
  if (targetPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(targetPath)) {
    return targetPath;
  }
  const base = baseFilePath || '';
  const parts = base.split(/[/\\]/);
  parts.pop();
  const baseDir = parts.join('/');
  const combined = (baseDir ? baseDir + '/' : '') + targetPath;
  const outParts: string[] = [];
  for (const p of combined.split('/')) {
    if (!p || p === '.') {
      continue;
    }
    if (p === '..') {
      outParts.pop();
      continue;
    }
    outParts.push(p);
  }
  return (baseDir.startsWith('/') ? '/' : '') + outParts.join('/');
}

export function basename(filePath: string): string {
  if (!filePath) {
    return '';
  }
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

export function sanitizeIdentifier(value: string): string {
  if (!value) {
    return '_mmt';
  }
  const replaced = value.replace(/[^a-zA-Z0-9_]/g, '_');
  return /^[A-Za-z_$]/.test(replaced) ? replaced : `_${replaced}`;
}

export function detectDocType(filePath: string, rawText: string): Type|null {
  try {
    return JSer.fileType(filePath, rawText);
  } catch {
    return null;
  }
}

export function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}