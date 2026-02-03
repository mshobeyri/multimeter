import {LogLevel} from './CommonData';
import {RunJSCodeContext} from './jsRunner';

export type FileLoader = (path: string) => Promise<string>;

export type TestStepStatus = 'passed'|'failed';
export type SuiteStepStatus = 'running'|'passed'|'failed'|'pending';

export interface TestStepReporterEvent {
  scope: 'test-step';
  runId: string;
  stepIndex: number;
  stepType: 'check'|'assert';
  status: TestStepStatus;
  comparison: string;
  title?: string;
  details?: string;
  timestamp: number;
  actual?: any;
  expected?: any;
  id?: string;
}

export interface TestRunSummaryEvent {
  scope: 'test-step-run';
  runId: string;
  result: TestStepStatus;
  id?: string;
}

export interface SuiteReporterMessage {
  scope?: 'suite-item';
  groupIndex: number;
  groupItemIndex: number;
  status?: SuiteStepStatus;
  success?: boolean;
  runId?: string;
  filePath?: string;
  entry?: string;
  docType?: string;
  id?: string;
}

export interface SuiteRunStartEvent {
  scope: 'suite-run-start';
  runId: string;
  suitePath?: string;
  startedAt: number;
  totalRunnable: number;
}

export interface SuiteRunFinishedEvent {
  scope: 'suite-run-finished';
  runId: string;
  suitePath?: string;
  finishedAt: number;
  success: boolean;
  durationMs: number;
  cancelled?: boolean;
}

export interface SetEnvReporterEvent {
  scope: 'setenv';
  name: string;
  value: any;
  runId?: string;
  id?: string;
  timestamp?: number;
}

export type RunReporterMessage =
  SuiteReporterMessage|TestStepReporterEvent|TestRunSummaryEvent|
  SuiteRunStartEvent|SuiteRunFinishedEvent|SetEnvReporterEvent;

export interface RunResult {
  success: boolean;
  durationMs: number;
  errors: string[];
  logs?: string[];
  threw?: boolean;
}

export interface GenerateJsOptions {
  rawText: string;
  name: string;
  inputs: Record<string, any>;
  envVars: Record<string, any>;
  fileLoader: FileLoader;  // Responsible for resolving relative imports
  filePath?: string;  // File path for resolving relative imports
  projectRoot?: string;  // Project root directory (where multimeter.mmt lives) for +/ imports
}

export interface RunFileOptions {
  /**
   * Primary file input.
   * - If `fileType === 'raw'`: this is the YAML/JSON text content.
   * - If `fileType === 'path'`: this is the filesystem path to load.
   */
  file: string;
  /**
   * Optional absolute path used for display names and relative import
   * resolution. When `fileType === 'path'`, this can be omitted (it will
   * default to `file`).
   */
  filePath?: string;
  /**
   * Specifies whether `file` contains raw content or a filesystem path.
   */
  fileType: 'raw'|'path';
  exampleIndex?: number;
  exampleName?: string;
  manualInputs?: Record<string, any>;
  envvar?: Record<string, any>;
  manualEnvvars?: Record<string, any>;
  fileLoader: FileLoader;
  jsRunner: (context: RunJSCodeContext) => Promise<void>;
  logger: (level: LogLevel, msg: string) => void;
  reporter: (message: RunReporterMessage) => void;

  /** Optional signal for cooperative cancellation (suite/test/api runs). */
  abortSignal?: AbortSignal;

  /** Optional identifier passed through reporter events and JS globals. */
  id?: string;
  /** Optional externally-provided run id used for reporter/routing (overrides generated run id). */
  runId?: string;

  /**
   * Optional suite bundle for bundle-based suite runs.
   * When provided, suite execution uses bundle node ids for targeting/report routing.
   */
  suiteBundle?: import('./suiteBundle').SuiteBundle;

  /**
   * Project root directory (where multimeter.mmt lives) for +/ imports.
   * If not provided, will be auto-detected by walking up from filePath.
   */
  projectRoot?: string;
}

export interface MergeInputsParams {
  defaultInputs?: Record<string, any>;
  exampleInputs?: Record<string, any>;
  manualInputs?: Record<string, any>;
}

export function mergeInputs(params: MergeInputsParams): Record<string, any> {
  const {defaultInputs = {}, exampleInputs = {}, manualInputs = {}} = params;
  return {...defaultInputs, ...exampleInputs, ...manualInputs};
}

export interface MergeEnvParams {
  baseEnv?: Record<string, any>;
  envvar?: Record<string, any>;
  presetEnv?: Record<string, any>;
  manualEnvvars?: Record<string, any>;
}

export function mergeEnv(params: MergeEnvParams): Record<string, any> {
  const {baseEnv = {}, envvar = {}, presetEnv = {}, manualEnvvars = {}} =
      params;
  return {...baseEnv, ...envvar, ...presetEnv, ...manualEnvvars};
}

export type EnvLike = Record<string, any>;

export interface EnvFileDoc {
  variables?: EnvLike;
  presets?: EnvLike;
}

export interface ResolveEnvFromDocParams {
  /** Parsed env file document ({ variables, presets }). */
  doc: EnvFileDoc;
  /** Preset name, e.g. "runner.cd" or "cd". */
  presetName?: string;
  /** Manual env vars from CLI/assistant flags (highest priority). */
  manualEnvvars?: Record<string, any>;
}

/**
 * Resolves env vars from an env-file document + optional preset, then merges
 * manual env vars on top.
 */
export function resolveEnvFromDoc(params: ResolveEnvFromDocParams):
    Record<string, any> {
  const {doc, presetName, manualEnvvars} = params;
  const presetEnv = presetName ? resolvePresetEnv(doc, presetName) : {};
  return mergeEnv({envvar: presetEnv, manualEnvvars});
}

export function selectFromVariables(
    variables: EnvLike|undefined, key: string, choiceOrValue: any): any {
  const def = variables?.[key];
  if (def && typeof def === 'object' && !Array.isArray(def)) {
    if (Object.prototype.hasOwnProperty.call(def, choiceOrValue)) {
      return def[choiceOrValue];
    }
    const firstKey = Object.keys(def)[0];
    if (firstKey) {
      return def[firstKey];
    }
    return choiceOrValue;
  }
  if (Array.isArray(def)) {
    if (def.some(entry => entry === choiceOrValue)) {
      return choiceOrValue;
    }
    return def.length > 0 ? def[0] : choiceOrValue;
  }
  return choiceOrValue;
}

export function resolvePresetEnv(
    doc: EnvFileDoc, presetName: string|undefined): Record<string, any> {
  const out: Record<string, any> = {};
  if (!presetName) {
    return out;
  }
  const presets = doc.presets || {};
  const variables = doc.variables || {};
  let mapping: Record<string, any>|undefined;
  // Support both forms:
  // - "cd" (implicitly under presets.runner.cd)
  // - "runner.cd" (explicit group)
  if (presetName.includes('.')) {
    const [group, name] = presetName.split('.', 2);
    if ((presets as any)[group] && (presets as any)[group][name]) {
      mapping = (presets as any)[group][name];
    }
  } else if ((presets as any).runner && (presets as any).runner[presetName]) {
    mapping = (presets as any).runner[presetName];
  }
  if (!mapping) {
    return out;
  }
  for (const [k, choice] of Object.entries(mapping)) {
    out[k] = selectFromVariables(variables, k, choice);
  }
  return out;
}
