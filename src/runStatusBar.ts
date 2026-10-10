import * as vscode from 'vscode';

export type RunStatusMenuItem = {label: string; id: string};

interface ActiveRun {
  label: string;
  uri?: vscode.Uri;
  onStop?: () => void;
  /** Run in Core: click shows Stop/Open (no separate stop badge). */
  actionsMenu: boolean;
  /** Custom click menu (e.g. panel-started mock). Overrides actionsMenu. */
  menuItems?: RunStatusMenuItem[];
  onMenuAction?: (id: string) => void|Promise<void>;
  statusBarItem: vscode.StatusBarItem;
}

const activeRuns = new Map<string, ActiveRun>();
let runCounter = 0;
let extensionContext: vscode.ExtensionContext;

const ACTION_COMMAND_ID = 'multimeter.activeRunAction';

/**
 * Left-aligned: higher priority is further left. Use a low priority so runs
 * sit at the end of the left status-bar group (same as before).
 */
const RUN_STATUS_PRIORITY = 0;

export function registerRunStatusBar(context: vscode.ExtensionContext): void {
  extensionContext = context;
  context.subscriptions.push(
      vscode.commands.registerCommand(ACTION_COMMAND_ID, async (runId?: string) => {
        const run = resolveRun(runId);
        if (!run) {
          return;
        }
        await runActiveRunAction(run);
      }),
  );
}

function resolveRun(runId?: string): ActiveRun|undefined {
  if (runId) {
    return activeRuns.get(runId);
  }
  return [...activeRuns.values()].pop();
}

async function runActiveRunAction(run: ActiveRun): Promise<void> {
  if (run.menuItems && run.menuItems.length > 0) {
    if (run.menuItems.length === 1) {
      await run.onMenuAction?.(run.menuItems[0].id);
      return;
    }
    const pick = await vscode.window.showQuickPick(
        run.menuItems.map(item => ({label: item.label, id: item.id})),
        {title: run.label, placeHolder: 'Choose an action'});
    if (!pick) {
      return;
    }
    await run.onMenuAction?.(pick.id);
    return;
  }

  if (!run.actionsMenu) {
    if (run.uri) {
      await openRunUri(run.uri);
    }
    return;
  }

  // Run in Core only: Stop + Open as commands (never a separate stop badge).
  const items: Array<{label: string; action: 'stop'|'open'}> = [];
  if (typeof run.onStop === 'function') {
    items.push({label: '$(debug-stop) Stop', action: 'stop'});
  }
  if (run.uri) {
    items.push({label: '$(file) Open file', action: 'open'});
  }
  if (items.length === 0) {
    return;
  }
  if (items.length === 1) {
    await applyRunAction(run, items[0].action);
    return;
  }
  const pick = await vscode.window.showQuickPick(items, {
    title: run.label,
    placeHolder: 'Choose an action',
  });
  if (!pick) {
    return;
  }
  await applyRunAction(run, pick.action);
}

async function applyRunAction(
    run: ActiveRun, action: 'stop'|'open'): Promise<void> {
  if (action === 'stop') {
    run.onStop?.();
    return;
  }
  if (run.uri) {
    await openRunUri(run.uri);
  }
}

async function openRunUri(uri: vscode.Uri): Promise<void> {
  try {
    await vscode.commands.executeCommand('vscode.open', uri);
  } catch {
    // Best-effort: status bar click must not throw.
  }
}

export function onRunStarted(
    label: string,
    options?: {
      uri?: vscode.Uri;
      icon?: string;
      onStop?: () => void;
      /** True for Run in Core — click opens Stop/Open commands (no stop badge). */
      actionsMenu?: boolean;
      /** Custom menu (e.g. panel mock: Open panel / Open file). */
      menuItems?: RunStatusMenuItem[];
      onMenuAction?: (id: string) => void|Promise<void>;
    }): string {
  const runId = `run-${++runCounter}`;
  const icon = options?.icon || 'sync~spin';
  const hasCustomMenu = Boolean(options?.menuItems?.length);
  const actionsMenu = !hasCustomMenu && options?.actionsMenu === true;
  const hasMenu = hasCustomMenu || actionsMenu;

  const item = vscode.window.createStatusBarItem(
      `run.${runId}`, vscode.StatusBarAlignment.Left, RUN_STATUS_PRIORITY);
  item.name = 'Multimeter Run';
  item.text = `$(${icon}) ${label}`;
  item.command = {
    command: ACTION_COMMAND_ID,
    arguments: [runId],
    title: hasMenu ? 'Run actions' : 'Open File',
  };
  item.tooltip = hasMenu ? `${label} — click for actions` :
                           `${label} — click to open`;
  item.show();
  extensionContext.subscriptions.push(item);

  activeRuns.set(runId, {
    label,
    uri: options?.uri,
    onStop: options?.onStop,
    actionsMenu,
    menuItems: options?.menuItems,
    onMenuAction: options?.onMenuAction,
    statusBarItem: item,
  });
  return runId;
}

export function onRunFinished(runId: string): void {
  const run = activeRuns.get(runId);
  if (!run) {
    return;
  }
  run.statusBarItem.hide();
  run.statusBarItem.dispose();
  activeRuns.delete(runId);
}
