/** Merge into the webview setState blob without wiping unrelated keys (e.g. panel layout). */
export function patchWebviewState(patch: Record<string, unknown>): void {
  const api = (window as any).vscode;
  if (!api || typeof api.setState !== 'function') {
    return;
  }
  const prev =
      typeof api.getState === 'function' && api.getState() && typeof api.getState() === 'object' ?
      api.getState() as Record<string, unknown> :
      {};
  api.setState({...prev, ...patch});
}

export function readWebviewState<T = Record<string, unknown>>(): T|undefined {
  const api = (window as any).vscode;
  if (!api || typeof api.getState !== 'function') {
    return undefined;
  }
  const state = api.getState();
  return state && typeof state === 'object' ? state as T : undefined;
}
