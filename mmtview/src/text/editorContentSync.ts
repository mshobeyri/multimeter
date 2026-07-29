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
 * Always `setValue` (not executeEdits) when replacing so the undo stack resets:
 * the editor often mounts empty before the document arrives, and executeEdits
 * would let Ctrl+Z rewind to that empty buffer.
 */
export function planExternalMonacoApply(
  currentValue: string,
  nextValue: string,
): 'noop' | 'setValue' {
  if (currentValue === nextValue) {
    return 'noop';
  }
  return 'setValue';
}
