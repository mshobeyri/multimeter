/** True when the user intends to open the file (Ctrl on Win/Linux, Cmd or Ctrl on Mac). */
export function isOpenFileModifier(event: {
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return event.ctrlKey || event.metaKey;
}

export function suiteFileLabelTitle(path: string): string {
  return `${path}\nClick to expand · Ctrl/Cmd+click to open`;
}

/**
 * Suite hierarchy label behavior:
 * - plain click / Enter → expand/collapse the box
 * - Ctrl/Cmd+click / Ctrl/Cmd+Enter → open the corresponding .mmt file
 */
export function handleSuiteFileLabelActivate(opts: {
  event: { preventDefault: () => void; stopPropagation: () => void };
  isMissing: boolean;
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
    opts.openRelativeFile(opts.path);
    return;
  }
  opts.toggleExpanded?.();
}
