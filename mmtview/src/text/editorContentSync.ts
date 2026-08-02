import { normalizeNewlines, withNewline } from 'mmt-core/textLines';

/**
 * True when two editor buffers are the same ignoring CRLF vs LF.
 * Used so Windows body/YAML sync does not bounce LF parent text back into a
 * Monaco buffer that still has CRLF (that bounce resets the cursor).
 */
export function editorContentsEquivalent(a: string, b: string): boolean {
  return a === b || normalizeNewlines(a ?? '') === normalizeNewlines(b ?? '');
}

/** Whether an incoming parent value should replace the local Monaco buffer. */
export function shouldReplaceLocalEditorValue(local: string, incoming: string): boolean {
  return !editorContentsEquivalent(local, incoming);
}

/**
 * Convert Monaco/webview LF text to the VS Code document EOL before compare/replace.
 * Mirrors `MmtEditorProvider.updateTextDocument` normalization on Windows CRLF docs.
 */
export function webviewTextToDocumentEol(
  text: string,
  eol: '\r\n' | '\n' | '\r' = '\n',
): string {
  return withNewline(text ?? '', eol);
}

/**
 * True when applying webview text to a VS Code document would be a no-op after
 * EOL normalization (the Windows keystroke/save thrash case).
 */
export function documentTextMatchesWebview(
  documentText: string,
  webviewText: string,
  documentEol: '\r\n' | '\n' | '\r',
): boolean {
  return documentText === webviewTextToDocumentEol(webviewText, documentEol);
}

/**
 * How to apply parent content onto Monaco.
 *
 * - `setValue` only for the first hydration of an empty buffer. It resets the
 *   undo stack, which is what keeps Ctrl+Z from rewinding to the empty editor
 *   that exists before the document arrives.
 * - `edit` for every later rewrite (UI→YAML pack, save echo, formatting). An
 *   undoable edit keeps the file's history, so Ctrl+Z still works after the UI
 *   writes YAML.
 */
export function planExternalMonacoApply(
  currentValue: string,
  nextValue: string,
): 'noop' | 'setValue' | 'edit' {
  if (currentValue === nextValue) {
    return 'noop';
  }
  if ((currentValue ?? '') === '') {
    return 'setValue';
  }
  return 'edit';
}

export interface EditorEditSpan {
  /** Offset in the current buffer where the replacement starts. */
  start: number;
  /** Offset in the current buffer where the replaced range ends (exclusive). */
  end: number;
  /** Replacement text for that range. */
  text: string;
}

/**
 * Narrow a full-buffer rewrite to the range that actually changed, so the edit
 * pushed onto Monaco keeps markers, folding, and the cursor near their place
 * instead of replacing the whole document.
 */
export function computeMinimalEditSpan(
  currentValue: string,
  nextValue: string,
): EditorEditSpan|null {
  const current = currentValue ?? '';
  const next = nextValue ?? '';
  if (current === next) {
    return null;
  }
  let prefix = 0;
  const maxPrefix = Math.min(current.length, next.length);
  while (prefix < maxPrefix && current[prefix] === next[prefix]) {
    prefix++;
  }
  let suffix = 0;
  const maxSuffix = Math.min(current.length - prefix, next.length - prefix);
  while (
    suffix < maxSuffix &&
    current[current.length - 1 - suffix] === next[next.length - 1 - suffix]
  ) {
    suffix++;
  }
  return {
    start: prefix,
    end: current.length - suffix,
    text: next.slice(prefix, next.length - suffix),
  };
}
