/** True when the user intends to open the file (Ctrl on Win/Linux, Cmd or Ctrl on Mac). */
export function isOpenFileModifier(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return event.ctrlKey || event.metaKey;
}

export function fileLabelTitle(path: string): string {
  return `${path}\nClick to expand · Ctrl/Cmd+click to open`;
}

/** @deprecated Use fileLabelTitle */
export const suiteFileLabelTitle = fileLabelTitle;

/**
 * Tree label behavior shared by suite and report panels:
 * - plain click / Enter → expand/collapse the box
 * - Ctrl/Cmd+click / Ctrl/Cmd+Enter → open the corresponding file
 */
export function handleFileLabelActivate(opts: {
  event: { preventDefault: () => void; stopPropagation: () => void };
  isMissing?: boolean;
  path: string;
  openFile: boolean;
  toggleExpanded: (() => void) | undefined;
  openRelativeFile: (path: string) => void;
}): void {
  if (opts.isMissing) {
    return;
  }
  opts.event.preventDefault();
  opts.event.stopPropagation();
  if (opts.openFile) {
    if (opts.path) {
      opts.openRelativeFile(opts.path);
    }
    return;
  }
  opts.toggleExpanded?.();
}

/** @deprecated Use handleFileLabelActivate */
export const handleSuiteFileLabelActivate = handleFileLabelActivate;
