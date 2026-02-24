import {APIData} from './APIData';
import {LogLevel, Type} from './CommonData';
import * as JSer from './JSer';
import {RunJSCodeContext} from './jsRunner';
import {RunResult, TestStepReporterEvent} from './runConfig';

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
}

export async function runGeneratedJs(
    runId: string, js: string, name: string,
    logger: (level: LogLevel, msg: string) => void,
    jsRunner: (context: RunJSCodeContext) => Promise<any>,
    stepReporter?: (event: TestStepReporterEvent) => void,
  id?: string,
  fileLoader?: (path: string) => Promise<string>,
  reporter?: (event: Record<string, any>) => void,
  abortSignal?: AbortSignal): Promise<RunResult> {
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
    const returnValue = await jsRunner({
      runId,
      js,
      title: name,
      logger: forward,
      fileLoader,
      reporter: reporter ?? stepReporter,
      id,
      abortSignal,
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