export type LeafStateReset = 'all' | readonly string[];

function shouldClearKey(key: string, targets: readonly string[]): boolean {
  for (const id of targets) {
    if (!id) {
      continue;
    }
    // Clear the target itself and any descendant bundle ids (prefix match).
    if (key === id || key.startsWith(`${id}.`)) {
      return true;
    }
  }
  return false;
}

export function resetLeafStateMap<T>(state: Record<string, T>, reset: LeafStateReset): Record<string, T> {
  if (reset === 'all') {
    return {};
  }
  if (!Array.isArray(reset) || reset.length === 0) {
    return state;
  }

  let next: Record<string, T> | null = null;
  for (const key of Object.keys(state)) {
    if (!shouldClearKey(key, reset)) {
      continue;
    }
    if (!next) {
      next = { ...state };
    }
    delete next[key];
  }

  return next || state;
}
