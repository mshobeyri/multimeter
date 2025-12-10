export interface RunFileOptionsV2 {
  file: string;
  fileType: 'raw'|'path';
  filePath?: string;
  exampleIndex?: number;
  exampleId?: string;
  manualInputs?: Record<string, any>;
  envvar?: Record<string, any>;
  manualEnvvars?: Record<string, any>;
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
    return choiceOrValue;
  }
  if (Array.isArray(def)) {
    return choiceOrValue;
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
  if (presets.runner && presets.runner[presetName]) {
    mapping = presets.runner[presetName];
  } else if (presetName.includes('.')) {
    const [group, name] = presetName.split('.', 2);
    if (presets[group] && presets[group][name]) {
      mapping = presets[group][name];
    }
  }
  if (!mapping) {
    return out;
  }
  for (const [k, choice] of Object.entries(mapping)) {
    out[k] = selectFromVariables(variables, k, choice);
  }
  return out;
}
