import {isTokenLikeScalar} from '../tokens/literalToken';
import {isOmitSentinel, OMIT_KEYWORD, restoreOmitKeywordInText} from '../tokens/omitKeyword';
import {comparisonOperatorPattern} from '../data/TestData';

/**
 * Expected RHS from a report comparison line (`field == c:token`).
 * Returns null when the comparison cannot be split.
 */
export function authoredExpectedFromComparison(comparison: string): string|null {
  const trimmed = String(comparison || '').trim();
  if (!trimmed) {
    return null;
  }
  const operatorRe =
      new RegExp(`(?:^|\\s)(${comparisonOperatorPattern()})(?=\\s|$)`, 'g');
  let match: RegExpExecArray|null;
  while ((match = operatorRe.exec(trimmed))) {
    const operator = match[1];
    const operatorStart = match.index + match[0].length - operator.length;
    const actual = trimmed.slice(0, operatorStart).trim();
    if (!actual) {
      continue;
    }
    return trimmed.slice(operatorStart + operator.length).trim();
  }
  return null;
}

/**
 * True when the authored expected side is not a plain literal (e.g. `c:now`,
 * `e:url`, `<<i:id>>`, or text that embeds those tokens).
 */
export function isNonPlainExpectedAuthored(authored: string): boolean {
  const text = String(authored || '').trim();
  if (!text) {
    return false;
  }
  if (isTokenLikeScalar(text)) {
    return true;
  }
  // Embedded runtime tokens inside a larger expected string.
  if (/<<\s*[eiroc]:/i.test(text) || /\{\{\s*[eiroc]:/i.test(text)) {
    return true;
  }
  return false;
}

/** Show resolved `expected:` under `got:` when the authored RHS is dynamic. */
export function shouldShowResolvedExpected(comparison: string): boolean {
  const authored = authoredExpectedFromComparison(comparison);
  if (authored == null) {
    return false;
  }
  return isNonPlainExpectedAuthored(authored);
}

/** Shared display for got/expected meta lines in reports and the UI. */
export function formatExpectMetaValue(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (isOmitSentinel(value)) {
    return OMIT_KEYWORD;
  }
  if (typeof value === 'object') {
    try {
      return restoreOmitKeywordInText(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  return restoreOmitKeywordInText(String(value));
}
