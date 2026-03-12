import {LogLevel} from 'mmt-core/CommonData';
import {SuiteTreeNode} from './suite/test/suiteHierarchy';

let lastFileContentResolver: ((content: string) => void)|null = null;
let lastFileContentRejecter: ((error: any) => void)|null = null;
let lastFileDataUrlResolver: ((dataUrl: string) => void)|null = null;
let lastFileDataUrlRejecter: ((error: any) => void)|null = null;
const osFilePickerResolvers: Map<string, (value: any) => void> = new Map();
const osFilePickerRejecters: Map<string, (err: any) => void> = new Map();

const suiteHierarchyResolvers: Map<string, (value: any) => void> = new Map();
const suiteHierarchyRejecters: Map<string, (err: any) => void> = new Map();

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
    } else if (message.command === 'fileDataUrl') {
      if (message.error && lastFileDataUrlRejecter) {
        lastFileDataUrlRejecter(message.error);
      } else if (lastFileDataUrlResolver) {
        lastFileDataUrlResolver(message.dataUrl);
      }
      lastFileDataUrlResolver = null;
      lastFileDataUrlRejecter = null;
    } else if (message.command === 'osFilePickerResult') {
      const id = message?.requestId;
      if (id && osFilePickerResolvers.has(id)) {
        const resolve = osFilePickerResolvers.get(id)!;
        const reject = osFilePickerRejecters.get(id);
        osFilePickerResolvers.delete(id);
        osFilePickerRejecters.delete(id);
        if (message.error) {
          if (reject) {
            reject(message.error);
          } else {
            resolve({error: message.error});
          }
        } else if (message.cancelled) {
          resolve({cancelled: true});
        } else {
          resolve({filePath: message.filePath, filePaths: message.filePaths});
        }
      }
    } else if (message.command === 'suiteHierarchyResult') {
      const id = message?.requestId;
      if (id && suiteHierarchyResolvers.has(id)) {
        const resolve = suiteHierarchyResolvers.get(id)!;
        const reject = suiteHierarchyRejecters.get(id);
        suiteHierarchyResolvers.delete(id);
        suiteHierarchyRejecters.delete(id);
        if (message.error) {
          if (reject) {
            reject(message.error);
          } else {
            resolve({error: message.error});
          }
        } else {
          resolve(message);
        }
      }
    }
  });
  (window as any).__fileContentListenerAdded = true;
}

export function readFile(filename: string, options?: { silent?: boolean }): Promise<string> {
  return new Promise((resolve, reject) => {
    lastFileContentResolver = resolve;
    lastFileContentRejecter = reject;
    window.vscode?.postMessage({command: 'getFileContent', filename, silent: options?.silent});
  });
}

export function readFileAsDataUrl(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    lastFileDataUrlResolver = resolve;
    lastFileDataUrlRejecter = reject;
    window.vscode?.postMessage({command: 'getFileAsDataUrl', filename});
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

export type OsPickerResult = {
  filePath?: string;
  filePaths?: string[];
  cancelled?: boolean;
  error?: string
};

export function openOsFilePicker(opts: {
  filters?: any;
  defaultPath?: string;
  canSelectMany?: boolean;
  canSelectFolders?: boolean;
  openLabel?: string;
}): Promise<OsPickerResult> {
  const requestId =
      `ospicker-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return new Promise((resolve, reject) => {
    osFilePickerResolvers.set(requestId, resolve);
    osFilePickerRejecters.set(requestId, reject);
    window.vscode?.postMessage({
      command: 'openOsFilePicker',
      requestId,
      filters: opts?.filters,
      defaultPath: opts?.defaultPath,
      canSelectMany: !!opts?.canSelectMany,
      canSelectFolders: !!opts?.canSelectFolders,
      openLabel: opts?.openLabel,
    });
    // Add a timeout to avoid leaked promises (optional: 2 minutes)
    setTimeout(() => {
      if (osFilePickerResolvers.has(requestId)) {
        osFilePickerResolvers.delete(requestId);
        osFilePickerRejecters.delete(requestId);
        resolve({cancelled: true});
      }
    }, 2 * 60 * 1000);
  });
}

export type SuiteHierarchyResult = {
  command: 'suiteHierarchyResult';
  requestId?: string;
  filename?: string;
  suiteFilePath?: string;
  tree?: SuiteTreeNode;
  error?: string;
};

export function getSuiteHierarchy(filename: string, leafPrefix?: string): Promise<SuiteHierarchyResult> {
  const requestId = `suite-hierarchy-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  return new Promise((resolve, reject) => {
    suiteHierarchyResolvers.set(requestId, resolve);
    suiteHierarchyRejecters.set(requestId, reject);
    window.vscode?.postMessage({command: 'getSuiteHierarchy', requestId, filename, leafPrefix});
    setTimeout(() => {
      if (suiteHierarchyResolvers.has(requestId)) {
        suiteHierarchyResolvers.delete(requestId);
        suiteHierarchyRejecters.delete(requestId);
        resolve({command: 'suiteHierarchyResult', requestId, filename, error: 'timeout'});
      }
    }, 2 * 60 * 1000);
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

  export function openRelativeFile(filename: string, fragment?: string) {
    window.vscode?.postMessage({command: 'openRelativeFile', filename, fragment});
  }

  export function showHistoryPanel() {
    window.vscode?.postMessage({command: 'openHistoryPanel'});
  }