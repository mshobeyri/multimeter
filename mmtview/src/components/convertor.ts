import {
  inputBoxToYamlValue,
  yamlValueToInputBox,
} from 'mmt-core/yamlValueConvert';
import {peerStringToDisplay, peerStringToYaml} from 'mmt-core/apiBodyEdit';
import {isLiteralTokenValue, unwrapLiteralToken, wholeAngleTokenPlain} from 'mmt-core/literalToken';
import {isOmitSentinel} from 'mmt-core/omitKeyword';
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
 * Shared UI → YAML write step 1: optional peer token normalize.
 * `{{r:uuid}}` / bare / `<<…>>` → YAML token form when `tokens` is on.
 */
export function withOptionalPeer(val: string, tokens = false): string {
  return tokens ? peerStringToYaml(val) : val;
}

/**
 * Shared UI → YAML write for typed fields (inputs, expect values).
 * peer (optional) → type coerce (`"112"` → string, `112` → number, …).
 */
function unquoteWhole(val: string): string {
  const t = String(val ?? '').trim();
  if ((t.startsWith('"') && t.endsWith('"') && t.length >= 2) ||
      (t.startsWith('\'') && t.endsWith('\'') && t.length >= 2)) {
    return t.slice(1, -1);
  }
  return t;
}

export function inputBoxToYamlValueWithTokens(
    val: string,
    tokens = false,
    liveAngleTokens = false,
): JSONValue {
  if (liveAngleTokens) {
    const plain = wholeAngleTokenPlain(unquoteWhole(val));
    if (plain) {
      return plain;
    }
  }
  return inputBoxToYamlValue(withOptionalPeer(val, tokens));
}

/**
 * Shared UI → YAML write for string maps (headers, query, cookies, …).
 * Same pipeline as {@link inputBoxToYamlValueWithTokens}, then non-strings are
 * re-stringified so the stored record stays `Record<string, string>`.
 */
export function inputBoxToYamlString(val: string, tokens = false): string {
  const typed = inputBoxToYamlValueWithTokens(val, tokens);
  if (typeof typed === 'string') {
    return typed;
  }
  return yamlValueToInputBox(typed);
}

/**
 * Token-capable typed field → stored YAML value (`tokens` always on).
 */
export const peerFieldToValue = (val: string): JSONValue =>
  inputBoxToYamlValueWithTokens(val, true);

/**
 * YAML / model value → input box, with optional `{{…}}` token display rewrite.
 * Ambiguous quoted scalars (`"112"`, `"true"`, …) and quoted token literals
 * keep their quotes; bare tokens become display templates when `tokens` is on.
 */
export function yamlValueToInputBoxWithTokens(
    val: JSONValue | undefined,
    tokens = false,
    liveAngleTokens = false,
): string {
  if (liveAngleTokens && typeof val === 'string') {
    const inner = isLiteralTokenValue(val) ? unwrapLiteralToken(val) : val;
    const plain = wholeAngleTokenPlain(inner);
    if (plain) {
      return `{{${plain}}}`;
    }
  }
  if (!tokens || typeof val !== 'string') {
    return yamlValueToInputBox(val);
  }
  if (isLiteralTokenValue(val) || isOmitSentinel(val)) {
    return yamlValueToInputBox(val);
  }
  const displayed = yamlValueToInputBox(val);
  // valueToString wrapped quotes for an ambiguous scalar — keep them.
  if (displayed !== val && displayed.startsWith('"') && displayed.endsWith('"')) {
    return displayed;
  }
  return peerStringToDisplay(val);
}
