import * as vscode from 'vscode';

/** Single Views dock in the bottom Multimeter panel. Keeps a real pane header
 * so VS Code can show a drop overlay when relocating views. Webview-only
 * containers hide that header in merged single-view mode (vscode#144122). */
export const PANEL_DOCK_VIEW_ID = 'multimeter.panelDock';

/** Full view-container ids VS Code registers for our contributes.viewsContainers. */
export const ACTIVITY_CONTAINER_ID = 'workbench.view.extension.multimeter-activitybar';
export const PANEL_CONTAINER_ID = 'workbench.view.extension.multimeter-panel';

export const ENVIRONMENT_VIEW_ID = 'multimeter.environment';
export const HISTORY_VIEW_ID = 'multimeter.history';

const SIDEBAR_VIEW_IDS = [
  'multimeter.tempFiles',
  'multimeter.start',
  'multimeter.mock.server',
  'multimeter.connections',
  'multimeter.cache',
] as const;

const PANEL_VIEW_IDS = [ENVIRONMENT_VIEW_ID, HISTORY_VIEW_ID] as const;

interface DockEntry {
  label: string;
  viewId?: string;
  icon: string;
  command?: string;
  tooltip?: string;
}

const DOCK_ENTRIES: DockEntry[] = [
  {label: 'Temp Files', viewId: 'multimeter.tempFiles', icon: 'file'},
  {label: 'Get Started', viewId: 'multimeter.start', icon: 'rocket'},
  {label: 'Mock Server', viewId: 'multimeter.mock.server', icon: 'server'},
  {label: 'Connections', viewId: 'multimeter.connections', icon: 'plug'},
  {label: 'Cache', viewId: 'multimeter.cache', icon: 'database'},
  {label: 'Environment Variables', viewId: ENVIRONMENT_VIEW_ID, icon: 'symbol-variable'},
  {label: 'History', viewId: HISTORY_VIEW_ID, icon: 'history'},
  {
    label: 'Reset panels state',
    icon: 'discard',
    command: 'multimeter.views.resetPanels',
    tooltip: 'Restore default Multimeter panel layout',
  },
];

class DockTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return DOCK_ENTRIES.map(entry => {
      const item = new vscode.TreeItem(entry.label, vscode.TreeItemCollapsibleState.None);
      item.id = entry.command || entry.viewId;
      item.iconPath = new vscode.ThemeIcon(entry.icon);
      item.tooltip = entry.tooltip || `Show ${entry.label}`;
      if (entry.command) {
        item.command = {command: entry.command, title: entry.label};
      } else if (entry.viewId) {
        item.command = {
          command: `${entry.viewId}.focus`,
          title: `Focus ${entry.label}`,
        };
      }
      return item;
    });
  }
}

/**
 * Move Environment + History into a Multimeter container. Prefer the bottom
 * panel (with Views); sidebar is available via the group-in-sidebar command.
 */
export async function moveEnvironmentAndHistoryTo(
    destinationId: typeof ACTIVITY_CONTAINER_ID|typeof PANEL_CONTAINER_ID,
): Promise<void> {
  await vscode.commands.executeCommand('vscode.moveViews', {
    viewIds: [...PANEL_VIEW_IDS],
    destinationId,
  });
}

/** Default layout: sidebar webviews left; collapsed Views + Env + History bottom. */
export async function resetPanelsState(): Promise<void> {
  await vscode.commands.executeCommand('vscode.moveViews', {
    viewIds: [...SIDEBAR_VIEW_IDS],
    destinationId: ACTIVITY_CONTAINER_ID,
  });
  await vscode.commands.executeCommand('vscode.moveViews', {
    viewIds: [PANEL_DOCK_VIEW_ID, ...PANEL_VIEW_IDS],
    destinationId: PANEL_CONTAINER_ID,
  });
  try {
    // Keep Views collapsed; show Environment as the active bottom tab.
    await vscode.commands.executeCommand(`${ENVIRONMENT_VIEW_ID}.focus`);
  } catch {
    /* Panel may be hidden; layout still restored. */
  }
}

const ENV_HISTORY_PANEL_MIGRATION_KEY = 'multimeter.views.envHistoryPanel.v2';

export function registerMultimeterDockTrees(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
      vscode.window.registerTreeDataProvider(PANEL_DOCK_VIEW_ID, new DockTreeProvider()),
      vscode.commands.registerCommand(
          'multimeter.views.groupInSidebar',
          () => moveEnvironmentAndHistoryTo(ACTIVITY_CONTAINER_ID)),
      vscode.commands.registerCommand(
          'multimeter.views.groupInPanel',
          () => moveEnvironmentAndHistoryTo(PANEL_CONTAINER_ID)),
      vscode.commands.registerCommand(
          'multimeter.views.resetPanels',
          () => resetPanelsState()),
  );

  // One-shot: park Environment/History in the bottom Multimeter panel with Views.
  if (!context.globalState.get(ENV_HISTORY_PANEL_MIGRATION_KEY)) {
    void (async () => {
      try {
        await resetPanelsState();
        await context.globalState.update(ENV_HISTORY_PANEL_MIGRATION_KEY, true);
      } catch {
        // Destination may be unavailable during early activate; user can retry
        // via Multimeter: Reset Panels State.
      }
    })();
  }
}
