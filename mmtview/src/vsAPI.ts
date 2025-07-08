let lastFileContentResolver: ((content: string) => void) | null = null;
let lastFileContentRejecter: ((error: any) => void) | null = null;

// Add the event listener only once
if (typeof window !== "undefined" && !(window as any).__fileContentListenerAdded) {
  window.addEventListener("message", (event: MessageEvent) => {
    const message = event.data;
    if (message.command === "fileContent") {
      if (message.error && lastFileContentRejecter) {
        lastFileContentRejecter(message.error);
      } else if (lastFileContentResolver) {
        lastFileContentResolver(message.content);
      }
      lastFileContentResolver = null;
      lastFileContentRejecter = null;
    }
  });
  (window as any).__fileContentListenerAdded = true;
}

export function readFile(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    lastFileContentResolver = resolve;
    lastFileContentRejecter = reject;
    window.vscode?.postMessage({ command: "getFileContent", filename });
  });
}

export function showVSCodeMessage(type: "error" | "warning", message: string) {
  window.vscode?.postMessage({
    command: type === "error" ? "showErrorMessage" : "showWarningMessage",
    message,
  });
}