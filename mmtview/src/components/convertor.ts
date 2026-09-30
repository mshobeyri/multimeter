import {
  inputBoxToYamlValue,
  yamlValueToInputBox,
} from 'mmt-core/yamlValueConvert';
import {peerStringToDisplay, peerStringToYaml} from 'mmt-core/apiBodyEdit';
import {isLiteralTokenValue} from 'mmt-core/literalToken';
import {JSONValue} from 'mmt-core/CommonData';

export {
  inputBoxToYamlValue,
  valueToString,
  stringToValue,
  yamlValueToInputBox,
  yamlValueTypeLabel,
  shortValueTypeLabel,
} from 'mmt-core/yamlValueConvert';

/**
 * YAML / model value → input box, with optional `{{…}}` token display rewrite.
 * Ambiguous quoted scalars (`"112"`, `"true"`, …) and quoted token literals
 * keep their quotes; bare tokens become display templates when `tokens` is on.
 */
export function yamlValueToInputBoxWithTokens(
    val: JSONValue | undefined,
    tokens = false,
): string {
  if (!tokens || typeof val !== 'string') {
    return yamlValueToInputBox(val);
  }
  if (isLiteralTokenValue(val)) {
    return yamlValueToInputBox(val);
  }
  const displayed = yamlValueToInputBox(val);
  // valueToString wrapped quotes for an ambiguous scalar — keep them.
  if (displayed !== val && displayed.startsWith('"') && displayed.endsWith('"')) {
    return displayed;
  }
  return peerStringToDisplay(val);
}

/**
 * Input box → YAML / model value, with optional peer token normalization.
 */
export function inputBoxToYamlValueWithTokens(
    val: string,
    tokens = false,
): JSONValue {
  if (!tokens) {
    return inputBoxToYamlValue(val);
  }
  return inputBoxToYamlValue(peerStringToYaml(val));
}

/**
 * Token-capable field → stored YAML value.
 * Normalizes `{{r:uuid}}` / bare tokens via peerStringToYaml, then coerces
 * types (int / bool / omit / null) like inputBoxToYamlValue. Keys stay strings.
 */
export const peerFieldToValue = (val: string): JSONValue =>
  inputBoxToYamlValueWithTokens(val, true);
