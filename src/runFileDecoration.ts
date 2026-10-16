import * as vscode from 'vscode';

type ActiveDecoration = {runId: string; label: string; paused?: boolean};

const byUri = new Map<string, ActiveDecoration[]>();
const uriByRunId = new Map<string, vscode.Uri>();
const onDidChange =
    new vscode.EventEmitter<vscode.Uri|vscode.Uri[]|undefined>();

/**
 * Explorer / tab badge for files with an active Multimeter run or mock.
 * Hooked from onRunStarted / onRunFinished in runStatusBar.
 */
export function registerRunFileDecoration(
    context: vscode.ExtensionContext): void {
  context.subscriptions.push(
      onDidChange,
      vscode.window.registerFileDecorationProvider({
        onDidChangeFileDecorations: onDidChange.event,
        provideFileDecoration(uri) {
          const runs = byUri.get(uri.toString());
          if (!runs || runs.length === 0) {
            return undefined;
          }
          const latest = runs[runs.length - 1];
          const paused = latest.paused === true;
          return {
            badge: paused ? '⏸' : '▶',
            tooltip: paused ? `Paused — ${latest.label}` : latest.label,
            color: new vscode.ThemeColor(
                paused ? 'charts.yellow' : 'debugIcon.startForeground'),
          };
        },
      }),
  );
}

export function decorateRunStarted(
    runId: string, uri: vscode.Uri|undefined, label: string): void {
  if (!uri) {
    return;
  }
  const key = uri.toString();
  uriByRunId.set(runId, uri);
  const list = byUri.get(key) ?? [];
  list.push({runId, label, paused: false});
  byUri.set(key, list);
  onDidChange.fire(uri);
}

/** Switch the tab/explorer run badge between play (▶) and pause (⏸). */
export function decorateRunPaused(runId: string, paused: boolean): void {
  const uri = uriByRunId.get(runId);
  if (!uri) {
    return;
  }
  const list = byUri.get(uri.toString());
  if (!list) {
    return;
  }
  const entry = list.find(r => r.runId === runId);
  if (!entry || entry.paused === paused) {
    return;
  }
  entry.paused = paused;
  onDidChange.fire(uri);
}

export function decorateRunFinished(runId: string): void {
  const uri = uriByRunId.get(runId);
  if (!uri) {
    return;
  }
  uriByRunId.delete(runId);
  const key = uri.toString();
  const list = (byUri.get(key) ?? []).filter(r => r.runId !== runId);
  if (list.length === 0) {
    byUri.delete(key);
  } else {
    byUri.set(key, list);
  }
  onDidChange.fire(uri);
}
