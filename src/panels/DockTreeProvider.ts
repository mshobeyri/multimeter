import * as vscode from 'vscode';

/** Collapsed tree views that keep a real pane header so VS Code can show a
 * drop overlay when relocating views. Webview-only containers hide that
 * header in merged single-view mode (vscode#144122). */
export const ACTIVITY_DOCK_VIEW_ID = 'multimeter.activityDock';
export const PANEL_DOCK_VIEW_ID = 'multimeter.panelDock';

/** Full view-container ids VS Code registers for our contributes.viewsContainers. */
export const ACTIVITY_CONTAINER_ID = 'workbench.view.extension.multimeter-activitybar';
export const PANEL_CONTAINER_ID = 'workbench.view.extension.multimeter-panel';

export const ENVIRONMENT_VIEW_ID = 'multimeter.environment';
export const HISTORY_VIEW_ID = 'multimeter.history';

interface DockEntry {
  label: string;
  viewId: string;
  icon: string;
}

const DOCK_ENTRIES: DockEntry[] = [
  {label: 'Temp Files', viewId: 'multimeter.tempFiles', icon: 'file'},
  {label: 'Get Started', viewId: 'multimeter.start', icon: 'rocket'},
  {label: 'Mock Server', viewId: 'multimeter.mock.server', icon: 'server'},
  {label: 'Connections', viewId: 'multimeter.connections', icon: 'plug'},
  {label: 'Cache', viewId: 'multimeter.cache', icon: 'database'},
  {label: 'Environment Variables', viewId: ENVIRONMENT_VIEW_ID, icon: 'symbol-variable'},
  {label: 'History', viewId: HISTORY_VIEW_ID, icon: 'history'},
];

class DockTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.TreeItem[] {
    return DOCK_ENTRIES.map(entry => {
      const item = new vscode.TreeItem(entry.label, vscode.TreeItemCollapsibleState.None);
      item.id = entry.viewId;
      item.iconPath = new vscode.ThemeIcon(entry.icon);
      item.command = {
        command: `${entry.viewId}.focus`,
        title: `Focus ${entry.label}`,
      };
      item.tooltip = `Show ${entry.label}`;
      return item;
    });
  }
}

/**
 * Move Environment + History into a Multimeter container that has a tree
 * Views dock. Dragging one webview onto another fails when each sits alone
 * in a generated panel container (vscode#144122); this restores a real drop
 * target so they can be tab-merged like the other Multimeter views.
 */
export async function moveEnvironmentAndHistoryTo(
    destinationId: typeof ACTIVITY_CONTAINER_ID|typeof PANEL_CONTAINER_ID,
): Promise<void> {
  await vscode.commands.executeCommand('vscode.moveViews', {
    viewIds: [ENVIRONMENT_VIEW_ID, HISTORY_VIEW_ID],
    destinationId,
  });
}

const ENV_HISTORY_SIDEBAR_MIGRATION_KEY = 'multimeter.views.envHistorySidebar.v1';

export function registerMultimeterDockTrees(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
      vscode.window.registerTreeDataProvider(ACTIVITY_DOCK_VIEW_ID, new DockTreeProvider()),
      vscode.window.registerTreeDataProvider(PANEL_DOCK_VIEW_ID, new DockTreeProvider()),
      vscode.commands.registerCommand(
          'multimeter.views.groupInSidebar',
          () => moveEnvironmentAndHistoryTo(ACTIVITY_CONTAINER_ID)),
      vscode.commands.registerCommand(
          'multimeter.views.groupInPanel',
          () => moveEnvironmentAndHistoryTo(PANEL_CONTAINER_ID)),
  );

  // One-shot: pull Environment/History out of lone webview panel tabs (no drop
  // target) into the Multimeter sidebar where the Views dock can tab-merge them.
  if (!context.globalState.get(ENV_HISTORY_SIDEBAR_MIGRATION_KEY)) {
    void (async () => {
      try {
        await moveEnvironmentAndHistoryTo(ACTIVITY_CONTAINER_ID);
        await context.globalState.update(ENV_HISTORY_SIDEBAR_MIGRATION_KEY, true);
      } catch {
        // Destination may be unavailable during early activate; user can retry
        // via Multimeter: Group Environment & History in Sidebar.
      }
    })();
  }
}
