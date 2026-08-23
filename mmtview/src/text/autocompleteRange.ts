export interface CompletionPosition {
  lineNumber: number;
  column: number;
}

export interface CompletionRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export function completionRange(
  position: CompletionPosition,
  startColumn: number,
  endColumn = position.column,
): CompletionRange {
  return {
    startLineNumber: position.lineNumber,
    startColumn,
    endLineNumber: position.lineNumber,
    endColumn,
  };
}

export function wordCompletionRange(
  position: CompletionPosition,
  wordInfo?: {startColumn?: number; endColumn?: number} | null,
): CompletionRange {
  return completionRange(
    position,
    wordInfo?.startColumn ?? position.column,
    wordInfo?.endColumn ?? position.column,
  );
}

export function withRange<T extends object>(
  suggestions: T[],
  range: CompletionRange,
): Array<T & {range: CompletionRange}> {
  return suggestions.map((item) => ({...item, range}));
}
