import {Format} from './CommonData';
import {formatBody, packBodyForYamlCompare} from './markupConvertor';
import {normalizeNewlines} from './textLines';

/**
 * Body text shown in the API tester editor.
 * Structured YAML bodies are pretty-projected once; after the user edits,
 * `body` is kept as a free-form string and returned as-is.
 */
export function displayRequestBody(body: unknown, format: Format): string {
  if (body == null) {
    return '';
  }
  if (typeof body === 'string') {
    return body;
  }
  return formatBody(format, body);
}

export type BodyTempBaseline = {
  /** Resolved display string at first keystroke (exact match exits temp). */
  display: string;
  /** Original body value to restore on exact revert. */
  body: unknown;
};

export type BodyEditResult =
  | {kind: 'exitTemp'; body: unknown; baseline: null}
  | {kind: 'stayTemp'; body: string; baseline: BodyTempBaseline};

/**
 * Apply a tester body keystroke.
 * - First edit snapshots the pre-edit display + original body.
 * - Exact match of that display exits temp and restores the original body.
 * - Otherwise stays in temp with a free-form string (no live pack).
 */
export function applyRequestBodyEdit(args: {
  value: string;
  currentBody: unknown;
  format: Format;
  baseline: BodyTempBaseline|null;
  bodyAlreadyTouched: boolean;
}): BodyEditResult {
  const normalized = normalizeNewlines(args.value);
  let baseline = args.baseline;
  if (!args.bodyAlreadyTouched || !baseline) {
    const display = displayRequestBody(args.currentBody, args.format);
    baseline = {
      display: normalizeNewlines(display),
      body: args.currentBody,
    };
  }
  if (normalized === baseline.display) {
    return {kind: 'exitTemp', body: baseline.body, baseline: null};
  }
  return {kind: 'stayTemp', body: normalized, baseline};
}

/**
 * Body value placed on the wire for Send / Run.
 * Free-form strings go as-is; leftover structured objects (except multipart)
 * are compact-serialized for the format.
 */
export function bodyForSend(body: unknown, format: Format): unknown {
  if (body == null) {
    return body;
  }
  if (typeof body === 'string') {
    return body;
  }
  if (format === 'multipart') {
    return body;
  }
  return formatBody(format, body, false);
}

/**
 * Body value written back into YAML on "Save to YAML".
 * Same rules as packBodyForYamlCompare (strict pack when YAML was encoded).
 */
export function bodyForYamlSave(
    yamlBody: unknown,
    uiBody: unknown,
    format: Format,
): unknown {
  return packBodyForYamlCompare(yamlBody, uiBody, format);
}
