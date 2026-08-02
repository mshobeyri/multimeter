/**
 * Shared access to the `multimeter.body.auto.format` value inside the webview.
 *
 * The extension posts the `config` message once per document load. Panels that
 * mount later than that message would otherwise never see it, so the value is
 * cached on `window` and panels can ask the extension to resend the config.
 */

const CACHE_KEY = "__mmtBodyAutoFormat";

function webviewWindow(): any {
  return typeof globalThis === "undefined" ? undefined : (globalThis as any).window;
}

export function cacheBodyAutoFormat(value: boolean): void {
  const win = webviewWindow();
  if (!win) {
    return;
  }
  win[CACHE_KEY] = value;
}

export function readCachedBodyAutoFormat(): boolean {
  const win = webviewWindow();
  return !!win && win[CACHE_KEY] === true;
}

export function requestEditorConfig(): void {
  const win = webviewWindow();
  win?.vscode?.postMessage({ command: "requestConfig" });
}
