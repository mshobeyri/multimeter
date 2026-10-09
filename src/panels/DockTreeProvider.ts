import * as vscode from 'vscode';

/** Collapsed tree view at the top of the Multimeter sidebar.
 * Keeps a real pane header so VS Code can show a drop overlay when relocating
 * views (webview-only containers hide that header in merged single-view mode).
 * See vscode#144122. */
export const ACTIVITY_DOCK_VIEW_ID = 'multimeter.activityDock';

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
  {label: 'Environment Variables', viewId: 'multimeter.environment', icon: 'symbol-variable'},
  {label: 'History', viewId: 'multimeter.history', icon: 'history'},
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

export function registerMultimeterDockTrees(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
      vscode.window.registerTreeDataProvider(ACTIVITY_DOCK_VIEW_ID, new DockTreeProvider()),
  );
}
