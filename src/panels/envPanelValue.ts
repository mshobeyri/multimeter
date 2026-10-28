import type {JSONValue} from 'mmt-core/data/CommonData';
import type {EnvVarSource} from 'mmt-core/data/EnvData';
import {
  isEnvFilePathValue,
  isOsEnvRefValue,
} from 'mmt-core/env/envStore';
import {
  inputBoxToYamlValue,
  yamlValueToInputBox,
  yamlValueTypeLabel,
} from 'mmt-core/parse/yamlValueConvert';

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
  if (typeof value === 'string') {
    if (isEnvFilePathValue(value)) {
      return {
        // Keep the path as typed (no YAML quote wrapping for ./….mmt).
        displayValue: value.trim(),
        typeLabel: 'live',
      };
    }
    if (isOsEnvRefValue(value)) {
      return {
        displayValue: value.trim(),
        typeLabel: 'os',
      };
    }
  }
  return {
    displayValue: yamlValueToInputBox(value),
    typeLabel: value === undefined || value === '' ? '' : yamlValueTypeLabel(value),
  };
}
