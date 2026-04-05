import * as vscode from 'vscode';

interface ActiveRun {
  label: string;
  abort: () => void;
  statusBarItem: vscode.StatusBarItem;
}

const activeRuns = new Map<string, ActiveRun>();
let runCounter = 0;
let extensionContext: vscode.ExtensionContext;

const COMMAND_ID = 'multimeter.stopActiveRun';

export function registerRunStatusBar(context: vscode.ExtensionContext): void {
  extensionContext = context;
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_ID, (runId?: string) => {
      if (runId) {
        const run = activeRuns.get(runId);
        if (run) {
          run.abort();
        }
      } else {
        // Stop the most recent run if no runId provided
        const last = [...activeRuns.values()].pop();
        if (last) {
          last.abort();
        }
      }
    }));
}

export function onRunStarted(label: string, abort: () => void): string {
  const runId = `run-${++runCounter}`;
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left, 0);
  item.command = { command: COMMAND_ID, arguments: [runId], title: 'Stop Run' };
  item.text = `$(sync~spin) ${label}`;
  item.tooltip = `${label} — click to stop`;
  item.show();
  extensionContext.subscriptions.push(item);

  activeRuns.set(runId, { label, abort, statusBarItem: item });
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
