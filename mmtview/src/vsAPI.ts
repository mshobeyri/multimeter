import {LogLevel} from 'mmt-core/CommonData';

let lastFileContentResolver: ((content: string) => void)|null = null;
let lastFileContentRejecter: ((error: any) => void)|null = null;

// Add the event listener only once
if (typeof window !== 'undefined' &&
    !(window as any).__fileContentListenerAdded) {
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message.command === 'fileContent') {
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
    window.vscode?.postMessage({command: 'getFileContent', filename});
  });
}

export function showVSCodeMessage(level: LogLevel, message: string) {
  window.vscode?.postMessage({
    command: 'showPopupMessage',
    level,
    message,
  });
}

export function logToOutput(level: LogLevel, message: string) {
  window.vscode?.postMessage({
    command: 'logToOutput',
    level,
    message,
  });
}

export function runJSCode(code: string, title: string) {
  window.vscode?.postMessage({
    command: 'runJSCode',
    code,
    title,
  });
}

export const pushHistory = (item: {
  type: 'send'|'recv'|'error',
  method: string,
  protocol: string,
  title: string,
  cookies?: Record<string, string>,
  headers?: Record<string, string>,
  query?: Record<string, string>,
  content?: string,
  time?: string
duration?: number
  status?: number
}) => {
  window.vscode?.postMessage({
    command: 'addHistory',
    item: {
      ...item,
      time: item.time ||
          new Date().toISOString().replace('T', ' ').substring(0, 19)
    }
  });
};

  export const importsToJsfunc = async (imports: Record<string, string>) => {
    const results =
        await Promise.all(Object.entries(imports).map(async ([name, path]) => {
          const content = await readFile(path);
          // ...process content...
          return `function ${name}() {${content}}`;
        }));
    return results.join('\n');
  };

export function openRelativeFile(filename: string) {
  window.vscode?.postMessage({ command: 'openRelativeFile', filename });
}