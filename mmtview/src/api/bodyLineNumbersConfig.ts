/**
 * Shared access to `multimeter.body.lineNumbers` inside the webview.
 * Cached on `window` so late-mounted BodyViews still see the last config.
 */

const CACHE_KEY = "__mmtBodyLineNumbers";

function webviewWindow(): any {
  return typeof globalThis === "undefined" ? undefined : (globalThis as any).window;
}

export function cacheBodyLineNumbers(value: boolean): void {
  const win = webviewWindow();
  if (!win) {
    return;
  }
  win[CACHE_KEY] = value;
}

/** Default false — BodyView historically hid line numbers. */
export function readCachedBodyLineNumbers(): boolean {
  const win = webviewWindow();
  return !!win && win[CACHE_KEY] === true;
}

export function requestEditorConfig(): void {
  const win = webviewWindow();
  win?.vscode?.postMessage({ command: "requestConfig" });
}

export function setBodyLineNumbersConfig(value: boolean): void {
  cacheBodyLineNumbers(value);
  const win = webviewWindow();
  win?.vscode?.postMessage({
    command: "updateConfig",
    fullKey: "multimeter.body.lineNumbers",
    value,
  });
  win?.dispatchEvent(new CustomEvent("multimeter.config", {
    detail: { command: "config", bodyLineNumbers: value },
  }));
}
