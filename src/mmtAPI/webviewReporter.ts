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
  /** When set, all report posts are tagged with this suite run id. */
  suiteRunId?: string;
  isAborted?: () => boolean;
  resolveChildId?: (runId: string) => string|undefined;
  rememberChildId?: (runId: string, id: string) => void;
}

/** Status/lifecycle scopes that should reach the UI immediately. */
const IMMEDIATE_REPORT_SCOPES = new Set([
  'suite-item',
  'suite-run-start',
  'suite-run-finished',
  'test-step-run',
  'test-outputs',
  'loadtest-summary',
]);

const REPORT_BATCH_MS = 50;

/**
 * Builds a reporter that owns all webview report posting for a run.
 *
 * - full: forwards every report event and extension lifecycle hooks to the UI panel
 * - lifecycle: only start/stop of a run (onRunStart / onRunEnd / matching scopes);
 *   step/item detail is ignored. Panel updates are off for this type (logs-only runs).
 *
 * Suite runs may overlap: each reporter always tags posts with its own suiteRunId.
 * The webview decides which suiteRunId is currently shown and ignores the rest.
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

  const pendingReports: Record<string, any>[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | undefined;

  const flushReports = () => {
    if (flushTimer !== undefined) {
      clearTimeout(flushTimer);
      flushTimer = undefined;
    }
    if (pendingReports.length === 0) {
      return;
    }
    const reports = pendingReports.splice(0, pendingReports.length);
    if (reports.length === 1) {
      post(reports[0]);
      return;
    }
    post({
      command: 'runFileReports',
      suiteRunId: options.suiteRunId,
      reports,
    });
  };

  const enqueueReport = (payload: Record<string, any>) => {
    pendingReports.push(payload);
    if (flushTimer !== undefined) {
      return;
    }
    flushTimer = setTimeout(() => {
      flushTimer = undefined;
      flushReports();
    }, REPORT_BATCH_MS);
  };

  const postReport = (payload: Record<string, any>, immediate: boolean) => {
    if (immediate) {
      flushReports();
      post(payload);
      return;
    }
    enqueueReport(payload);
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
        let id = typeof msg?.id === 'string' ? msg.id : undefined;
        if (!id && typeof msg?.runId === 'string' && msg.runId) {
          id = options.resolveChildId?.(msg.runId);
        }
        if (msg?.scope === 'suite-item' && typeof msg?.runId === 'string' &&
            msg.runId && id) {
          options.rememberChildId?.(msg.runId, id);
        }
        const scope = typeof msg?.scope === 'string' ? msg.scope : '';
        postReport({
          command: 'runFileReport',
          suiteRunId: options.suiteRunId,
          ...msg,
          id,
        }, IMMEDIATE_REPORT_SCOPES.has(scope));
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
      flushReports();
      post(payload);
    },
    onDebug: (payload) => {
      post(payload);
    },
    onCancelled: (payload) => {
      flushReports();
      post(payload);
    },
  };
}
