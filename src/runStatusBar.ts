import * as vscode from 'vscode';

let statusBarItem: vscode.StatusBarItem;
let activeAbort: (() => void) | null = null;
let runLabel: string = '';

const COMMAND_ID = 'multimeter.stopActiveRun';

export function registerRunStatusBar(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(COMMAND_ID, () => {
      if (activeAbort) {
        activeAbort();
      }
    }));

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left, 0);
  statusBarItem.command = COMMAND_ID;
  context.subscriptions.push(statusBarItem);
}

export function onRunStarted(label: string, abort: () => void): void {
  activeAbort = abort;
  runLabel = label;
  statusBarItem.text = `$(sync~spin) ${label}`;
  statusBarItem.tooltip = `${label} — click to stop`;
  statusBarItem.show();
}

export function onRunFinished(): void {
  activeAbort = null;
  runLabel = '';
  statusBarItem.hide();
}
