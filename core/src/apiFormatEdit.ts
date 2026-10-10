import {
  FormatConfig,
  FormatSpec,
  RequestFormat,
  ResponseFormat,
  normalizeFormat,
} from './CommonData';

export type FormatEditResult =
  | {kind: 'exitTemp'; format: FormatSpec|undefined}
  | {kind: 'stayTemp'; format: FormatConfig};

/**
 * Apply a temporary UI format change on one side (request or response).
 * Sides are independent. Reverting both sides to the YAML baseline exits temp
 * (same idea as body exact-revert). While in temp, store an explicit
 * `{ request, response }` object so packing never collapses response back to
 * auto while the user still has an explicit choice.
 */
export function applyFormatSideEdit(args: {
  side: 'request'|'response';
  value: RequestFormat|ResponseFormat;
  /** Original format from YAML / last applied API. */
  yamlFormat: FormatSpec|undefined|null;
  /** Current UI format (requestData) when already in temp; ignored otherwise. */
  currentFormat: FormatSpec|undefined|null;
  formatTouched: boolean;
}): FormatEditResult {
  const baseline = normalizeFormat(args.yamlFormat);
  const current = args.formatTouched
    ? normalizeFormat(args.currentFormat)
    : baseline;
  const next: FormatConfig = {
    request: args.side === 'request'
      ? args.value as RequestFormat
      : current.request,
    response: args.side === 'response'
      ? args.value as ResponseFormat
      : current.response,
  };
  if (next.request === baseline.request && next.response === baseline.response) {
    return {
      kind: 'exitTemp',
      format: args.yamlFormat === null ? undefined : args.yamlFormat ?? undefined,
    };
  }
  return {kind: 'stayTemp', format: next};
}
