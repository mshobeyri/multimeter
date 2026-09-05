/**
 * Derive which preset option is "selected" from current environment variable
 * values — so the UI stays in sync when vars are edited manually.
 */

export type EnvVarSnapshot = {
  name: string;
  label?: string;
  value?: string|number|boolean;
  options?: Array<{label: string; value: string|number|boolean}>;
};

/** presets[presetName][optionName][variableName] = desired label or value */
export type PresetGroups =
    Record<string, Record<string, Record<string, unknown>>>;

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  if (a === null || a === undefined || b === null || b === undefined) {
    return false;
  }
  return String(a) === String(b);
}

/**
 * Whether a variable's current selection matches a preset mapping entry
 * (same rules as applyPreset: match option by label or value, else raw compare).
 */
export function variableMatchesPresetDesired(
    variable: EnvVarSnapshot, desired: unknown): boolean {
  if (typeof desired === 'undefined') {
    return true;
  }
  const options = Array.isArray(variable.options) ? variable.options : [];
  const match = options.find((opt) => {
    const label = typeof opt.label === 'string' ? opt.label : String(opt.label);
    const value =
        typeof opt.value === 'string' || typeof opt.value === 'number' ||
            typeof opt.value === 'boolean' ?
        opt.value :
        String(opt.value);
    if (typeof desired === 'string') {
      return label === desired || String(value) === desired;
    }
    return value === desired;
  });
  if (match) {
    return valuesEqual(variable.value, match.value) ||
        variable.label === match.label;
  }
  return valuesEqual(variable.value, desired) ||
      variable.label === String(desired);
}

export function presetMappingMatchesVars(
    vars: EnvVarSnapshot[],
    mapping: Record<string, unknown>|null|undefined): boolean {
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    return false;
  }
  const keys = Object.keys(mapping);
  if (keys.length === 0) {
    return false;
  }
  const byName = new Map(vars.map((v) => [v.name, v]));
  for (const key of keys) {
    const variable = byName.get(key);
    if (!variable) {
      return false;
    }
    if (!variableMatchesPresetDesired(variable, mapping[key])) {
      return false;
    }
  }
  return true;
}

/**
 * Find the preset option whose mapping fully matches current vars.
 * If several match, prefer the one with the most mapped keys.
 */
export function findMatchingPresetOption(
    vars: EnvVarSnapshot[],
    presetGroup: Record<string, Record<string, unknown>>|null|undefined,
    ): string|undefined {
  if (!presetGroup || typeof presetGroup !== 'object') {
    return undefined;
  }
  let best: {name: string; score: number}|undefined;
  for (const [envName, mapping] of Object.entries(presetGroup)) {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
      continue;
    }
    if (!presetMappingMatchesVars(vars, mapping as Record<string, unknown>)) {
      continue;
    }
    const score = Object.keys(mapping).length;
    if (!best || score > best.score) {
      best = {name: envName, score};
    }
  }
  return best?.name;
}

/** Map of presetName → matching option name (only presets that fully match). */
export function derivePresetSelections(
    vars: EnvVarSnapshot[], presets: PresetGroups|null|undefined):
    Record<string, string> {
  const out: Record<string, string> = {};
  if (!presets || typeof presets !== 'object') {
    return out;
  }
  for (const [presetName, group] of Object.entries(presets)) {
    const match = findMatchingPresetOption(vars, group);
    if (match) {
      out[presetName] = match;
    }
  }
  return out;
}
