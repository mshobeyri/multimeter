/**
 * Bridge from the right-panel Inputs / API tester UI to the YAML editor.
 * Monaco actions read the latest values at click time without coupling React trees.
 */

type LiveApiUiEntry = {
  filePath?: string;
  inputs: Record<string, unknown>;
  exampleIndex?: number;
  /** Resolved request snapshot from the API tester (same as Run in Curl). */
  request?: Record<string, unknown>;
};

let live: LiveApiUiEntry = {inputs: {}};

/** Publish Inputs panel values for the open document. */
export function setLiveInputs(
    filePath: string | undefined,
    inputs: Record<string, unknown> | null | undefined,
    extras?: {
      exampleIndex?: number;
      request?: Record<string, unknown> | null;
    }): void {
  live = {
    filePath,
    inputs: inputs && typeof inputs === 'object' && !Array.isArray(inputs) ?
        {...inputs} :
        {},
    exampleIndex: typeof extras?.exampleIndex === 'number' ?
        extras.exampleIndex :
        undefined,
    request: extras?.request && typeof extras.request === 'object' ?
        {...extras.request} :
        undefined,
  };
}

/** Clear when an Inputs panel unmounts so another file does not reuse them. */
export function clearLiveInputs(filePath?: string): void {
  if (filePath && live.filePath && live.filePath !== filePath) {
    return;
  }
  live = {inputs: {}};
}

/**
 * Inputs for `filePath` when the store matches that document; otherwise `{}`
 * so file `inputs:` defaults still apply via replaceAllRefs.
 */
export function getLiveInputs(filePath?: string): Record<string, unknown> {
  if (filePath && live.filePath && live.filePath !== filePath) {
    return {};
  }
  return {...live.inputs};
}

/** Example index + manual inputs shape used by curl / run messages. */
export function getLiveRunInputs(filePath?: string): {
  exampleIndex?: number;
  manualInputs: Record<string, unknown>;
} {
  if (filePath && live.filePath && live.filePath !== filePath) {
    return {manualInputs: {}};
  }
  return {
    exampleIndex: live.exampleIndex,
    manualInputs: {...live.inputs},
  };
}

/** Resolved request from the API tester when available for this file. */
export function getLiveRequest(
    filePath?: string): Record<string, unknown> | undefined {
  if (filePath && live.filePath && live.filePath !== filePath) {
    return undefined;
  }
  return live.request ? {...live.request} : undefined;
}
