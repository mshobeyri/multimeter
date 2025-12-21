import { LogLevel } from "./CommonData";

export type FileLoader = (path: string) => Promise<string>;

export interface RunResult {
  success: boolean;
  durationMs: number;
  errors: string[];
  logs?: string[];
}

export interface GenerateJsOptions {
  rawText: string;
  name: string;
  inputs: Record<string, any>;
  envVars: Record<string, any>;
  fileLoader: FileLoader;  // Responsible for resolving relative imports
}

export interface RunFileOptions {
  /**
   * Primary file input.
   * - If `fileType === 'raw'`: this is the YAML/JSON text content.
   * - If `fileType === 'path'`: this is the filesystem path to load.
   */
  file: string;
  /**
   * Optional absolute path used for display names and relative import resolution.
   * When `fileType === 'path'`, this can be omitted (it will default to `file`).
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
  runCode:
      (code: string, title: string,
       logger: (level: LogLevel, msg: string) => void) => Promise<void>;
  logger?: (level: LogLevel, msg: string) => void;
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
