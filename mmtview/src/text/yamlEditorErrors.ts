import {parseYamlDoc} from 'mmt-core/markupConvertor';
import {validateYamlContent} from './Validate';
import {findAuthProblems, findStageAfterProblems} from './validator';

export const REVEAL_YAML_EVENT = 'mmt-reveal-yaml-error';

export type YamlEditorError = {
  message: string;
  line?: number;
  column?: number;
};

function dedupeErrors(errors: YamlEditorError[]): YamlEditorError[] {
  const seen = new Set<string>();
  return errors.filter((error) => {
    const key = `${error.line ?? 0}:${error.column ?? 0}:${error.message}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function parseErrorsFromYamlDoc(doc: {errors?: any[]} | null | undefined): YamlEditorError[] {
  if (!doc?.errors?.length) {
    return [];
  }
  return doc.errors.map((error: any) => {
    const start = error.linePos?.[0];
    return {
      message: String(error.message || 'YAML parse error'),
      line: start?.line,
      column: start?.col,
    };
  });
}

/** Error-severity issues shown in the YAML editor (parse, schema, auth, stage after). */
export function collectYamlEditorErrors(content: string): YamlEditorError[] {
  if (!content.trim()) {
    return [];
  }

  try {
    const doc = parseYamlDoc(content);
    const parseErrors = parseErrorsFromYamlDoc(doc);
    if (parseErrors.length > 0) {
      return dedupeErrors(parseErrors);
    }

    const errors: YamlEditorError[] = [];
    for (const marker of validateYamlContent(content)) {
      if (marker?.message) {
        errors.push({
          message: String(marker.message),
          line: marker.startLineNumber,
          column: marker.startColumn,
        });
      }
    }

    let parsed: any = null;
    try {
      parsed = doc?.toJS?.() ?? null;
    } catch {
      parsed = null;
    }
    const docType = typeof parsed?.type === 'string' ? parsed.type : null;
    if (docType) {
      for (const problem of findAuthProblems(content, doc, docType)) {
        if (problem.severity === 'error') {
          errors.push({
            message: problem.message,
            line: problem.line,
            column: problem.column,
          });
        }
      }
      for (const problem of findStageAfterProblems(content, doc, docType)) {
        if (problem.severity === 'error') {
          errors.push({
            message: problem.message,
            line: problem.line,
            column: problem.column,
          });
        }
      }
    }

    return dedupeErrors(errors);
  } catch (error: any) {
    return [{
      message: error?.message ? String(error.message) : 'Failed to parse YAML document.',
    }];
  }
}

export function revealYamlEditorError(error: YamlEditorError): void {
  if (!error.line) {
    return;
  }
  window.dispatchEvent(new CustomEvent(REVEAL_YAML_EVENT, {
    detail: {
      line: error.line,
      column: error.column || 1,
    },
  }));
}
