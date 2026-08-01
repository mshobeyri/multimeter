import * as vscode from 'vscode';

const MMT_VIEW_TYPES = new Set([
  'mmt.editor',
  'mmt.httpEditor',
  'mmt.brunoEditor',
]);

type TabInputLike = {
  uri?: vscode.Uri;
  viewType?: string;
};

function tabMatchesUri(tab: vscode.Tab, uri: vscode.Uri): boolean {
  const input = tab.input as TabInputLike | undefined;
  if (!input?.uri || input.uri.toString() !== uri.toString()) {
    return false;
  }
  if (input.viewType && !MMT_VIEW_TYPES.has(input.viewType)) {
    return false;
  }
  return true;
}

/**
 * Promote a preview (italic) tab to a permanent tab so the next single-click
 * open does not replace it. Mirrors VS Code's behavior for dirty editors, for
 * cases like an active test run or mock server that do not dirty the file.
 */
export async function keepMmtEditor(uri: vscode.Uri): Promise<void> {
  try {
    let previewTab: vscode.Tab|undefined;
    let viewType = 'mmt.editor';
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (!tab.isPreview || !tabMatchesUri(tab, uri)) {
          continue;
        }
        previewTab = tab;
        const input = tab.input as TabInputLike;
        if (input.viewType) {
          viewType = input.viewType;
        }
        break;
      }
      if (previewTab) {
        break;
      }
    }
    if (!previewTab) {
      return;
    }

    if (previewTab.isActive) {
      await vscode.commands.executeCommand('workbench.action.keepEditor');
      return;
    }

    await vscode.commands.executeCommand('vscode.openWith', uri, viewType, {
      preview: false,
      preserveFocus: true,
    });
  } catch {
    // Best-effort: failing to pin must not break runs or edits.
  }
}

/** Fire-and-forget wrapper for call sites that should not await. */
export function keepMmtEditorSoon(uri: vscode.Uri): void {
  void keepMmtEditor(uri);
}
