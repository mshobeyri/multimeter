import * as vscode from 'vscode';

/**
 * How run events are surfaced to the webview UI panel.
 * - full: all reporter events + suite/document lifecycle messages
 * - lifecycle: only run start/stop (no per-step / panel report updates)
 */
export type WebviewReportType = 'full'|'lifecycle';

export interface WebviewReportConfig {
  type?: WebviewReportType;
}

export function resolveWebviewReportType(message: any): WebviewReportType {
  const raw = message?.report?.type ?? message?.reportType;
  return raw === 'lifecycle' ? 'lifecycle' : 'full';
}

export interface WebviewRunReporter {
  /** Report type in effect. */
  readonly type: WebviewReportType;
  /** True when the UI panel should receive full report/lifecycle traffic. */
  readonly updatesPanel: boolean;
  /** Core `runner.runFile` reporter callback. */
  report: (msg: any) => void;
  /** Extension-level suite/document run started (UI hook). */
  onRunStart: (payload: Record<string, any>) => void;
  /** Extension-level suite/document run finished (UI hook). */
  onRunEnd: (payload: Record<string, any>) => void;
  /** Optional debug payloads such as suiteBundle. */
  onDebug: (payload: Record<string, any>) => void;
  /** Post testRunStopped / similar cancel notices. */
  onCancelled: (payload: Record<string, any>) => void;
  /** Whether to show VS Code error/prompt UI for this run. */
  readonly notifyHost: boolean;
}

export interface CreateWebviewRunReporterOptions {
  type: WebviewReportType;
  webviewPanel: vscode.WebviewPanel;
  /** When set, reporter is scoped to an active suite run. */
  suiteRunId?: string;
  getActiveSuiteRunId?: () => string|undefined;
  isAborted?: () => boolean;
  resolveChildId?: (runId: string) => string|undefined;
  rememberChildId?: (runId: string, id: string) => void;
}

/**
 * Builds a reporter that owns all webview report posting for a run.
 *
 * - full: forwards every report event and extension lifecycle hooks to the UI panel
 * - lifecycle: only start/stop of a run (onRunStart / onRunEnd / matching scopes);
 *   step/item detail is ignored. Panel updates are off for this type (logs-only runs).
 */
export function createWebviewRunReporter(
    options: CreateWebviewRunReporterOptions): WebviewRunReporter {
  const type = options.type === 'lifecycle' ? 'lifecycle' : 'full';
  const updatesPanel = type === 'full';
  const {webviewPanel} = options;

  const post = (payload: Record<string, any>) => {
    if (!updatesPanel) {
      return;
    }
    webviewPanel.webview.postMessage(payload);
  };

  return {
    type,
    updatesPanel,
    notifyHost: updatesPanel,
    report: (msg: any) => {
      if (type === 'lifecycle') {
        // Start/stop are handled via onRunStart / onRunEnd; ignore step reports.
        return;
      }
      if (options.isAborted?.()) {
        return;
      }
      if (options.suiteRunId) {
        const currentId = options.getActiveSuiteRunId?.();
        if (currentId && currentId !== options.suiteRunId) {
          return;
        }
        let id = typeof msg?.id === 'string' ? msg.id : undefined;
        if (!id && typeof msg?.runId === 'string' && msg.runId) {
          id = options.resolveChildId?.(msg.runId);
        }
        if (msg?.scope === 'suite-item' && typeof msg?.runId === 'string' &&
            msg.runId && id) {
          options.rememberChildId?.(msg.runId, id);
        }
        post({
          command: 'runFileReport',
          suiteRunId: options.suiteRunId,
          ...msg,
          id,
        });
        return;
      }
      post({
        command: 'runFileReport',
        ...msg,
      });
    },
    onRunStart: (payload) => {
      post(payload);
    },
    onRunEnd: (payload) => {
      post(payload);
    },
    onDebug: (payload) => {
      post(payload);
    },
    onCancelled: (payload) => {
      post(payload);
    },
  };
}
