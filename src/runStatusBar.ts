import * as vscode from 'vscode';

interface ActiveRun {
  label: string;
  uri?: vscode.Uri;
  statusBarItem: vscode.StatusBarItem;
}

const activeRuns = new Map<string, ActiveRun>();
let runCounter = 0;
let extensionContext: vscode.ExtensionContext;

const COMMAND_ID = 'multimeter.focusActiveRun';

export function registerRunStatusBar(context: vscode.ExtensionContext): void {
  extensionContext = context;
  context.subscriptions.push(
      vscode.commands.registerCommand(COMMAND_ID, async (runId?: string) => {
        const run = runId ? activeRuns.get(runId) :
                            [...activeRuns.values()].pop();
        if (!run?.uri) {
          return;
        }
        try {
          await vscode.commands.executeCommand('vscode.open', run.uri);
        } catch {
          // Best-effort: status bar click must not throw.
        }
      }));
}

export function onRunStarted(
    label: string,
    options?: {uri?: vscode.Uri; icon?: string}): string {
  const runId = `run-${++runCounter}`;
  const icon = options?.icon || 'sync~spin';
  const item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left, 0);
  if (options?.uri) {
    item.command = {
      command: COMMAND_ID,
      arguments: [runId],
      title: 'Open File',
    };
    item.tooltip = `${label} — click to open`;
  } else {
    item.tooltip = label;
  }
  item.text = `$(${icon}) ${label}`;
  item.show();
  extensionContext.subscriptions.push(item);

  activeRuns.set(runId, {label, uri: options?.uri, statusBarItem: item});
  return runId;
}

export function onRunFinished(runId: string): void {
  const run = activeRuns.get(runId);
  if (run) {
    run.statusBarItem.hide();
    run.statusBarItem.dispose();
    activeRuns.delete(runId);
  }
}
