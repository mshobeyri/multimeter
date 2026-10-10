import type {JSONValue} from 'mmt-core/CommonData';
import type {EnvVarSource} from 'mmt-core/EnvData';
import {
  inputBoxToYamlValue,
  yamlValueToInputBox,
  yamlValueTypeLabel,
} from 'mmt-core/yamlValueConvert';

/** Same rule as core `isEnvFilePathValue` / side-panel open-file control. */
function isLiveEnvFilePath(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const trimmed = value.trim();
  return trimmed.startsWith('./') && /\.mmt$/i.test(trimmed);
}

/**
 * Manual text edits arrive as strings and must be coerced like other typed
 * value fields (`10` → number, `"10"` → string). Option picks already carry
 * the YAML type from the env definition — leave those alone.
 */
export function resolveEnvPanelIncomingValue(
    value: unknown,
    source: EnvVarSource|undefined,
): JSONValue {
  if (source === 'manual' && typeof value === 'string') {
    return inputBoxToYamlValue(value);
  }
  return value as JSONValue;
}

/** Display text + type chip for the Environment side-panel value field. */
export function envPanelValueView(value: JSONValue|undefined): {
  displayValue: string;
  typeLabel: string;
} {
  if (typeof value === 'string' && isLiveEnvFilePath(value)) {
    return {
      // Keep the path as typed (no YAML quote wrapping for ./….mmt).
      displayValue: value.trim(),
      typeLabel: 'live',
    };
  }
  return {
    displayValue: yamlValueToInputBox(value),
    typeLabel: value === undefined || value === '' ? '' : yamlValueTypeLabel(value),
  };
}
