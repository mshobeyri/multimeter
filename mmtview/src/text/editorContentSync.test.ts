import { normalizeNewlines } from 'mmt-core/textLines';
import {
  computeMinimalEditSpan,
  documentTextMatchesWebview,
  editorContentsEquivalent,
  planExternalMonacoApply,
  shouldReplaceLocalEditorValue,
  webviewTextToDocumentEol,
} from './editorContentSync';

/**
 * Minimal Monaco-like buffer that models the undo difference between
 * `setValue` (clears history) and `executeEdits` (pushes history).
 * Used to simulate the Windows empty→load→Ctrl+Z failure mode without Monaco.
 */
class FakeMonacoModel {
  private value: string;
  private undoStack: string[] = [];

  constructor(initial: string) {
    this.value = initial;
  }

  getValue(): string {
    return this.value;
  }

  /** Monaco setValue: replace content and reset undo/redo. */
  setValue(next: string): void {
    this.value = next;
    this.undoStack = [];
  }

  /** Monaco executeEdits full replace: keeps previous value on the undo stack. */
  executeEditsFullReplace(next: string): void {
    this.undoStack.push(this.value);
    this.value = next;
  }

  /** Monaco pushEditOperations over one range: undoable, keeps earlier history. */
  applySpan(span: { start: number; end: number; text: string }): void {
    this.undoStack.push(this.value);
    this.value =
      this.value.slice(0, span.start) + span.text + this.value.slice(span.end);
  }

  /** User keystroke (simplified). */
  type(text: string): void {
    this.undoStack.push(this.value);
    this.value += text;
  }

  undo(): boolean {
    const prev = this.undoStack.pop();
    if (prev === undefined) {
      return false;
    }
    this.value = prev;
    return true;
  }
}

describe('editorContentSync (Windows CRLF simulation)', () => {
  describe('webviewTextToDocumentEol', () => {
    it('converts Monaco LF to Windows CRLF document text', () => {
      const webview = ['type: api', 'url: https://example.com', ''].join('\n');
      const expected = ['type: api', 'url: https://example.com', ''].join('\r\n');
      expect(webviewTextToDocumentEol(webview, '\r\n')).toBe(expected);
    });

    it('keeps LF when the document EOL is LF (macOS)', () => {
      const webview = 'type: api\nurl: x\n';
      expect(webviewTextToDocumentEol(webview, '\n')).toBe(webview);
    });

    it('strips mixed CR before applying document EOL', () => {
      expect(webviewTextToDocumentEol('a\r\nb\rc', '\r\n')).toBe('a\r\nb\r\nc');
    });
  });

  describe('documentTextMatchesWebview', () => {
    it('treats LF webview and CRLF document as equal after convert (no thrash edit)', () => {
      const webview = 'type: api\nurl: x\n';
      const document = 'type: api\r\nurl: x\r\n';
      expect(documentTextMatchesWebview(document, webview, '\r\n')).toBe(true);
    });

    it('detects a real content change on Windows', () => {
      const webview = 'type: api\nurl: y\n';
      const document = 'type: api\r\nurl: x\r\n';
      expect(documentTextMatchesWebview(document, webview, '\r\n')).toBe(false);
    });

    it('matches on macOS LF without rewriting', () => {
      const text = 'type: api\nurl: x\n';
      expect(documentTextMatchesWebview(text, text, '\n')).toBe(true);
    });
  });

  describe('editorContentsEquivalent / shouldReplaceLocalEditorValue', () => {
    it('skips BodyView bounce when only EOL differs (Windows live body)', () => {
      const monacoLocal = '{\r\n  "a": 1\r\n}';
      const parentLf = normalizeNewlines(monacoLocal);
      expect(editorContentsEquivalent(monacoLocal, parentLf)).toBe(true);
      expect(shouldReplaceLocalEditorValue(monacoLocal, parentLf)).toBe(false);
    });

    it('replaces when body content actually changes', () => {
      expect(shouldReplaceLocalEditorValue('{"a":1}', '{"a":2}')).toBe(true);
    });

    it('does not replace when strings are identical', () => {
      expect(shouldReplaceLocalEditorValue('abc', 'abc')).toBe(false);
    });
  });

  describe('planExternalMonacoApply', () => {
    it('noops when already in sync', () => {
      expect(planExternalMonacoApply('type: api\n', 'type: api\n')).toBe('noop');
    });

    it('uses setValue only to hydrate the empty mount buffer', () => {
      expect(planExternalMonacoApply('', 'type: api\n')).toBe('setValue');
    });

    it('uses an undoable edit for later rewrites so Ctrl+Z keeps working', () => {
      expect(planExternalMonacoApply('old\n', 'new\n')).toBe('edit');
    });
  });

  describe('computeMinimalEditSpan', () => {
    it('returns null when nothing changed', () => {
      expect(computeMinimalEditSpan('type: api\n', 'type: api\n')).toBeNull();
    });

    it('narrows a UI→YAML rewrite to the appended block', () => {
      const before = 'type: api\nurl: x\n';
      const after = 'type: api\nurl: x\nexamples:\n  - name: one\n';
      const span = computeMinimalEditSpan(before, after);
      expect(span).toEqual({
        start: before.length,
        end: before.length,
        text: 'examples:\n  - name: one\n',
      });
    });

    it('narrows an in-place value change to that value', () => {
      const before = 'method: get\n';
      const span = computeMinimalEditSpan(before, 'method: post\n')!;
      // Shared prefix "method: " and suffix "t\n" stay outside the edit.
      expect(before.slice(0, span.start)).toBe('method: ');
      expect(before.slice(span.end)).toBe('t\n');
      expect(span.text).toBe('pos');
    });

    it('applying the span reproduces the next value', () => {
      const before = 'a\nb\nc\n';
      const after = 'a\nB\nc\n';
      const span = computeMinimalEditSpan(before, after)!;
      const applied = before.slice(0, span.start) + span.text + before.slice(span.end);
      expect(applied).toBe(after);
    });
  });

  describe('fake Monaco undo stack (empty → load → Ctrl+Z)', () => {
    it('BUG SIM: executeEdits after empty mount lets undo return to empty', () => {
      const model = new FakeMonacoModel('');
      // Bad path previously used by controlled value / executeEdits sync:
      model.executeEditsFullReplace('type: api\nurl: x\n');
      model.type(' ');
      expect(model.getValue()).toBe('type: api\nurl: x\n ');

      expect(model.undo()).toBe(true);
      expect(model.getValue()).toBe('type: api\nurl: x\n');
      expect(model.undo()).toBe(true);
      // This is the Windows failure: undo rewinds past open state to empty.
      expect(model.getValue()).toBe('');
    });

    it('FIX: setValue after empty mount cannot undo to empty', () => {
      const model = new FakeMonacoModel('');
      const opened = 'type: api\nurl: x\n';
      expect(planExternalMonacoApply(model.getValue(), opened)).toBe('setValue');
      model.setValue(opened);
      model.type(' ');
      expect(model.getValue()).toBe('type: api\nurl: x\n ');

      expect(model.undo()).toBe(true);
      expect(model.getValue()).toBe(opened);
      // Further undo is a no-op — open state is the floor.
      expect(model.undo()).toBe(false);
      expect(model.getValue()).toBe(opened);
    });

    it('Windows save echo applies as an edit, not a noop', () => {
      // insertFinalNewline-style echo: webview lacked trailing newline, document has it
      const beforeSave = 'type: api\nurl: x';
      const afterSaveEcho = 'type: api\nurl: x\n';
      expect(planExternalMonacoApply(beforeSave, afterSaveEcho)).toBe('edit');
    });
  });

  describe('UI-driven YAML rewrite keeps undo history', () => {
    it('undoes the UI rewrite and then the typing that came before it', () => {
      const model = new FakeMonacoModel('');
      const opened = 'type: api\nurl: x\n';
      model.setValue(opened);
      model.type('# note\n');
      const typed = model.getValue();

      // "Add example" packs new YAML into the same editor.
      const packed = typed + 'examples:\n  - name: one\n';
      expect(planExternalMonacoApply(typed, packed)).toBe('edit');
      model.applySpan(computeMinimalEditSpan(typed, packed)!);
      expect(model.getValue()).toBe(packed);

      expect(model.undo()).toBe(true);
      expect(model.getValue()).toBe(typed);
      expect(model.undo()).toBe(true);
      expect(model.getValue()).toBe(opened);
      // The opened document stays the floor.
      expect(model.undo()).toBe(false);
    });
  });

  describe('end-to-end Windows edit loop', () => {
    it('keystroke does not rewrite document when only EOL would change', () => {
      const documentCrlf = ['type: api', 'url: https://example.com', 'method: get', ''].join('\r\n');
      // User typed in Monaco (LF). Same logical content.
      const webviewLf = normalizeNewlines(documentCrlf);
      expect(documentTextMatchesWebview(documentCrlf, webviewLf, '\r\n')).toBe(true);
    });

    it('body normalize on apply does not require local Monaco replace', () => {
      const typedInMonaco = 'line1\r\nline2\r\n';
      const appliedToYaml = normalizeNewlines(typedInMonaco);
      expect(appliedToYaml).toBe('line1\nline2\n');
      expect(shouldReplaceLocalEditorValue(typedInMonaco, appliedToYaml)).toBe(false);
    });
  });
});
